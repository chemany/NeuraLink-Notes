package model

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func usePaddleOCRModelConfig(t *testing.T, baseURL, modelName string) {
	t.Helper()

	configData, err := json.Marshal(map[string]map[string]interface{}{
		PaddleOCRModelConfigKey: {
			"base_url":   baseURL,
			"model_name": modelName,
			"enabled":    true,
		},
	})
	if err != nil {
		t.Fatalf("serialize model config: %v", err)
	}

	configPath := filepath.Join(t.TempDir(), "default-models.json")
	if err := os.WriteFile(configPath, configData, 0o600); err != nil {
		t.Fatalf("write model config: %v", err)
	}

	originalPath := paddleOCRModelsConfigPath
	paddleOCRModelsConfigPath = configPath
	t.Cleanup(func() {
		paddleOCRModelsConfigPath = originalPath
	})
}

func TestPaddleOCRFromBase64UsesUnifiedModelConfig(t *testing.T) {
	const modelName = "PP-OCRv5"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		var request struct {
			Model    string `json:"model"`
			Messages []struct {
				Content []struct {
					Type     string `json:"type"`
					ImageURL struct {
						URL string `json:"url"`
					} `json:"image_url"`
				} `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if request.Model != modelName {
			t.Fatalf("model = %q, want %q", request.Model, modelName)
		}
		if len(request.Messages) != 1 || len(request.Messages[0].Content) == 0 || request.Messages[0].Content[0].ImageURL.URL != "data:image/png;base64,aGVsbG8=" {
			t.Fatalf("unexpected image request: %#v", request.Messages)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"PaddleOCR 识别结果"}}]}`))
	}))
	defer srv.Close()
	usePaddleOCRModelConfig(t, srv.URL+"/", modelName)

	result, err := PaddleOCRFromBase64("aGVsbG8=")
	if err != nil {
		t.Fatalf("PaddleOCRFromBase64 returned error: %v", err)
	}
	if len(result.Data) != 1 || result.Data[0].Text != "PaddleOCR 识别结果" {
		t.Fatalf("unexpected OCR result: %#v", result)
	}
}

func TestPaddleOCRHealthCheckUsesHealthz(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/healthz" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer srv.Close()
	usePaddleOCRModelConfig(t, srv.URL, DefaultPaddleOCRModelName)

	healthy, message := PaddleOCRHealthCheck()
	if !healthy {
		t.Fatalf("PaddleOCRHealthCheck returned false: %s", message)
	}
}
