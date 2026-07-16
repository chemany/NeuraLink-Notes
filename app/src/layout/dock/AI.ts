/// #if !MOBILE
import { Tab } from "../Tab";
import { setPanelFocus } from "../util";
/// #endif
import { Model } from "../Model";
import { App } from "../../index";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { getDockByType } from "../tabUtil";
import { getAllModels } from "../getAll";
import { insertHTML } from "../../protyle/util/insertHTML";
import { focusBlock, focusByRange, getEditorRange } from "../../protyle/util/selection";
import { fetchSyncPost } from "../../util/fetch";
import { MeetingManager } from "../../meeting/MeetingManager";
import { transaction } from "../../protyle/wysiwyg/transaction";

interface IAIMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
}

const maxAIContextLength = 256000;

export class AI extends Model {
    private element: Element;
    private messages: IAIMessage[] = [];
    private currentEditor: any = null;
    private currentDocId: string = ""; // 跟踪当前文档ID，用于检测文档切换
    private activeTab: "chat" | "meeting" = "chat";
    private meetingTimer: any = null;

    constructor(app: App, tab: Tab | Element) {
        super({ app, id: tab.id });
        if (tab instanceof Element) {
            this.element = tab;
        } else {
            this.element = tab.panelElement;
        }

        // 注入样式
        this.injectStyles();

        this.element.classList.add("fn__flex-column", "file-tree", "sy__ai");

        // 渲染基础框架
        this.renderLayout();

        // 绑定事件
        this.bindEvents();

        // 如果是会议页面，初始化会议状态监听
        this.initMeetingListener();
    }

    private injectStyles() {
        const styleId = "ai-dock-styles";
        if (document.getElementById(styleId)) return;

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .ai-tabs {
                display: flex;
                background: var(--b3-theme-surface);
                border-bottom: 1px solid var(--b3-border-color);
                padding: 0 8px;
            }
            .ai-tab {
                padding: 10px 16px;
                cursor: pointer;
                font-size: 13px;
                color: var(--b3-theme-on-surface-light);
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                opacity: 0.7;
            }
            .ai-tab:hover {
                color: var(--b3-theme-on-surface);
                opacity: 1;
            }
            .ai-tab.active {
                color: var(--b3-theme-primary);
                border-bottom-color: var(--b3-theme-primary);
                font-weight: bold;
                opacity: 1;
            }
            .ai-panel {
                display: none;
                flex: 1;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
            }
            .ai-panel.active {
                display: flex;
            }
            
            /* 会议记录按钮动效 */
            .record-btn-wrapper {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .record-btn {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: var(--b3-theme-primary);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                color: #fff;
                z-index: 2;
            }
            .record-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(0,0,0,0.3);
            }
            .record-btn.recording {
                background: #ff4d4f;
                transform: scale(0.95);
                border-radius: 20px;
            }
            .record-ripple {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: var(--b3-theme-primary);
                opacity: 0.2;
                animation: ripple 1.5s infinite;
                display: none;
            }
            .record-btn-wrapper.active .record-ripple {
                display: block;
                background: #ff4d4f;
            }
            @keyframes ripple {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.4; }
                100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
            }
            
            .meeting-stat-card {
                background: var(--b3-theme-surface-lighter);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid var(--b3-border-color);
            }
            /* 解决无法选择和复制文本的问题 */
            .sy__ai .ai-messages {
                user-select: text !important;
                -webkit-user-select: text !important;
            }
            .ai-messages div {
                user-select: text !important;
                -webkit-user-select: text !important;
            }
            /* 优化选中时的背景色 */
            .ai-messages ::selection {
                background: var(--b3-theme-primary-lighter);
                color: var(--b3-theme-on-primary);
            }
        `;
        document.head.appendChild(style);
    }

    private renderLayout() {
        this.element.innerHTML = `
            <div class="block__icons">
                <div class="block__logo">
                    <svg class="block__logoicon"><use xlink:href="#iconSparkles"></use></svg>AI 助手&nbsp;
                </div>
                <span class="fn__flex-1"></span>
                <span data-type="min" class="block__icon b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.min}${updateHotkeyAfterTip(window.siyuan.config.keymap.general.closeTab.custom)}"><svg><use xlink:href="#iconMin"></use></svg></span>
            </div>
            
            <div class="ai-tabs">
                <div class="ai-tab ${this.activeTab === 'chat' ? 'active' : ''}" data-tab="chat">
                    <span style="font-size: 14px; margin-right: 4px;">💬</span>智能问答
                </div>
                <div class="ai-tab ${this.activeTab === 'meeting' ? 'active' : ''}" data-tab="meeting">
                    <span style="font-size: 14px; margin-right: 4px;">🎙️</span>会议纪要
                </div>
            </div>

            <div class="fn__flex-1" style="position: relative; overflow: hidden;">
                <!-- 聊天面板 -->
                <div class="ai-panel ${this.activeTab === 'chat' ? 'active' : ''}" data-panel="chat">
                    ${this.getChatHTML()}
                </div>

                <!-- 会议面板 -->
                <div class="ai-panel ${this.activeTab === 'meeting' ? 'active' : ''}" data-panel="meeting">
                    ${this.getMeetingHTML()}
                </div>
            </div>
        `;
    }

    private getChatHTML() {
        return `
        <div class="fn__flex-1 ai-chat-container" style="background-color: var(--b3-theme-background); display: flex; flex-direction: column; height: 100%; overflow: hidden;">
            <div class="ai-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: var(--b3-theme-surface);" data-type="messages">
                <div class="ai-welcome" style="color: var(--b3-theme-on-surface-light); text-align: center; padding: 40px 10px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🤖</div>
                    <div style="font-weight: bold; margin-bottom: 8px;">AI 智能助手</div>
                    <div style="font-size: 13px; opacity: 0.8; line-height: 1.6;">
                        您可以针对当前内容提问，<br>或使用下方的快捷功能。
                    </div>
                </div>
            </div>
            
            <div style="padding: 12px; background: var(--b3-theme-surface); border-top: 1px solid var(--b3-border-color); flex-shrink: 0;">
                <div class="ai-prompts" style="margin-bottom: 10px; display: flex; flex-direction: row; gap: 6px;">
                    <button class="b3-button b3-button--outline fn__flex-1" data-prompt="总结" style="font-size: 11px; padding: 6px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        📋 总结
                    </button>
                    <button class="b3-button b3-button--outline fn__flex-1" data-prompt="要点" style="font-size: 11px; padding: 6px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        🎯 要点
                    </button>
                    <button class="b3-button b3-button--outline fn__flex-1" data-prompt="续写" style="font-size: 11px; padding: 6px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ✍️ 续写
                    </button>
                </div>
                
                <div class="ai-input-container" style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="ai-input" style="display: flex; gap: 8px;">
                        <input type="text" class="b3-text-field fn__flex-1" placeholder="在此输入您的问题..." data-type="input" style="padding: 8px 12px; font-size: 13px;">
                        <button class="b3-button b3-button--info" data-type="send" style="padding: 0 16px;">发送</button>
                    </div>
                    <div class="ai-actions" style="display: none; justify-content: space-between; align-items: center;">
                        <button class="b3-button b3-button--cancel" data-type="save" style="font-size: 11px; padding: 4px 12px;">💾 保存至笔记</button>
                        <button class="b3-button b3-button--text" data-type="clear" style="font-size: 11px; color: var(--b3-theme-on-surface-light);">清空对话</button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    private getMeetingHTML() {
        const manager = MeetingManager.getInstance();
        const isRecording = manager.isRecording;

        return `
        <div class="fn__flex-1" style="background-color: var(--b3-theme-background); padding: 16px; display: flex; flex-direction: column; align-items: center;">
            
            <!-- 计时器区域 -->
            <div style="text-align: center; margin: 32px 0 32px 0; width: 100%;">
                <div class="meeting-timer" style="font-family: monospace; font-size: 36px; font-weight: bold; color: var(--b3-theme-on-surface); line-height: 1.2; letter-spacing: 2px;">
                    00:00
                </div>
                <div class="meeting-status" style="font-size: 13px; color: var(--b3-theme-on-surface-light); margin-top: 8px;">
                    ${isRecording ? '正在录音...' : '准备就绪'}
                </div>
            </div>

            <!-- 控制按钮区域 -->
            <div style="width: 100%; display: flex; justify-content: center; margin-bottom: 32px;">
                <!-- 开始按钮 (未录音时显示) -->
                <button class="b3-button" id="btn-start-record" data-type="start-record" style="width: 140px; height: 44px; font-size: 16px; font-weight: bold; display: ${isRecording ? 'none' : 'flex'}; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <svg style="width: 18px; height: 18px; margin-right: 8px;"><use xlink:href="#iconMic"></use></svg>开始录音
                </button>

                <!-- 录音中控制组 (录音时显示) -->
                <div id="recording-controls" style="display: ${isRecording ? 'flex' : 'none'}; gap: 16px; width: 100%; justify-content: center;">
                     <button class="b3-button" data-type="summarize-record" style="flex: 1; height: 44px; font-size: 14px; font-weight: 600; background-color: var(--b3-theme-primary); color: #fff; display: flex; align-items: center; justify-content: center;">
                        <svg style="width: 16px; height: 16px; margin-right: 6px;"><use xlink:href="#iconSparkles"></use></svg>总结
                    </button>
                    <button class="b3-button b3-button--error" data-type="stop-record" style="flex: 1; height: 44px; font-size: 14px; font-weight: 600; background-color: var(--b3-theme-error); color: #fff; display: flex; align-items: center; justify-content: center;">
                        <svg style="width: 16px; height: 16px; margin-right: 6px;"><use xlink:href="#iconSquare"></use></svg>停止
                    </button>
                </div>
            </div>

            <!-- 紧凑设置卡片 -->
            <div style="width: 100%; background: var(--b3-theme-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--b3-border-color); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center;">
                        <span style="font-size: 14px; margin-right: 6px;">⚡</span>
                        <span style="font-size: 13px; font-weight: 500;">自动同步</span>
                    </div>
                    <select class="b3-select" id="meeting-interval" style="width: 90px; height: 30px; font-size: 12px;">
                        <option value="10">10秒</option>
                        <option value="30">30秒</option>
                        <option value="60">1分钟</option>
                        <option value="120">2分钟</option>
                        <option value="300">5分钟</option>
                    </select>
                </div>
            </div>

            <div style="flex: 1;"></div>
            
            <!-- 底部简要统计 -->
            <div style="width: 100%; display: flex; justify-content: space-between; padding: 12px 16px; border-top: 1px solid var(--b3-border-color); font-size: 12px; color: var(--b3-theme-on-surface-light);">
                <span>今日会议: <strong id="meeting-count" style="color: var(--b3-theme-on-surface);">0</strong></span>
                <span>总时长: <strong id="meeting-duration" style="color: var(--b3-theme-on-surface);">0m</strong></span>
            </div>

        </div>`;
    }

    private bindEvents() {
        this.element.addEventListener("click", (event: MouseEvent) => {
            /// #if !MOBILE
            setPanelFocus(this.element);
            /// #endif
            let target = event.target as HTMLElement;
            while (target && !target.isEqualNode(this.element)) {
                const type = target.getAttribute("data-type");
                const prompt = target.getAttribute("data-prompt");
                const tab = target.getAttribute("data-tab");

                if (type === "min") {
                    getDockByType("ai").toggleModel("ai", false, true);
                    event.preventDefault();
                    break;
                } else if (type === "send") {
                    this.handleSend();
                    event.preventDefault();
                    break;
                } else if (type === "save") {
                    this.saveToNote();
                    event.preventDefault();
                    break;
                } else if (type === "clear") {
                    this.clearMessages();
                    event.preventDefault();
                    break;
                } else if (type === "start-record") {
                    this.startRecord();
                    event.preventDefault();
                    break;
                } else if (type === "stop-record") {
                    this.stopRecord();
                    event.preventDefault();
                    break;
                } else if (type === "summarize-record") {
                    this.summarizeRecord();
                    event.preventDefault();
                    break;
                } else if (tab) {
                    this.switchTab(tab as "chat" | "meeting");
                    event.preventDefault();
                    break;
                } else if (prompt) {
                    this.handlePromptClick(prompt);
                    event.preventDefault();
                    break;
                }
                target = target.parentElement;
            }
        });

        // 监听间隔设置变化
        this.element.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.id === "meeting-interval") {
                const manager = MeetingManager.getInstance();
                manager.setInterval(parseInt(target.value));
            }
        });

        // 回车发送
        const inputElement = this.element.querySelector('[data-type="input"]') as HTMLInputElement;
        if (inputElement) {
            inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    this.handleSend();
                }
            });
        }
    }

    private switchTab(tab: "chat" | "meeting") {
        this.activeTab = tab;

        // 更新 Tab 样式
        this.element.querySelectorAll('.ai-tab').forEach(el => {
            if (el.getAttribute('data-tab') === tab) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // 更新面板显示
        this.element.querySelectorAll('.ai-panel').forEach(el => {
            if (el.getAttribute('data-panel') === tab) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    private async startRecord() {
        const manager = MeetingManager.getInstance();
        const select = this.element.querySelector('#meeting-interval') as HTMLSelectElement;
        const interval = select ? parseInt(select.value) : 1;
        await manager.startRecording(interval);
    }

    private stopRecord() {
        MeetingManager.getInstance().stopRecording();
        // 强制重置 UI，确保立即响应
        this.updateMeetingUI({
            isRecording: false,
            isTranscribing: false,
            duration: 0
        });
    }

    private summarizeRecord() {
        MeetingManager.getInstance().uploadAndTranscribe();
    }

    private handlePromptClick(promptType: string) {
        const inputElement = this.element.querySelector('[data-type="input"]') as HTMLInputElement;
        const promptTexts: { [key: string]: string } = {
            "总结": "总结本文档：1）文档类型与目的 2）核心技术方案/业务逻辑 3）关键决策与结论 4）待办事项或风险点",
            "要点": "提取关键信息：1）需求/问题定义 2）技术参数与约束 3）决策项与待办 4）依赖关系",
            "续写": "基于当前内容续写：分析逻辑脉络，补充技术细节、实现步骤或验证方法，保持技术写作风格"
        };

        if (inputElement && promptTexts[promptType]) {
            inputElement.value = promptTexts[promptType];
            inputElement.focus();

            // 如果不是问答类型，直接发送
            if (promptType !== "问答") {
                setTimeout(() => this.handleSend(), 100);
            }
        }
    }

    private handleSend() {
        const inputElement = this.element.querySelector('[data-type="input"]') as HTMLInputElement;
        if (!inputElement || !inputElement.value.trim()) {
            return;
        }

        const userMessage = inputElement.value.trim();
        inputElement.value = "";

        // 添加用户消息
        this.addMessage("user", userMessage);

        // 获取当前文档内容、引用附件和笔记本ID
        const docContent = this.getCurrentDocContent();
        const activeAttachments = this.getDocumentAttachments();
        const notebookId = this.currentEditor?.protyle?.notebookId || "";

        // 显示加载状态
        const loadingMsg = "🤔 正在思考中...";
        this.addMessage("assistant", loadingMsg);

        // 调用真实的AI API
        this.callAI(userMessage, docContent, activeAttachments, notebookId).then(aiResponse => {
            // 移除加载消息
            this.messages.pop();
            // 添加真实的AI回复
            this.addMessage("assistant", aiResponse);

            // 显示保存按钮
            const actionsElement = this.element.querySelector('.ai-actions') as HTMLElement;
            if (actionsElement) {
                actionsElement.style.display = "flex";
            }
        }).catch(error => {
            // 移除加载消息
            this.messages.pop();
            // 显示错误信息（不添加到历史记录，避免污染上下文）
            const errorMsg = `❌ AI调用失败: ${error.message || '未知错误'}\n\n请检查AI配置是否正确。`;
            this.renderErrorMessage(errorMsg);
            console.error('AI调用失败:', error);
        });
    }

    private initMeetingListener() {
        const manager = MeetingManager.getInstance();

        // 初始化设置
        const select = this.element.querySelector('#meeting-interval') as HTMLSelectElement;
        if (select) {
            select.value = manager.getInterval().toString();
        }

        manager.setStatusCallback((status) => {
            this.updateMeetingUI(status);
        });

        // 监听转录完成事件
        window.addEventListener("neura-meeting-transcription", ((e: CustomEvent) => {
            const content = e.detail;
            if (!content) return;

            const editor = this.getBestEditor();
            if (editor && editor.editor?.protyle) {
                const protyle = editor.editor.protyle;
                const lastBlock = protyle.wysiwyg.element.lastElementChild;
                const lastBlockId = lastBlock?.getAttribute("data-node-id");

                // 使用 transaction 直接在最后一个顶层块之后插入，
                // 而不是 insertHTML（依赖光标位置）。
                // 因为会议纪要是引用块，如果用 focusBlock + insertHTML，
                // 光标会落在引用块内部的子段落中，hasClosestBlock 找到的是子段落，
                // 导致新纪要被插入到引用块内部形成嵌套。
                const htmlContent = protyle.lute.Md2BlockDOM(content);
                const tempElement = document.createElement("template");
                tempElement.innerHTML = htmlContent;
                const newBlocks = Array.from(tempElement.content.children);

                const doOps: IOperation[] = [];
                const undoOps: IOperation[] = [];
                let previousID = lastBlockId;

                newBlocks.forEach((item) => {
                    const id = item.getAttribute("data-node-id");
                    if (!id) return;
                    doOps.push({
                        action: "insert",
                        data: item.outerHTML,
                        id,
                        previousID,
                    });
                    undoOps.push({
                        action: "delete",
                        id,
                    });
                    previousID = id;
                });

                // 插入 DOM
                let insertAfter = lastBlock as Element;
                newBlocks.forEach((item) => {
                    insertAfter.after(item);
                    insertAfter = item;
                });

                transaction(protyle, doOps, undoOps);

                // 聚焦并滚动到新插入的最后一个块
                setTimeout(() => {
                    const newLastBlock = protyle.wysiwyg.element.lastElementChild;
                    if (newLastBlock) {
                        focusBlock(newLastBlock, undefined, false);
                        newLastBlock.scrollIntoView({ behavior: "smooth", block: "end" });
                    }
                }, 200);
            } else {
                window.siyuan.showMessage?.("未找到活动文档，会议纪要无法插入", 3000, "error");
            }
        }) as EventListener);
    }

    private updateMeetingUI(status: any) {
        const startBtn = this.element.querySelector('#btn-start-record') as HTMLElement;
        const controls = this.element.querySelector('#recording-controls') as HTMLElement;
        const statusText = this.element.querySelector('.meeting-status');
        const timerText = this.element.querySelector('.meeting-timer');

        if (status.isRecording) {
            if (startBtn) startBtn.style.display = 'none';
            if (controls) controls.style.display = 'flex';

            if (statusText) statusText.textContent = status.isTranscribing ? "✨ 正在转录中..." : "🔴 正在录音...";
        } else {
            if (startBtn) startBtn.style.display = 'flex';
            if (controls) controls.style.display = 'none';

            if (statusText) statusText.textContent = "准备就绪";
        }

        if (timerText) {
            const m = Math.floor(status.duration / 60).toString().padStart(2, '0');
            const s = (status.duration % 60).toString().padStart(2, '0');
            timerText.textContent = `${m}:${s}`;
        }
    }

    private getBestEditor() {
        const models = getAllModels();
        let activeEditor = null;

        activeEditor = models.editor.find(item =>
            item.parent?.headElement?.classList.contains("item--focus")
        );

        if (!activeEditor) {
            activeEditor = models.editor.find(item =>
                item.parent?.headElement?.classList.contains("fn__flex-1--focus")
            );
        }

        if (!activeEditor && models.editor.length > 0) {
            let latestTime = 0;
            models.editor.forEach(item => {
                const time = parseInt(item.parent?.headElement?.getAttribute("data-activetime") || "0");
                if (time > latestTime) {
                    latestTime = time;
                    activeEditor = item;
                }
            });
        }

        if (!activeEditor && models.editor.length > 0) {
            activeEditor = models.editor[0];
        }

        return activeEditor;
    }

    private getCurrentDocContent(): string {
        const activeEditor = this.getBestEditor();

        if (activeEditor && activeEditor.editor?.protyle) {
            this.currentEditor = activeEditor.editor;

            // 检测文档是否切换
            const newDocId = activeEditor.editor.protyle.block?.id || "";
            if (newDocId && this.currentDocId !== newDocId) {
                console.log(`[AI] 文档切换: ${this.currentDocId} -> ${newDocId}`);
                this.currentDocId = newDocId;
                // 切换文档时自动清空历史上下文
                this.clearMessages(true);
            }

            const wysiwygElement = activeEditor.editor.protyle.wysiwyg.element;
            const content = wysiwygElement.textContent || "";
            return content;
        }

        return "";
    }

    // 扫描文档中的附件链接
    private getDocumentAttachments(): string[] {
        if (!this.currentEditor?.protyle) {
            console.log("[AI] getDocumentAttachments: currentEditor不存在");
            return [];
        }

        const attachments: string[] = [];
        const wysiwygElement = this.currentEditor.protyle.wysiwyg.element;

        // 查找所有附件链接 - 支持多种文档格式
        const supportedExtensions = [
            '.pdf',           // PDF文档
            '.doc', '.docx',  // Word文档
            '.xls', '.xlsx',  // Excel表格
            '.pptx',          // PowerPoint
            '.txt', '.md', '.markdown',  // 文本文件
            '.csv',           // CSV数据
            '.rtf',           // RTF富文本
            '.odt',           // OpenDocument
            '.json', '.xml', '.html', '.htm',  // 结构化文本
            '.yaml', '.yml', '.toml', '.ini', '.conf',  // 配置文件
            '.log',           // 日志文件
            '.py', '.js', '.ts', '.go', '.java', '.c', '.cpp', '.h', '.sh'  // 代码文件
        ];

        // 优先查找OCR JSON文件的辅助函数
        const findOCRJson = (pdfPath: string): string | null => {
            // 从PDF路径生成OCR JSON文件路径
            // 例如: assets/1210保障线汇报记录-20251223091526-xt9p3ts.pdf
            // OCR文件: assets/1210保障线汇报记录-20251223091526-xt9p3ts.pdf.ocr.json
            const ocrJsonPath = `${pdfPath}.ocr.json`;

            console.log(`[AI] 检查OCR文件: ${ocrJsonPath} (对应PDF: ${pdfPath})`);
            return ocrJsonPath;
        };

        const addAttachment = (href: string) => {
            if (href && supportedExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
                // 如果是PDF文件，同时添加原始路径和OCR路径
                if (href.toLowerCase().endsWith('.pdf')) {
                    // 1. 添加原始PDF路径 - 后端会匹配对应的 .vectors.json 文件
                    if (!attachments.includes(href)) {
                        attachments.push(href);
                        console.log("[AI] 找到PDF附件:", href);
                    }
                    // 2. 同时添加OCR JSON路径作为备选
                    const ocrJsonPath = findOCRJson(href);
                    if (ocrJsonPath && !attachments.includes(ocrJsonPath)) {
                        attachments.push(ocrJsonPath);
                        console.log("[AI] 找到OCR JSON文件:", ocrJsonPath);
                    }
                } else {
                    // 非PDF文件直接添加
                    if (!attachments.includes(href)) {
                        attachments.push(href);
                        console.log("[AI] 找到附件:", href);
                    }
                }
            }
        };

        // 方法1: 查找 <span data-type="a"> 链接
        wysiwygElement.querySelectorAll('span[data-type="a"]').forEach((link: Element) => {
            addAttachment(link.getAttribute('data-href') || '');
        });

        // 方法2: 查找所有包含 assets/ 的链接
        wysiwygElement.querySelectorAll('[data-href*="assets/"]').forEach((el: Element) => {
            addAttachment(el.getAttribute('data-href') || '');
        });

        // 方法3: 查找 data-subtype="a" 的元素
        wysiwygElement.querySelectorAll('[data-subtype="a"]').forEach((el: Element) => {
            addAttachment(el.getAttribute('data-href') || '');
        });

        // 方法4: 从HTML内容中提取 assets/ 路径
        const htmlContent = wysiwygElement.innerHTML;
        const assetMatches = htmlContent.match(/assets\/[^"'\s<>]+\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|odt)/gi);
        if (assetMatches) {
            assetMatches.forEach(match => addAttachment(match));
        }

        console.log("[AI] 附件扫描完成，共找到:", attachments.length, "个附件");

        // 方法5: 查找 <span data-type="a"> 链接 (原有逻辑保留)
        const links = wysiwygElement.querySelectorAll('span[data-type="a"]');
        links.forEach((link: Element) => {
            const href = link.getAttribute('data-href') || '';
            if (supportedExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
                if (!attachments.includes(href)) {
                    attachments.push(href);
                }
            }
        });

        // 查找 <a> 标签
        const aLinks = wysiwygElement.querySelectorAll('a');
        aLinks.forEach((link: HTMLAnchorElement) => {
            const href = link.getAttribute('href') || '';
            if (supportedExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
                if (!attachments.includes(href)) {
                    attachments.push(href);
                }
            }
        });

        // 查找嵌入的文件块
        const fileBlocks = wysiwygElement.querySelectorAll('[data-type="NodeFile"]');
        fileBlocks.forEach((block: Element) => {
            const src = block.getAttribute('data-src') || '';
            if (supportedExtensions.some(ext => src.toLowerCase().endsWith(ext))) {
                if (!attachments.includes(src)) {
                    attachments.push(src);
                }
            }
        });

        return attachments;
    }

    // 解析附件内容
    private async parseAttachments(paths: string[]): Promise<string> {
        if (paths.length === 0) {
            return "";
        }

        let attachmentContent = "";

        for (const path of paths) {
            try {
                // 如果是OCR JSON文件，使用getOCRResult API读取
                if (path.toLowerCase().endsWith('.ocr.json')) {
                    console.log("[AI] 读取OCR JSON文件:", path);
                    // 从OCR JSON文件路径提取原始PDF路径
                    const pdfPath = path.replace('.ocr.json', '');

                    const result = await fetchSyncPost('/api/ai/getOCRResult', {
                        assetPath: pdfPath
                    });

                    if (result.code === 0 && result.data) {
                        const fullText = result.data.fullText || "";
                        const fileName = path.split('/').pop()?.replace('.ocr.json', '') || path;

                        // 限制每个附件内容长度
                        const content = fullText.length > 5000
                            ? fullText.substring(0, 5000) + "...(内容已截断)"
                            : fullText;

                        attachmentContent += `\n\n--- OCR文档: ${fileName} ---\n${content}`;
                        console.log("[AI] 成功读取OCR JSON文件，内容长度:", content.length);
                    } else {
                        console.warn("[AI] 读取OCR JSON文件失败:", path, result.msg);
                    }
                } else {
                    // 其他文件类型使用原有的批量解析接口
                    console.log("[AI] 使用批量解析接口处理文件:", path);
                    const result = await fetchSyncPost('/api/ai/batchParseAttachments', {
                        paths: [path]
                    });

                    if (result.code === 0) {
                        const results = result.data?.results || [];
                        for (const item of results) {
                            if (item.content && !item.error) {
                                const fileName = item.path.split('/').pop() || item.path;
                                // 限制每个附件内容长度
                                const content = item.content.length > 5000
                                    ? item.content.substring(0, 5000) + "...(内容已截断)"
                                    : item.content;
                                attachmentContent += `\n\n--- 附件: ${fileName} ---\n${content}`;
                            }
                        }
                    } else {
                        console.warn("[AI] 批量解析附件失败:", result.msg);
                    }
                }
            } catch (error) {
                console.error("[AI] 解析附件失败:", path, error);
            }
        }

        return attachmentContent;
    }

    private async callAI(question: string, docContent: string, activeAttachments: string[] = [], notebookId: string = ""): Promise<string> {
        const messages = [];

        // 调试日志
        console.log("[AI] callAI被调用，准备依靠后端 RAG 增强");
        console.log("[AI] 发现附件:", activeAttachments.length, "个", activeAttachments);

        // 调试日志
        console.log("[AI] 附件列表:", activeAttachments);
        console.log("[AI] 文档内容长度:", docContent.length);

        // 1. 构建系统消息，包含当前文档内容
        let systemContent = `你是文档分析助手。请基于以下文档内容回答用户问题。`;

        // 添加附件引用提示
        if (activeAttachments && activeAttachments.length > 0) {
            systemContent += `\n\n【文档包含的附件】\n文档中包含以下附件，后端 RAG 将自动注入附件内容：`;
            activeAttachments.forEach((path, idx) => {
                const fileName = path.split('/').pop() || path;
                systemContent += `\n${idx + 1}. ${fileName}`;
            });
        }

        // 添加当前文档内容，并为当前问题和历史消息保留上下文预算。
        if (docContent && docContent.trim()) {
            const documentPrefix = "\n\n【当前文档正文】\n";
            const truncationSuffix = "\n\n...(文档内容过长，已截断)";
            const maxDocLength = Math.max(0, maxAIContextLength - systemContent.length - documentPrefix.length - question.length);
            let truncatedContent = docContent;
            if (docContent.length > maxDocLength) {
                const contentLength = Math.max(0, maxDocLength - truncationSuffix.length);
                truncatedContent = docContent.substring(0, contentLength) + (maxDocLength > truncationSuffix.length ? truncationSuffix : "");
            }
            systemContent += documentPrefix + truncatedContent;
        }

        messages.push({
            role: "system",
            content: systemContent
        });

        // 2. 添加历史消息，优先保留最新内容，并与当前文档共用 256000 字符的上下文预算。
        const history = this.messages.slice(0, -1);
        const historyBudget = Math.max(0, maxAIContextLength - systemContent.length - question.length);
        const recentHistory: IAIMessage[] = [];
        let historyLength = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const message = history[i];
            if (historyLength + message.content.length > historyBudget) {
                break;
            }
            recentHistory.unshift(message);
            historyLength += message.content.length;
        }

        recentHistory.forEach((msg) => {
            let content = msg.content;
            if (msg.role === "assistant") {
                content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
                content = content.replace(/<think>[\s\S]*/g, "").trim();
            }
            if (content) {
                messages.push({
                    role: msg.role,
                    content: content
                });
            }
        });

        // 3. 最重要：添加当前用户的问题
        messages.push({
            role: "user",
            content: question
        });

        console.log("[AI] 发送给后端的消息条数:", messages.length);
        console.log("[AI] 最后一条消息角色:", messages[messages.length - 1]?.role);

        // 使用流式 API
        return this.callAIStream(messages, activeAttachments, notebookId);
    }

    // 流式调用 AI API
    private async callAIStream(messages: any[], activeAttachments: string[] = [], notebookId: string = ""): Promise<string> {
        return new Promise((resolve, reject) => {
            let fullContent = "";

            // 获取认证 token
            const token = localStorage.getItem("siyuan_token") || "";

            fetch('/api/ai/chatStream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Auth-Token': token
                },
                body: JSON.stringify({ messages, activeAttachments, notebookId }),
                credentials: 'include'
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error("无法获取响应流");
                }

                const decoder = new TextDecoder();

                const readStream = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve(fullContent || "AI 没有返回内容");
                            return;
                        }

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.error) {
                                        reject(new Error(data.error));
                                        return;
                                    }
                                    if (data.token) {
                                        fullContent += data.token;
                                        // 实时更新显示
                                        this.updateStreamingMessage(fullContent);
                                    }
                                    if (data.done) {
                                        resolve(fullContent || "AI 没有返回内容");
                                        return;
                                    }
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            }
                        }

                        readStream();
                    }).catch(reject);
                };

                readStream();
            }).catch(reject);
        });
    }

    // 实时更新流式消息显示
    private updateStreamingMessage(content: string) {
        const messagesContainer = this.element.querySelector('[data-type="messages"]');
        if (!messagesContainer) return;

        // 查找最后一条 AI 消息并更新
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            const contentDiv = lastMessage.querySelector('div:last-child');
            if (contentDiv) {
                contentDiv.innerHTML = this.escapeHtml(content);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    }

    private generateMockResponse(question: string, docContent: string): string {
        // 保留作为fallback，但不再使用
        // 这是一个模拟响应，实际应用中应该调用真实的AI API
        if (question.includes("总结")) {
            return `📋 **文档总结**\n\n根据当前文档内容，主要讨论了以下几个方面：\n\n1. 核心观点和主题\n2. 关键论据和支撑材料\n3. 结论和启示\n\n_（这是一个示例响应，实际应用中需要接入AI服务）_`;
        } else if (question.includes("要点")) {
            return `🎯 **关键要点**\n\n• 要点一：核心概念说明\n• 要点二：重要论据\n• 要点三：实践应用\n• 要点四：注意事项\n\n_（这是一个示例响应，实际应用中需要接入AI服务）_`;
        } else if (question.includes("续写")) {
            return `✍️ **续写建议**\n\n基于当前内容，可以从以下角度继续展开：\n\n1. 深入分析现有观点\n2. 补充相关案例\n3. 提出可能的解决方案\n4. 总结和展望\n\n_（这是一个示例响应，实际应用中需要接入AI服务）_`;
        } else if (question.includes("优化")) {
            return `✨ **优化建议**\n\n**结构优化：**\n- 建议调整段落顺序，使逻辑更清晰\n- 可以添加小标题，增强可读性\n\n**表达优化：**\n- 部分句子可以更简洁\n- 专业术语需要适当解释\n\n_（这是一个示例响应，实际应用中需要接入AI服务）_`;
        } else {
            return `💡 **AI 回复**\n\n关于您的问题"${question}"：\n\n根据文档内容分析，我的理解是...\n\n_（这是一个示例响应，实际应用中需要接入真实的AI服务进行分析）_`;
        }
    }

    private addMessage(role: "user" | "assistant" | "system", content: string) {
        const message: IAIMessage = {
            role,
            content,
            timestamp: Date.now()
        };

        this.messages.push(message);
        this.renderMessages();
    }

    private renderErrorMessage(content: string) {
        const messagesContainer = this.element.querySelector('[data-type="messages"]');
        if (!messagesContainer) return;

        // 移除欢迎消息
        const welcomeElement = messagesContainer.querySelector('.ai-welcome');
        if (welcomeElement) {
            welcomeElement.remove();
        }

        // 渲染错误消息（不保存到历史记录）
        const errorHtml = `
            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px;">
                <div style="max-width: 85%; background: var(--b3-theme-error-lighter, #ffebee); padding: 8px 12px; border-radius: 8px; word-wrap: break-word; border-left: 3px solid var(--b3-theme-error);">
                    <div style="font-size: 11px; color: var(--b3-theme-error); margin-bottom: 4px;">
                        ⚠️ 错误
                    </div>
                    <div style="line-height: 1.6; white-space: pre-wrap; font-size: 13px; color: var(--b3-theme-on-surface);">${this.escapeHtml(content)}</div>
                </div>
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', errorHtml);

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    private renderMessages() {
        const messagesContainer = this.element.querySelector('[data-type="messages"]');
        if (!messagesContainer) return;

        // 移除欢迎消息
        const welcomeElement = messagesContainer.querySelector('.ai-welcome');
        if (welcomeElement) {
            welcomeElement.remove();
        }

        // 清空并重新渲染所有消息
        messagesContainer.innerHTML = this.messages.map(msg => {
            const isUser = msg.role === "user";
            const bgColor = isUser ? "var(--b3-theme-primary-lighter)" : "var(--b3-theme-surface)";
            const align = isUser ? "flex-end" : "flex-start";
            const icon = isUser ? "👤" : "🤖";

            return `
                <div style="display: flex; justify-content: ${align}; margin-bottom: 12px;">
                    <div style="max-width: 85%; background: ${bgColor}; padding: 8px 12px; border-radius: 8px; word-wrap: break-word;">
                        <div style="font-size: 11px; color: var(--b3-theme-on-surface-light); margin-bottom: 4px;">
                            ${icon} ${isUser ? "我" : "AI助手"}
                        </div>
                        <div style="line-height: 1.6; white-space: pre-wrap; font-size: 13px;">${this.escapeHtml(msg.content)}</div>
                    </div>
                </div>
            `;
        }).join("");

        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    private escapeHtml(text: string): string {
        // 处理 <think> 标签，将其分离出来单独显示
        let content = text;
        let thinkContent = "";

        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
            thinkContent = thinkMatch[1];
            content = content.replace(/<think>[\s\S]*?<\/think>/, "");
        } else {
            // 处理未闭合的标签（流式传输中）
            const partialThinkMatch = content.match(/<think>([\s\S]*)/);
            if (partialThinkMatch) {
                thinkContent = partialThinkMatch[1];
                content = content.replace(/<think>[\s\S]*/, "");
            }
        }

        const escapePart = (t: string) => {
            return t.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                .replace(/`(.*?)`/g, '<code style="background: var(--b3-theme-surface-lighter); padding: 2px 4px; border-radius: 2px;">$1</code>')
                .replace(/\n/g, "<br>");
        };

        let result = escapePart(content.trim());
        if (thinkContent) {
            const escapedThink = escapePart(thinkContent.trim());
            const thinkHtml = `<div class="ai-thought" style="margin-bottom: 8px; border-left: 2px solid var(--b3-theme-surface-lighter); padding-left: 8px; font-size: 12px; color: var(--b3-theme-on-surface-light); opacity: 0.8;">
                <div style="font-weight: bold; margin-bottom: 2px; display: flex; align-items: center; opacity: 0.6;">
                    <svg style="width: 12px; height: 12px; margin-right: 4px;"><use xlink:href="#iconSparkles"></use></svg>思考过程
                </div>
                <div style="font-style: italic;">${escapedThink}</div>
            </div>`;
            result = thinkHtml + result;
        }

        return result;
    }

    private saveToNote() {
        if (!this.currentEditor || !this.currentEditor.protyle) {
            window.siyuan.showMessage?.("请先打开一个文档", 3000, "error");
            return;
        }

        // 获取最后一条AI回复
        const lastAIMessage = [...this.messages].reverse().find(msg => msg.role === "assistant");
        if (!lastAIMessage) {
            window.siyuan.showMessage?.("没有可保存的AI回复", 3000, "error");
            return;
        }

        try {
            const protyle = this.currentEditor.protyle;
            const lastBlock = protyle.wysiwyg.element.lastElementChild;

            if (lastBlock) {
                // 提取非思考部分的内容
                let cleanContent = lastAIMessage.content;
                // 移除完整的 <think>...</think> 块
                cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/g, "");
                // 移除可能存在的未闭合 <think> 标签及其后续内容
                cleanContent = cleanContent.replace(/<think>[\s\S]*/g, "");
                cleanContent = cleanContent.trim();

                if (!cleanContent) {
                    window.siyuan.showMessage?.("AI 还没有生成正式回复", 3000, "info");
                    return;
                }

                // 准备要插入的内容
                const insertContent = `\n\n---\n\n## 🤖 AI 分析结果\n\n${cleanContent}\n\n*生成时间：${new Date(lastAIMessage.timestamp).toLocaleString()}*\n`;

                // 先聚焦到编辑器最后一个块，确保 insertHTML 能获取到有效的 range
                // 否则焦点在 AI 面板按钮上，getEditorRange 找不到有效 range，
                // 导致后端 doInsert 找不到 block tree 触发 ReloadUI
                focusBlock(lastBlock, undefined, false);

                // 使用 insertHTML 插入内容
                const htmlContent = protyle.lute.Md2BlockDOM(insertContent);
                insertHTML(htmlContent, protyle, true);

                // 聚焦到最后一个块
                setTimeout(() => {
                    const newLastBlock = protyle.wysiwyg.element.lastElementChild;
                    if (newLastBlock) {
                        focusBlock(newLastBlock, undefined, false);
                    }
                }, 100);

                window.siyuan.showMessage?.("✅ 已保存到笔记末尾", 2000, "info");
            }
        } catch (e) {
            console.error("保存到笔记失败:", e);
            window.siyuan.showMessage?.("保存失败，请重试", 3000, "error");
        }
    }

    private clearMessages(switchDoc: boolean = false) {
        this.messages = [];
        const messagesContainer = this.element.querySelector('[data-type="messages"]');
        if (messagesContainer) {
            // 如果是文档切换，显示切换提示
            const welcomeText = switchDoc
                ? `📝 已切换到新文档<br>历史对话已自动清空`
                : `选择一个提示词快速开始分析当前文档<br>分析完成后可以保存到笔记末尾`;

            messagesContainer.innerHTML = `
                <div class="ai-welcome" style="color: var(--b3-theme-on-surface-light); text-align: center; padding: 20px 10px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
                    <div style="font-weight: bold; margin-bottom: 8px;">AI 文档分析助手</div>
                    <div style="font-size: 12px; line-height: 1.6;">
                        ${welcomeText}
                    </div>
                </div>
            `;
        }

        // 隐藏保存按钮
        const actionsElement = this.element.querySelector('.ai-actions') as HTMLElement;
        if (actionsElement) {
            actionsElement.style.display = "none";
        }
    }
}
