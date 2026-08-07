package model

import "testing"

func TestMergeDefaultAIConfigAppliesBaseURLWithoutAPIKey(t *testing.T) {
	apiKey, apiBaseURL, apiModel, maxTokens, temperature, provider, systemPrompt := mergeDefaultAIConfig(
		"USE_DEFAULT_CONFIG",
		"USE_DEFAULT_CONFIG",
		"USE_DEFAULT_CONFIG",
		0,
		0,
		"openai",
		"",
		DefaultModelConfig{
			Provider:     "llamacpp",
			APIKey:       "",
			BaseURL:      "http://localhost:8081/v1",
			ModelName:    "Qwen3.6-35B-A3B-UD-Q4_K_M",
			Temperature:  0.6,
			MaxTokens:    3500,
			SystemPrompt: "你是思源笔记的AI助手。",
		},
	)

	if apiKey != "USE_DEFAULT_CONFIG" {
		t.Fatalf("apiKey = %q, want USE_DEFAULT_CONFIG", apiKey)
	}
	if apiBaseURL != "http://localhost:8081/v1" {
		t.Fatalf("apiBaseURL = %q, want http://localhost:8081/v1", apiBaseURL)
	}
	if apiModel != "Qwen3.6-35B-A3B-UD-Q4_K_M" {
		t.Fatalf("apiModel = %q, want Qwen3.6-35B-A3B-UD-Q4_K_M", apiModel)
	}
	if maxTokens != 3500 {
		t.Fatalf("maxTokens = %d, want 3500", maxTokens)
	}
	if temperature != 0.6 {
		t.Fatalf("temperature = %v, want 0.6", temperature)
	}
	if provider != "llamacpp" {
		t.Fatalf("provider = %q, want llamacpp", provider)
	}
	if systemPrompt != "你是思源笔记的AI助手。" {
		t.Fatalf("systemPrompt = %q, want 你是思源笔记的AI助手。", systemPrompt)
	}
}
