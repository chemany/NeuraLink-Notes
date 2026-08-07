package model

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/siyuan-note/logging"
)

// ASR 配置
var asrEndpoint = "ws://jason.cheman.top:10096/"

var (
	asrWriteTimeout  = 30 * time.Second
	asrResultTimeout = 180 * time.Second
)

// LLM 配置
var llmEndpoint = "http://jason.cheman.top:8001/v1"
var llmAPIKey = "vllm-token"
var llmModelName = "tclf90/Qwen3-32B-GPTQ-Int4"
var llmTemperature = 0.3
var llmMaxTokens = 200

// LLM 配置文件路径
var llmConfigPath = "/root/code/unified-settings-service/config/default-models.json"

// meetingLLMConfig 会议纪要 LLM 配置（每次调用时动态加载）
type meetingLLMConfig struct {
	Endpoint    string
	APIKey      string
	ModelName   string
	Temperature float64
	MaxTokens   int
}

// loadMeetingLLMConfig 动态加载会议纪要 LLM 配置，避免需要重启内核
func loadMeetingLLMConfig() meetingLLMConfig {
	// 默认值（使用全局变量）
	cfg := meetingLLMConfig{
		Endpoint:    llmEndpoint,
		APIKey:      llmAPIKey,
		ModelName:   llmModelName,
		Temperature: llmTemperature,
		MaxTokens:   llmMaxTokens,
	}

	data, err := os.ReadFile(llmConfigPath)
	if err != nil {
		logging.LogWarnf("会议 LLM 配置文件读取失败，使用缓存配置: %v", err)
		return cfg
	}

	var models map[string]struct {
		BaseURL     string  `json:"base_url"`
		APIKey      string  `json:"api_key"`
		ModelName   string  `json:"model_name"`
		Temperature float64 `json:"temperature"`
		MaxTokens   int     `json:"max_tokens"`
	}
	if json.Unmarshal(data, &models) != nil {
		logging.LogWarnf("会议 LLM 配置文件解析失败，使用缓存配置")
		return cfg
	}

	// 优先使用 meeting 专用模型，其次是 siyuan 模型
	var model struct {
		BaseURL     string  `json:"base_url"`
		APIKey      string  `json:"api_key"`
		ModelName   string  `json:"model_name"`
		Temperature float64 `json:"temperature"`
		MaxTokens   int     `json:"max_tokens"`
	}
	var found bool
	if m, ok := models["builtin_free_meeting"]; ok {
		model = m
		found = true
	} else if m, ok := models["builtin_free_siyuan"]; ok {
		model = m
		found = true
	}

	if found {
		cfg.Endpoint = model.BaseURL
		if !strings.HasSuffix(cfg.Endpoint, "/") {
			cfg.Endpoint += "/"
		}
		cfg.APIKey = model.APIKey
		cfg.ModelName = model.ModelName
		cfg.Temperature = model.Temperature
		cfg.MaxTokens = model.MaxTokens
	}

	return cfg
}

func init() {
	// 加载 ASR 配置
	asrConfigPath := "/root/code/unified-settings-service/config/asr-config.json"
	asrData, err := os.ReadFile(asrConfigPath)
	if err == nil {
		var asrConfig struct {
			Endpoint string `json:"endpoint"`
		}
		if json.Unmarshal(asrData, &asrConfig) == nil && asrConfig.Endpoint != "" {
			// 确保 endpoint 有正确的协议前缀
			rawEndpoint := asrConfig.Endpoint
			if strings.HasPrefix(rawEndpoint, "http://") {
				asrEndpoint = "ws://" + strings.TrimPrefix(rawEndpoint, "http://")
			} else if strings.HasPrefix(rawEndpoint, "https://") {
				asrEndpoint = "wss://" + strings.TrimPrefix(rawEndpoint, "https://")
			} else {
				asrEndpoint = "ws://" + rawEndpoint
			}
			if !strings.HasSuffix(asrEndpoint, "/") {
				asrEndpoint += "/"
			}
			logging.LogInfof("ASR 配置已加载: %s", asrEndpoint)
		}
	} else {
		logging.LogWarnf("ASR 配置文件不存在，使用默认配置: %s", asrConfigPath)
	}

	// 加载 LLM 默认模型配置
	llmConfigPath := "/root/code/unified-settings-service/config/default-models.json"
	llmData, err := os.ReadFile(llmConfigPath)
	if err == nil {
		var models map[string]struct {
			BaseURL     string  `json:"base_url"`
			APIKey      string  `json:"api_key"`
			ModelName   string  `json:"model_name"`
			Temperature float64 `json:"temperature"`
			MaxTokens   int     `json:"max_tokens"`
		}
		if json.Unmarshal(llmData, &models) == nil {
			// 优先使用 meeting 专用模型，其次是 siyuan 模型
			var modelKey string
			if model, ok := models["builtin_free_meeting"]; ok {
				modelKey = "builtin_free_meeting"
				llmEndpoint = model.BaseURL
				llmAPIKey = model.APIKey
				llmModelName = model.ModelName
				llmTemperature = model.Temperature
				llmMaxTokens = model.MaxTokens
			} else if model, ok := models["builtin_free_siyuan"]; ok {
				modelKey = "builtin_free_siyuan"
				llmEndpoint = model.BaseURL
				llmAPIKey = model.APIKey
				llmModelName = model.ModelName
				llmTemperature = model.Temperature
				llmMaxTokens = model.MaxTokens
			}
			if modelKey != "" {
				if !strings.HasSuffix(llmEndpoint, "/") {
					llmEndpoint += "/"
				}
				logging.LogInfof("LLM 配置已加载 (%s): %s %s (temperature=%.1f, max_tokens=%d)",
					modelKey, llmEndpoint, llmModelName, llmTemperature, llmMaxTokens)
			}
		}
	} else {
		logging.LogWarnf("LLM 配置文件不存在，使用默认配置: %s", llmConfigPath)
	}
}

func findIncrementalContent(oldText, newText string) string {
	if oldText == "" || newText == "" {
		return newText
	}
	minLen := len(oldText)
	if len(newText) < minLen {
		minLen = len(newText)
	}
	foundPrefix := false
	prefixLen := 0
	for i := 0; i < minLen; i++ {
		if oldText[i] == newText[i] {
			foundPrefix = true
			prefixLen = i + 1
		} else {
			break
		}
	}
	if foundPrefix && prefixLen < len(newText) {
		return newText[prefixLen:]
	}
	return ""
}

func isValidUTF8(s string) bool {
	for i := 0; i < len(s); i++ {
		b := s[i]
		if b >= 0x80 {
			if b >= 0xFC && b <= 0xFD {
				for i := 1; i < 6; i++ {
					if i+i >= len(s) {
						return false
					}
					if s[i+i] < 0x80 || s[i+i] > 0xBF {
						return false
					}
				}
				i += 5
			} else if b >= 0xF8 && b <= 0xFB {
				for i := 1; i < 5; i++ {
					if i+i >= len(s) {
						return false
					}
					if s[i+i] < 0x80 || s[i+i] > 0xBF {
						return false
					}
				}
				i += 4
			} else if b >= 0xF0 && b <= 0xF7 {
				for i := 1; i < 4; i++ {
					if i+i >= len(s) {
						return false
					}
					if s[i+i] < 0x80 || s[i+i] > 0xBF {
						return false
					}
				}
				i += 3
			} else if b >= 0xE0 && b <= 0xEF {
				for i := 1; i < 3; i++ {
					if i+i >= len(s) {
						return false
					}
					if s[i+i] < 0x80 || s[i+i] > 0xBF {
						return false
					}
				}
				i += 2
			} else if b >= 0xC0 && b <= 0xDF {
				if i+1 >= len(s) {
					return false
				}
				if s[i+1] < 0x80 || s[i+1] > 0xBF {
					return false
				}
				i += 1
			} else {
				return false
			}
		}
	}
	return true
}

func containsValidUTF8Multibyte(s string) bool {
	for i := 0; i < len(s); i++ {
		b := s[i]
		if b >= 0xE0 && b <= 0xEF {
			if i+2 < len(s) && s[i+1] >= 0x80 && s[i+1] <= 0xBF && s[i+2] >= 0x80 && s[i+2] <= 0xBF {
				return true
			}
		}
		if b >= 0xF0 && b <= 0xF7 {
			if i+3 < len(s) && s[i+1] >= 0x80 && s[i+1] <= 0xBF && s[i+2] >= 0x80 && s[i+2] <= 0xBF && s[i+3] >= 0x80 && s[i+3] <= 0xBF {
				return true
			}
		}
	}
	return false
}

var gbkToUnicode = [0x10000]rune{
	0x00: 0x0000, 0x01: 0x0001, 0x02: 0x0002, 0x03: 0x0003, 0x04: 0x0004, 0x05: 0x0005, 0x06: 0x0006, 0x07: 0x0007,
	0x08: 0x0008, 0x09: 0x0009, 0x0A: 0x000A, 0x0B: 0x000B, 0x0C: 0x000C, 0x0D: 0x000D, 0x0E: 0x000E, 0x0F: 0x000F,
	0x10: 0x0010, 0x11: 0x0011, 0x12: 0x0012, 0x13: 0x0013, 0x14: 0x0014, 0x15: 0x0015, 0x16: 0x0016, 0x17: 0x0017,
	0x18: 0x0018, 0x19: 0x0019, 0x1A: 0x001A, 0x1B: 0x001B, 0x1C: 0x001C, 0x1D: 0x001D, 0x1E: 0x001E, 0x1F: 0x001F,
	0x20: 0x0020, 0x21: 0x0021, 0x22: 0x0022, 0x23: 0x0023, 0x24: 0x0024, 0x25: 0x0025, 0x26: 0x0026, 0x27: 0x0027,
	0x28: 0x0028, 0x29: 0x0029, 0x2A: 0x002A, 0x2B: 0x002B, 0x2C: 0x002C, 0x2D: 0x002D, 0x2E: 0x002E, 0x2F: 0x002F,
	0x30: 0x0030, 0x31: 0x0031, 0x32: 0x0032, 0x33: 0x0033, 0x34: 0x0034, 0x35: 0x0035, 0x36: 0x0036, 0x37: 0x0037,
	0x38: 0x0038, 0x39: 0x0039, 0x3A: 0x003A, 0x3B: 0x003B, 0x3C: 0x003C, 0x3D: 0x003D, 0x3E: 0x003E, 0x3F: 0x003F,
	0x40: 0x0040, 0x41: 0x0041, 0x42: 0x0042, 0x43: 0x0043, 0x44: 0x0044, 0x45: 0x0045, 0x46: 0x0046, 0x47: 0x0047,
	0x48: 0x0048, 0x49: 0x0049, 0x4A: 0x004A, 0x4B: 0x004B, 0x4C: 0x004C, 0x4D: 0x004D, 0x4E: 0x004E, 0x4F: 0x004F,
	0x50: 0x0050, 0x51: 0x0051, 0x52: 0x0052, 0x53: 0x0053, 0x54: 0x0054, 0x55: 0x0055, 0x56: 0x0056, 0x57: 0x0057,
	0x58: 0x0058, 0x59: 0x0059, 0x5A: 0x005A, 0x5B: 0x005B, 0x5C: 0x005C, 0x5D: 0x005D, 0x5E: 0x005E, 0x5F: 0x005F,
	0x60: 0x0060, 0x61: 0x0061, 0x62: 0x0062, 0x63: 0x0063, 0x64: 0x0064, 0x65: 0x0065, 0x66: 0x0066, 0x67: 0x0067,
	0x68: 0x0068, 0x69: 0x0069, 0x6A: 0x006A, 0x6B: 0x006B, 0x6C: 0x006C, 0x6D: 0x006D, 0x6E: 0x006E, 0x6F: 0x006F,
	0x70: 0x0070, 0x71: 0x0071, 0x72: 0x0072, 0x73: 0x0073, 0x74: 0x0074, 0x75: 0x0075, 0x76: 0x0076, 0x77: 0x0077,
	0x78: 0x0078, 0x79: 0x0079, 0x7A: 0x007A, 0x7B: 0x007B, 0x7C: 0x007C, 0x7D: 0x007D, 0x7E: 0x007E, 0x7F: 0x007F,
}

func initGBKTable() {
	commonGBK := []struct {
		gbk     byte
		unicode rune
	}{
		{0xA1, 0x3000}, {0xA2, 0x3001}, {0xA3, 0x3002}, {0xA4, 0x00B7}, {0xA5, 0x02C7}, {0xA6, 0x00B8}, {0xA7, 0x00A8}, {0xA8, 0x02CB},
		{0xA9, 0x00B0}, {0xAA, 0x00A4}, {0xAB, 0x00B6}, {0xAC, 0x00A7}, {0xAD, 0x00F7}, {0xAE, 0x00B1}, {0xAF, 0x2015},
		{0xB0, 0x4E00}, {0xB1, 0x4E01}, {0xB2, 0x4E02}, {0xB3, 0x4E03}, {0xB4, 0x4E04}, {0xB5, 0x4E05}, {0xB6, 0x4E06}, {0xB7, 0x4E07},
		{0xB8, 0x4E08}, {0xB9, 0x4E09}, {0xBA, 0x4E0A}, {0xBB, 0x4E0B}, {0xBC, 0x4E0C}, {0xBD, 0x4E0D}, {0xBE, 0x4E0E}, {0xBF, 0x4E0F},
		{0xC0, 0x4E10}, {0xC1, 0x4E11}, {0xC2, 0x4E12}, {0xC3, 0x4E13}, {0xC4, 0x4E14}, {0xC5, 0x4E15}, {0xC6, 0x4E16}, {0xC7, 0x4E17},
		{0xC8, 0x4E18}, {0xC9, 0x4E19}, {0xCA, 0x4E1A}, {0xCB, 0x4E1B}, {0xCC, 0x4E1C}, {0xCD, 0x4E1D}, {0xCE, 0x4E1E}, {0xCF, 0x4E1F},
		{0xD0, 0x4E20}, {0xD1, 0x4E21}, {0xD2, 0x4E22}, {0xD3, 0x4E23}, {0xD4, 0x4E24}, {0xD5, 0x4E25}, {0xD6, 0x4E26}, {0xD7, 0x4E27},
		{0xD8, 0x4E28}, {0xD9, 0x4E29}, {0xDA, 0x4E2A}, {0xDB, 0x4E2B}, {0xDC, 0x4E2C}, {0xDD, 0x4E2D}, {0xDE, 0x4E2E}, {0xDF, 0x4E2F},
		{0xE0, 0x4E30}, {0xE1, 0x4E31}, {0xE2, 0x4E32}, {0xE3, 0x4E34}, {0xE4, 0x4E35}, {0xE5, 0x4E36}, {0xE6, 0x4E37}, {0xE7, 0x4E38},
		{0xE8, 0x4E39}, {0xE9, 0x4E3A}, {0xEA, 0x4E3B}, {0xEB, 0x4E3C}, {0xEC, 0x4E3D}, {0xED, 0x4E3E}, {0xEE, 0x4E3F}, {0xEF, 0x4E40},
		{0xF0, 0x4E41}, {0xF1, 0x4E42}, {0xF2, 0x4E43}, {0xF3, 0x4E44}, {0xF4, 0x4E45}, {0xF5, 0x4E46}, {0xF6, 0x4E47}, {0xF7, 0x4E48},
		{0xF8, 0x4E49}, {0xF9, 0x4E4A}, {0xFA, 0x4E4B}, {0xFB, 0x4E4C}, {0xFC, 0x4E4D}, {0xFD, 0x4E4E}, {0xFE, 0x4E4F},
	}
	for _, v := range commonGBK {
		gbkToUnicode[v.gbk] = v.unicode
	}
}

func gbkDecode(byte1, byte2 byte) rune {
	if byte1 >= 0x81 && byte1 <= 0xFE && byte2 >= 0x40 && byte2 <= 0xFE {
		offset := (int(byte1-0x81) * 190) + int(byte2-0x40)
		if offset >= 0 && offset < 0x8000 {
			row := byte1
			cell := byte2
			if row >= 0xA1 && row <= 0xA9 {
				row -= 0xA1
				if cell >= 0xA1 && cell <= 0xFE {
					return gbkToUnicode[int(row)*94+int(cell-0xA1)+0x100]
				}
			} else if row >= 0xB0 && row <= 0xF7 {
				row -= 0xA6
				if cell >= 0xA1 && cell <= 0xFE {
					return gbkToUnicode[94+int(row)*94+int(cell-0xA1)+0x100]
				}
			}
		}
	}
	return rune(byte2)
}

func convertGBKToUTF8(text string) string {
	if text == "" {
		return text
	}

	hasHighBytes := false
	for i := 0; i < len(text); i++ {
		if text[i] >= 0x80 {
			hasHighBytes = true
			break
		}
	}

	if !hasHighBytes {
		return text
	}

	if containsValidUTF8Multibyte(text) {
		return text
	}

	var result strings.Builder
	result.Grow(len(text) * 2)

	i := 0
	for i < len(text) {
		b := text[i]
		if b < 0x80 {
			result.WriteByte(b)
			i++
		} else if b >= 0x81 && b <= 0xFE && i+1 < len(text) {
			gbkChar := gbkDecode(b, text[i+1])
			if gbkChar > 0 {
				result.WriteRune(gbkChar)
			} else {
				result.WriteByte(b)
				result.WriteByte(text[i+1])
			}
			i += 2
		} else if b >= 0xC0 && b <= 0xDF && i+1 < len(text) {
			result.WriteByte(b)
			result.WriteByte(text[i+1])
			i += 2
		} else {
			result.WriteByte(b)
			i++
		}
	}

	return result.String()
}

func convertToUTF8(text string) string {
	if text == "" {
		return text
	}

	if isValidUTF8(text) {
		return text
	}

	converted := convertGBKToUTF8(text)
	if converted != text {
		logging.LogWarnf("Converted text from GBK to UTF-8 (original length: %d, converted length: %d)", len(text), len(converted))
		return converted
	}

	logging.LogWarnf("Text has invalid encoding and cannot be converted (length: %d)", len(text))
	return text
}

// filterThinkTags 严格过滤思考过程标签
func filterThinkTags(text string) string {
	// 过滤闭合的 <think>...</think> 标签
	re := regexp.MustCompile(`(?s)<think>.*?</think>`)
	text = re.ReplaceAllString(text, "")
	// 过滤未闭合的 <think> 标签（如果模型输出了开头但没有结尾）
	re2 := regexp.MustCompile(`(?s)<think>.*$`)
	text = re2.ReplaceAllString(text, "")
	// 过滤可能的变体
	text = strings.ReplaceAll(text, "</think>", "")
	return strings.TrimSpace(text)
}

// MeetingService 会议纪要服务
type MeetingService struct{}

var Meeting = &MeetingService{}

// TranscribeAudioResponse 转录响应
type TranscribeAudioResponse struct {
	Transcription string `json:"transcription"`
	Summary       string `json:"summary"`
}

// TranscribeAudio 转录音频并生成摘要
func (s *MeetingService) TranscribeAudio(audioData []byte) (*TranscribeAudioResponse, error) {
	if len(audioData) == 0 {
		return nil, fmt.Errorf("audio data is empty")
	}

	logging.LogDebugf("TranscribeAudio: received audio data, size: %d bytes", len(audioData))

	// 1. 调用 ASR 服务 (假设使用本地 FunASR REST API)
	transcription, err := s.callASR(audioData)
	if err != nil {
		logging.LogErrorf("ASR failed: %v", err)
		return nil, err
	}

	// 移除 convertToUTF8 调用，JSON Unmarshal 得到的已经是 UTF-8 字符串
	// 强制转换会导致偶发的乱码问题 (False Positive GBK detection)
	logging.LogDebugf("ASR transcription result: '%s'", transcription)

	// 2. 调用 LLM 生成摘要
	summary := ""
	if transcription != "" {
		summary, err = s.GenerateSummary(transcription)
		if err != nil {
			logging.LogWarnf("Summary generation failed: %v", err)
		}
	}

	return &TranscribeAudioResponse{
		Transcription: transcription,
		Summary:       summary,
	}, nil
}

// cleanASRTags 清理 FunASR 返回的标签，只保留纯文本
// 包括语言标签 (<|zh|>, <|en|>, <|ja|>)、情感标签 (<|NEUTRAL|>, <|EMO_UNKNOWN|>)、
// 类型标签 (<|Speech|>, <|BGM|>)、格式标签 (<|withitn|>) 等
func cleanASRTags(text string) string {
	if text == "" {
		return text
	}

	// 使用正则表达式移除所有 <|...|> 格式的标签
	// 匹配 <| 和 |> 之间的任何内容
	re := regexp.MustCompile(`<\|[^|]*\|>`)
	cleaned := re.ReplaceAllString(text, "")

	// 清理多余的空格
	cleaned = strings.TrimSpace(cleaned)

	return cleaned
}

// callASR 调用 ASR 服务 (WebSocket 模式)
func (s *MeetingService) callASR(audioData []byte) (string, error) {
	// 补全末尾斜杠，有些服务器对路径很敏感
	asrURL := asrEndpoint

	// 1. 去除 WAV 头部 (44 bytes)，只发送纯 PCM 数据
	// 如果不去除，头部信息会被识别为刺耳噪音，导致开头乱码或识别错误
	pcmData := audioData
	if len(audioData) > 44 && string(audioData[:4]) == "RIFF" {
		// 解析 WAV 头部信息用于调试
		if len(audioData) >= 44 {
			// WAV 头部格式：
			// 0-3: "RIFF"
			// 4-7: file size - 8
			// 8-11: "WAVE"
			// 12-15: "fmt "
			// 16-19: fmt chunk size (通常是 16)
			// 20-21: audio format (1 = PCM)
			// 22-23: num channels
			// 24-27: sample rate
			// 28-31: byte rate
			// 32-33: block align
			// 34-35: bits per sample
			audioFormat := int(audioData[20]) | int(audioData[21])<<8
			numChannels := int(audioData[22]) | int(audioData[23])<<8
			sampleRate := int(audioData[24]) | int(audioData[25])<<8 | int(audioData[26])<<16 | int(audioData[27])<<24
			bitsPerSample := int(audioData[34]) | int(audioData[35])<<8
			logging.LogInfof("ASR: WAV header - format=%d, channels=%d, sampleRate=%d, bitsPerSample=%d",
				audioFormat, numChannels, sampleRate, bitsPerSample)
		}
		logging.LogDebugf("ASR: Detected WAV header, stripping first 44 bytes.")
		pcmData = audioData[44:]
	}

	logging.LogDebugf("ASR: Connecting to %s, PCM data size: %d bytes", asrURL, len(pcmData))

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 15 * time.Second

	conn, resp, err := dialer.Dial(asrURL, nil)
	if err != nil {
		status := "unknown"
		if resp != nil {
			status = resp.Status
			body, _ := io.ReadAll(resp.Body)
			logging.LogErrorf("ASR Handshake failed. Status: %s, Body: %s", status, string(body))
		}
		return "", fmt.Errorf("ASR WebSocket connection failed: %v (Status: %s)", err, status)
	}
	defer conn.Close()

	logging.LogDebugf("ASR: WebSocket connected successfully")

	// 2. 发送开始配置 (根据文档使用 2pass 模式)
	startConfig := map[string]interface{}{
		"mode":           "2pass",
		"chunk_size":     []int{5, 10, 5},
		"chunk_interval": 10,
		"wav_name":       "meeting",
		"is_speaking":    true,
	}
	if err := conn.WriteJSON(startConfig); err != nil {
		return "", fmt.Errorf("failed to send start config: %v", err)
	}

	// 准备收集结果
	var fullTranscriptBuilder bytes.Buffer
	// 暂存最新的流式中间结果，防止最后一句因未 finalize 而丢失
	var latestPartialText string

	// 3. 发送音频数据及结束信号。当前 FunASR 服务会在收到结束信号后再返回结果，
	// 因此顺序发送可避免写入协程错误被阻塞读取掩盖。
	logging.LogDebugf("ASR: Start sending PCM data (%d bytes)...", len(pcmData))
	if err := conn.SetWriteDeadline(time.Now().Add(asrWriteTimeout)); err != nil {
		return "", fmt.Errorf("设置 ASR 写入超时失败: %w", err)
	}
	const chunkSize = 64000
	for i := 0; i < len(pcmData); i += chunkSize {
		end := i + chunkSize
		if end > len(pcmData) {
			end = len(pcmData)
		}
		if err := conn.WriteMessage(websocket.BinaryMessage, pcmData[i:end]); err != nil {
			return "", fmt.Errorf("发送 ASR 音频分片失败: %w", err)
		}
	}

	logging.LogDebugf("ASR: Audio data sent, sending end signal...")
	if err := conn.WriteJSON(map[string]interface{}{"is_speaking": false}); err != nil {
		return "", fmt.Errorf("发送 ASR 结束信号失败: %w", err)
	}
	if err := conn.SetWriteDeadline(time.Time{}); err != nil {
		return "", fmt.Errorf("清除 ASR 写入超时失败: %w", err)
	}
	logging.LogDebugf("ASR: End signal sent.")

	// 4. 主协程循环读取识别结果。必须给底层连接设置读取 deadline，
	// 否则 ReadMessage 会阻塞，循环外的计时器无法打断它。
	if err := conn.SetReadDeadline(time.Now().Add(asrResultTimeout)); err != nil {
		return "", fmt.Errorf("设置 ASR 读取超时失败: %w", err)
	}

	messageCount := 0
	logging.LogDebugf("ASR: Waiting for recognition results...")

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				logging.LogWarnf("ASR: Timeout waiting for result after %s.", asrResultTimeout)
				return "", fmt.Errorf("ASR 识别超时（%s）", asrResultTimeout)
			}
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) || err == io.EOF {
				logging.LogDebugf("ASR connection closed normally.")
			} else {
				logging.LogDebugf("ASR connection read stop: %v", err)
			}

			// 连接关闭意味着转录结束，将最后未 finalize 的内容拼上去
			if latestPartialText != "" {
				logging.LogDebugf("ASR: Appending unfinalized tail: '%s'", latestPartialText)
				fullTranscriptBuilder.WriteString(latestPartialText)
			}
			// 清理 ASR 返回的标签
			rawText := fullTranscriptBuilder.String()
			cleanedText := cleanASRTags(rawText)
			logging.LogDebugf("ASR: Raw text length: %d, Cleaned text length: %d", len(rawText), len(cleanedText))
			return cleanedText, nil
		}

		messageCount++

		// 打印原始消息用于调试
		logging.LogDebugf("ASR: Raw message #%d: %s", messageCount, string(message))

		var result struct {
			Text    string `json:"text"`
			IsFinal bool   `json:"is_final"`
			Mode    string `json:"mode"`
		}
		if err := json.Unmarshal(message, &result); err != nil {
			logging.LogWarnf("Failed to parse ASR result: %v. Message: %s", err, string(message))
			continue
		}

		// 2pass 模式下，2pass-offline 的结果是最终的高质量识别结果
		// 需要收集这些结果，而不是等待 is_final=true 的空消息
		if result.Mode == "2pass-offline" && result.Text != "" {
			logging.LogDebugf("ASR: 2pass-offline result: '%s'", result.Text)
			fullTranscriptBuilder.WriteString(result.Text)
			latestPartialText = ""

			// 如果 is_final 为 true，说明识别完成，立即返回
			if result.IsFinal {
				logging.LogDebugf("ASR: Recognition completed with is_final=true")
				rawText := fullTranscriptBuilder.String()
				cleanedText := cleanASRTags(rawText)
				logging.LogDebugf("ASR: Raw text length: %d, Cleaned text length: %d", len(rawText), len(cleanedText))
				return cleanedText, nil
			}
		} else if result.IsFinal {
			logging.LogDebugf("ASR: Sentence finalized: '%s'", result.Text)
			if result.Text != "" {
				fullTranscriptBuilder.WriteString(result.Text)
			}
			// 此句话已经确定，清空暂存区
			latestPartialText = ""
			break
		} else {
			// 将中间结果暂存 (2pass-online 的实时结果)
			latestPartialText = result.Text
		}
	}

	rawText := fullTranscriptBuilder.String()
	cleanedText := cleanASRTags(rawText)
	return cleanedText, nil
}

// GenerateSummary 生成摘要
func (s *MeetingService) GenerateSummary(text string) (string, error) {
	// 动态加载配置（无需重启内核即可生效）
	cfg := loadMeetingLLMConfig()
	baseURL := strings.TrimSuffix(cfg.Endpoint, "/")
	llmURL := baseURL + "/chat/completions"

	logging.LogInfof("GenerateSummary: 使用模型 %s, endpoint %s, max_tokens %d", cfg.ModelName, baseURL, cfg.MaxTokens)

	prompt := fmt.Sprintf(`请将以下内容整理成一份准确、自然的内容摘要。

### 输出格式（必须严格遵循）：
要点：[用几句话概括原文实际讲到的内容]

### 待整理内容：
%s

### 要求：
1. 只输出以“要点：”开头的摘要，不要输出主题、后续、行动项等其他区块
2. 只总结原文实际讲到的内容，按照原文的讨论主线自然组织，不要强行分类
3. 保留原文中的重要人物、事件、数据、进展和观点，不要补充、推断或编造原文没有提到的信息
4. 不要为了凑条数扩展内容，不要输出开场白、解释、分析步骤、标签或思考过程`, text)

	payload := map[string]interface{}{
		"model": cfg.ModelName,
		"messages": []map[string]string{
			{"role": "system", "content": "你是专业的会议内容摘要助手。请按照原文的讨论主线，准确概括实际讲到的内容。只输出以“要点：”开头的摘要，不要强行分类、扩写或推断，不要输出主题、后续或行动项等其他区块，禁止使用<think>标签或展示思考过程，不要解释或添加开场白。"},
			{"role": "user", "content": prompt},
		},
		"stream":      false,
		"temperature": cfg.Temperature,
		"max_tokens":  cfg.MaxTokens,
		// 禁用 Qwen3/DeepSeek-R1 模型的思考模式，避免浪费 token
		"chat_template_kwargs": map[string]interface{}{
			"enable_thinking": false,
		},
	}

	jsonPayload, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", llmURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logging.LogErrorf("Failed to call LLM service at %s: %v", llmURL, err)
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		logging.LogErrorf("LLM service returned error status %d: %s (model=%s)", resp.StatusCode, string(bodyBytes), cfg.ModelName)
		return "", fmt.Errorf("LLM service returned status %d (model=%s)", resp.StatusCode, cfg.ModelName)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Choices) > 0 {
		rawSummary := result.Choices[0].Message.Content
		logging.LogInfof("GenerateSummary: LLM 原始响应 (len=%d): %s", len(rawSummary), rawSummary)
		// 严格过滤思考过程标签（包括未闭合的标签）
		summary := filterThinkTags(rawSummary)
		if summary == "" && rawSummary != "" {
			logging.LogWarnf("GenerateSummary: 过滤思考标签后内容为空，原始长度=%d", len(rawSummary))
		}
		logging.LogInfof("GenerateSummary: 过滤后摘要 (len=%d): %s", len(summary), summary)
		return summary, nil
	}
	return "", fmt.Errorf("no summary generated")
}
