package model

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
)

func TestQueryUmiOCRResultRequestsCompleteText(t *testing.T) {
	hit := int32(0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/doc/result" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		atomic.AddInt32(&hit, 1)

		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		if req["id"] != "task-1" {
			t.Fatalf("unexpected task id: %v", req["id"])
		}
		if req["format"] != "text" {
			t.Fatalf("unexpected format: %v", req["format"])
		}
		if req["is_data"] != true {
			t.Fatalf("is_data should be true, got: %v", req["is_data"])
		}
		if req["is_unread"] != false {
			t.Fatalf("is_unread should be false to fetch complete text, got: %v", req["is_unread"])
		}

		_, _ = w.Write([]byte(`{"code":100,"is_done":true,"state":"success","data":"full ocr text","pages_count":8}`))
	}))
	defer srv.Close()

	done, state, text, pages, err := queryUmiOCRResult(srv.URL, "task-1")
	if err != nil {
		t.Fatalf("queryUmiOCRResult returned error: %v", err)
	}
	if !done || state != "success" || text != "full ocr text" || pages != 8 {
		t.Fatalf("unexpected result: done=%v state=%s text=%q pages=%d", done, state, text, pages)
	}
	if atomic.LoadInt32(&hit) != 1 {
		t.Fatalf("expected 1 request, got %d", hit)
	}
}

func TestClearUmiOCRTaskUsesTaskSpecificEndpoint(t *testing.T) {
	var method string
	var path string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method = r.Method
		path = r.URL.Path
		_, _ = w.Write([]byte(`{"code":100,"data":"Success"}`))
	}))
	defer srv.Close()

	clearUmiOCRTask(srv.URL, "task-xyz")

	if method != http.MethodGet {
		t.Fatalf("expected GET, got %s", method)
	}
	if path != "/api/doc/clear/task-xyz" {
		t.Fatalf("unexpected path: %s", path)
	}
}

func TestUploadPDFToUmiOCRUsesOptimizedDocOptions(t *testing.T) {
	var gotOptions map[string]interface{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/doc/upload" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		if err := r.ParseMultipartForm(20 << 20); err != nil {
			t.Fatalf("parse multipart form: %v", err)
		}

		cfg := r.FormValue("json")
		if cfg == "" {
			t.Fatalf("missing json options in multipart form")
		}
		if err := json.Unmarshal([]byte(cfg), &gotOptions); err != nil {
			t.Fatalf("unmarshal options: %v", err)
		}

		_, _ = w.Write([]byte(`{"code":100,"data":"task-id"}`))
	}))
	defer srv.Close()

	dir := t.TempDir()
	pdfPath := filepath.Join(dir, "test.pdf")
	if err := os.WriteFile(pdfPath, []byte("fake pdf"), 0644); err != nil {
		t.Fatalf("write temp pdf: %v", err)
	}

	id, err := uploadPDFToUmiOCR(srv.URL, pdfPath)
	if err != nil {
		t.Fatalf("uploadPDFToUmiOCR error: %v", err)
	}
	if id != "task-id" {
		t.Fatalf("unexpected task id: %s", id)
	}

	if gotOptions["doc.extractionMode"] != "fullPage" {
		t.Fatalf("unexpected extraction mode: %v", gotOptions["doc.extractionMode"])
	}
	if gotOptions["ocr.language"] != "models/config_chinese.txt" {
		t.Fatalf("unexpected language: %v", gotOptions["ocr.language"])
	}
	if gotOptions["tbpu.parser"] != "multi_para" {
		t.Fatalf("unexpected parser: %v", gotOptions["tbpu.parser"])
	}
	if gotOptions["ocr.cls"] != true {
		t.Fatalf("unexpected ocr.cls: %v", gotOptions["ocr.cls"])
	}
	if sideLen, ok := gotOptions["ocr.limit_side_len"].(float64); !ok || int(sideLen) != 2880 {
		t.Fatalf("unexpected ocr.limit_side_len: %v", gotOptions["ocr.limit_side_len"])
	}
}
