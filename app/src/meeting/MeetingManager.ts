import { fetchSyncPost } from "../util/fetch";
import { showMessage } from "../dialog/message";

export interface IMeetingStatus {
    isRecording: boolean;
    isTranscribing: boolean;
    duration: number;
    nextUploadCountdown: number;
}

export class MeetingManager {
    private static instance: MeetingManager;
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private pcmBuffer: Float32Array[] = [];
    private audioProcessCount: number = 0;
    private lastAudioCheck: number = 0;
    private totalSamplesCollected: number = 0;
    private intervalTimer: any = null;
    private startTime: number = 0;
    private intervalSeconds: number = 60;
    private statusCallback: ((status: IMeetingStatus) => void) | null = null;
    private countdownSec: number = 0;
    private _isTranscribing: boolean = false;
    private stream: MediaStream | null = null;

    private constructor() { }

    public static getInstance() {
        if (!MeetingManager.instance) {
            MeetingManager.instance = new MeetingManager();
        }
        return MeetingManager.instance;
    }

    public async startRecording(seconds: number = 60) {
        this.intervalSeconds = seconds;
        this.countdownSec = this.intervalSeconds;
        this.pcmBuffer = [];

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 关键：强制设置采样率为 16000，解决 ASR 识别率问题
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            // 使用 ScriptProcessorNode 收集原始 PCM 数据
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // 深度拷贝数据
                this.pcmBuffer.push(new Float32Array(inputData));

                // 诊断：统计收集的音频数据
                this.audioProcessCount++;
                this.totalSamplesCollected += inputData.length;

                // 每 100 次打印一次诊断信息
                if (this.audioProcessCount % 100 === 0) {
                    console.log("Audio process diagnostic:", {
                        processCount: this.audioProcessCount,
                        bufferChunks: this.pcmBuffer.length,
                        totalSamples: this.totalSamplesCollected,
                        estimatedDuration: (this.totalSamplesCollected / 16000).toFixed(2) + "秒"
                    });
                }
            };

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            this.startTime = Date.now();
            this.startTimer();
            console.log("Meeting recording started (PCM 16k), interval:", seconds, "s");
        } catch (err) {
            showMessage("无法访问麦克风: " + err);
            throw err;
        }
    }

    public stopRecording() {
        this.clearTimer();
        if (this.processor) {
            this.processor.onaudioprocess = null;
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.statusCallback) {
            this.statusCallback({
                isRecording: false,
                isTranscribing: false,
                duration: 0,
                nextUploadCountdown: 0
            });
        }

        console.log("Meeting recording stopped");
    }

    public get isRecording() {
        return this.audioContext?.state === "running";
    }

    public setStatusCallback(cb: (status: IMeetingStatus) => void) {
        this.statusCallback = cb;
    }

    public setInterval(seconds: number) {
        this.intervalSeconds = seconds;
        this.countdownSec = seconds;
    }

    public getInterval() {
        return this.intervalSeconds;
    }

    private startTimer() {
        this.intervalTimer = setInterval(() => {
            const now = Date.now();
            const duration = Math.floor((now - this.startTime) / 1000);
            this.countdownSec--;

            if (this.countdownSec <= 0) {
                this.uploadAndTranscribe();
                this.countdownSec = this.intervalSeconds;
            }

            if (this.statusCallback) {
                this.statusCallback({
                    isRecording: true,
                    isTranscribing: this._isTranscribing,
                    duration: duration,
                    nextUploadCountdown: this.countdownSec
                });
            }
        }, 1000);
    }

    private clearTimer() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    public async uploadAndTranscribe() {
        if (this.pcmBuffer.length === 0) {
            console.warn("No PCM data to upload, skipping transcription");
            return;
        }

        // 1. 合并 PCM 数据并转换为 WAV 格式
        const audioBlob = this.encodeWAV(this.pcmBuffer);

        // 诊断：计算音频数据的详细信息
        const totalSamples = this.pcmBuffer.reduce((acc, s) => acc + s.length, 0);
        const estimatedDuration = (totalSamples / 16000).toFixed(2);

        // 检查音量 (音量过小可能是麦克风问题或授权失效)
        let maxAmp = 0;
        for (const chunk of this.pcmBuffer) {
            for (let i = 0; i < chunk.length; i++) {
                const a = Math.abs(chunk[i]);
                if (a > maxAmp) maxAmp = a;
            }
        }

        console.log("Audio encoding completed:", {
            maxAmplitude: maxAmp.toFixed(4),
            blobSize: audioBlob.size,
            totalSamples: totalSamples,
            estimatedDuration: estimatedDuration + "秒"
        });

        if (maxAmp < 0.01) {
            console.warn("Detected very low audio amplitude. Mic might be muted or not working.");
        }

        this.pcmBuffer = []; // 清空缓冲区用于下一次采集

        const formData = new FormData();
        formData.append("audio", audioBlob, `meeting_${Date.now()}.wav`);

        this._isTranscribing = true;
        console.log("Uploading audio for transcription...");

        fetch("/api/meeting/transcribe", {
            method: "POST",
            body: formData,
        }).then(res => res.json())
            .then(response => {
                console.log("Transcription API response:", response);
                if (response.code === 0 && response.data) {
                    console.log("Transcription successful:", {
                        transcription: response.data.transcription,
                        summary: response.data.summary
                    });
                    this.insertTranscriptionToEditor(response.data);
                } else {
                    console.error("Transcription failed:", response.msg);
                    showMessage("转录失败: " + response.msg);
                }
            }).catch(err => {
                console.error("Upload error:", err);
                showMessage("转录上传失败，请检查网络");
            }).finally(() => {
                this._isTranscribing = false;
            });
    }

    private encodeWAV(samples: Float32Array[]) {
        const sampleRate = 16000;
        const totalLength = samples.reduce((acc, s) => acc + s.length, 0);
        const buffer = new ArrayBuffer(44 + totalLength * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // WAV 头部信息
        writeString(0, 'RIFF');
        view.setUint32(4, 32 + totalLength * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM 格式
        view.setUint16(22, 1, true); // 单声道
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(36, 'data');
        view.setUint32(40, totalLength * 2, true);

        // 写入 PCM 采样数据
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            for (let j = 0; j < sample.length; j++) {
                // 将 Float32 (-1.0 到 1.0) 转换为 Int16 (-32768 到 32767)
                const s = Math.max(-1, Math.min(1, sample[j]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    private insertTranscriptionToEditor(data: { transcription: string, summary: string }) {
        if (!data.transcription) return;

        // 严格过滤大模型的思考过程（包括未闭合的标签）
        let cleanSummary = data.summary
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/<think>[\s\S]*/gi, "")
            .replace(/<\/think>/gi, "")
            .trim();
        const cleanTranscription = data.transcription
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/<think>[\s\S]*/gi, "")
            .trim();

        // 解析并只保留会议要点，保留模型返回的多行内容
        const discussion = this.parseMeetingSummary(cleanSummary);
        const discussionLines = discussion.split('\n').filter(line => line.length > 0);
        const content = discussionLines
            .map((line, index) => index === 0 ? `> 💬 **要点**：${line}` : `> ${line}`)
            .join('\n') + '\n';

        const event = new CustomEvent("neura-meeting-transcription", { detail: content });
        window.dispatchEvent(event);
        showMessage("AI 转录已实时同步");
    }

    /**
     * 从模型返回内容中提取要点，兼容旧的三段式摘要
     */
    private parseMeetingSummary(summary: string): string {
        const defaultDiscussion = "未提取到要点";

        if (!summary) {
            console.warn("parseMeetingSummary: summary is empty");
            return defaultDiscussion;
        }

        console.log("parseMeetingSummary: raw summary:", JSON.stringify(summary));

        // 按行分割并清理
        const lines = summary.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        const cleanLine = (line: string): string => line
            .replace(/^\s*>+\s*/g, '')
            .replace(/^\s*#+\s*/g, '')
            .replace(/\*\*/g, '')
            .trim();

        const withoutListMarker = (line: string): string => line
            .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s*)/, '')
            .trim();

        const isPointLine = (line: string): boolean => /^(?:要点|会议要点|关键要点|讨论|关键讨论)(?=\s*[:：]|\s*$)/.test(line);
        const isOtherSectionLine = (line: string): boolean => /^(?:主题|会议主题|AI纪要主题|后续|后续事项|行动|行动项|决议|结论)(?=\s*[:：]|\s*$)/.test(line);

        const extractValue = (line: string): string => {
            const match = line.match(/^(?:要点|会议要点|关键要点|讨论|关键讨论)\s*(?:[:：]\s*)?(.*)$/);
            return match ? match[1].trim() : line;
        };

        const points: string[] = [];
        let collectingPoints = false;
        let foundPointSection = false;

        for (const line of lines) {
            const cleanedLine = cleanLine(line);
            const labelLine = withoutListMarker(cleanedLine);

            if (isPointLine(labelLine)) {
                foundPointSection = true;
                collectingPoints = true;
                const val = extractValue(labelLine);
                if (val) points.push(val);
            } else if (isOtherSectionLine(labelLine)) {
                collectingPoints = false;
            } else if (collectingPoints) {
                points.push(cleanedLine);
            }
        }

        // 新模型异常省略标题时，保留普通文本；仍过滤旧格式中的主题和后续标题
        if (!foundPointSection) {
            for (const line of lines) {
                const cleanedLine = cleanLine(line);
                const labelLine = withoutListMarker(cleanedLine);
                if (!isOtherSectionLine(labelLine)) {
                    points.push(cleanedLine);
                }
            }
        }

        const result = points.filter(line => line.length > 0).join('\n') || defaultDiscussion;
        console.log("parseMeetingSummary: parsed discussion:", result);
        return result;
    }
}
