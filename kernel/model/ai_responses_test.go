package model

import "testing"

func TestShouldUseResponsesAPI(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		provider string
		want     bool
	}{
		{
			name:     "detect by base url suffix",
			baseURL:  "https://api.with7.cn/chatgpt/v1/responses",
			provider: "openai",
			want:     true,
		},
		{
			name:     "detect by provider flag",
			baseURL:  "https://api.openai.com/v1",
			provider: "openai-responses",
			want:     true,
		},
		{
			name:     "normal chat completions",
			baseURL:  "https://api.openai.com/v1",
			provider: "openai",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldUseResponsesAPI(tt.baseURL, tt.provider); got != tt.want {
				t.Fatalf("shouldUseResponsesAPI() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractResponsesOutputText(t *testing.T) {
	payload := []byte(`{
  "output": [
    {
      "type": "reasoning",
      "summary": []
    },
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "第一段。"
        },
        {
          "type": "output_text",
          "text": "第二段。"
        }
      ]
    }
  ]
}`)

	got, err := extractResponsesOutputText(payload)
	if err != nil {
		t.Fatalf("extractResponsesOutputText() returned error: %v", err)
	}

	want := "第一段。\n第二段。"
	if got != want {
		t.Fatalf("extractResponsesOutputText() = %q, want %q", got, want)
	}
}
