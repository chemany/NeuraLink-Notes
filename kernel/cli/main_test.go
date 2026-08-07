package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRunHelpShowsCommands(t *testing.T) {
	var out strings.Builder

	code := run([]string{"help"}, &out, &out)

	if code != 0 {
		t.Fatalf("期望退出码为 0，实际为 %d", code)
	}
	text := out.String()
	for _, want := range []string{"health", "status", "status doctor", "env info", "env workspace", "log files", "log summary", "build scripts"} {
		if !strings.Contains(text, want) {
			t.Fatalf("help 输出缺少 %q：\n%s", want, text)
		}
	}
	if !strings.Contains(text, "siyuan-cli note notebooks [--addr http://127.0.0.1:6806] [--token TOKEN] [--json]") {
		t.Fatalf("help 输出未标明 note notebooks 支持 --json：\n%s", text)
	}
}

func TestRunStatusUsesExistingHTTPAPI(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.4.0"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":100,"details":"v3.4.0 Finishing boot..."}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}
	var out strings.Builder

	code := run([]string{"status", "--addr", "http://mock.local"}, &out, &out)

	if code != 0 {
		t.Fatalf("期望退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	text := out.String()
	for _, want := range []string{"服务可访问", "3.4.0", "100", "检查项: all"} {
		if !strings.Contains(text, want) {
			t.Fatalf("status 输出缺少 %q：\n%s", want, text)
		}
	}
}

func TestRunStatusJSONMode(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.4.1"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":88,"details":"warming"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}
	var out strings.Builder

	code := run([]string{"status", "--addr", "http://mock.local", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}

	var got statusOutput
	if err := json.Unmarshal([]byte(out.String()), &got); err != nil {
		t.Fatalf("status --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if !got.OK || got.Version != "3.4.1" || got.BootProgress != 88 || got.BootDetails != "warming" || got.Check != "all" || got.Strict {
		t.Fatalf("status --json 输出不符合预期: %+v", got)
	}
}

func TestRunStatusCheckBootOnly(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":66,"details":"loading"}}`), nil
				case "/api/system/version":
					return nil, errors.New("version should not be called")
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}
	var out strings.Builder

	code := run([]string{"status", "--addr", "http://mock.local", "--check", "boot", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 boot-only 检查退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}

	var got statusOutput
	if err := json.Unmarshal([]byte(out.String()), &got); err != nil {
		t.Fatalf("status --check boot --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if got.Check != "boot" || got.BootProgress != 66 || got.Version != "" || !got.OK {
		t.Fatalf("boot-only 输出不符合预期: %+v", got)
	}
}

func TestStatusDoctorJSONAggregatesReadonlyChecks(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.5.0"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":100,"details":"booted"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	for _, name := range []string{"conf", "data", "repo", "temp"} {
		if err := os.MkdirAll(filepath.Join(current, name), 0755); err != nil {
			t.Fatal(err)
		}
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(confDir, "workspace.json"), []byte("[\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}

	logDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(logDir, "b.log"), []byte("123456"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "a.log"), []byte("12"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"status", "doctor", "--addr", "http://mock.local", "--log-dir", logDir, "--workspace-validate", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 status doctor --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded doctorOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("status doctor --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if !decoded.OK || decoded.Status.Version != "3.5.0" || decoded.Logs.LargestPath == "" || len(decoded.Checks) != 3 {
		t.Fatalf("status doctor 聚合结果不符合预期: %+v", decoded)
	}
	if decoded.Workspace.Validation == nil || !decoded.Workspace.Validation.OK {
		t.Fatalf("status doctor 未带出 workspace validate: %+v", decoded.Workspace)
	}
}

func TestStatusDoctorStrictReturnsNonZero(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.5.1"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":80,"details":"warming"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	if err := os.MkdirAll(current, 0755); err != nil {
		t.Fatal(err)
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(confDir, "workspace.json"), []byte("[\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}
	logDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(logDir, "only.log"), []byte("123"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"status", "doctor", "--addr", "http://mock.local", "--log-dir", logDir, "--strict", "--json"}, &out, &out)
	if code != 1 {
		t.Fatalf("期望 status doctor --strict --json 退出码为 1，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded doctorOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("status doctor --strict --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.OK || decoded.Status.BootProgress != 80 {
		t.Fatalf("status doctor strict 结果不符合预期: %+v", decoded)
	}
}

func TestStatusDoctorTopLimitsLogSummaryInJSON(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.5.0"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":100,"details":"booted"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	if err := os.MkdirAll(current, 0755); err != nil {
		t.Fatal(err)
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(confDir, "workspace.json"), []byte("[\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}

	logDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(logDir, "small.log"), []byte("12"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "large.log"), []byte("123456"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "mid.log"), []byte("1234"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"status", "doctor", "--addr", "http://mock.local", "--log-dir", logDir, "--top", "2", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 status doctor --top 2 --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded doctorOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("status doctor --top 2 --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.Logs.Top != 2 || !decoded.Logs.Truncated || len(decoded.Logs.Entries) != 2 {
		t.Fatalf("status doctor top JSON 结果不符合预期: %+v", decoded.Logs)
	}
	if !strings.HasSuffix(decoded.Logs.Entries[0].Path, "large.log") || !strings.HasSuffix(decoded.Logs.Entries[1].Path, "mid.log") {
		t.Fatalf("status doctor top JSON 排序不符合预期: %+v", decoded.Logs.Entries)
	}
	if !strings.HasSuffix(decoded.Logs.LargestPath, "large.log") || decoded.Logs.LargestSize != 6 {
		t.Fatalf("status doctor top JSON 最大文件摘要不符合预期: %+v", decoded.Logs)
	}
}

func TestStatusDoctorTopShowsSummaryInText(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.5.0"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":100,"details":"booted"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	if err := os.MkdirAll(current, 0755); err != nil {
		t.Fatal(err)
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(confDir, "workspace.json"), []byte("[\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}

	logDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(logDir, "small.log"), []byte("12"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "large.log"), []byte("123456"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "mid.log"), []byte("1234"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"status", "doctor", "--addr", "http://mock.local", "--log-dir", logDir, "--top", "2"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 status doctor --top 2 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	text := out.String()
	for _, want := range []string{"诊断结果: 通过", "[OK] logs: files=3 total=12", "largest="} {
		if !strings.Contains(text, want) {
			t.Fatalf("status doctor --top 2 文本输出缺少 %q：\n%s", want, text)
		}
	}
}

func TestStatusDoctorRejectsNegativeTop(t *testing.T) {
	var out strings.Builder
	code := run([]string{"status", "doctor", "--top", "-1"}, &out, &out)
	if code != 1 {
		t.Fatalf("期望 status doctor --top -1 退出码为 1，实际为 %d，输出：\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "top 不能小于 0") {
		t.Fatalf("status doctor 负数 top 错误信息不符合预期：\n%s", out.String())
	}
}

func TestRunStatusStrictFailsWhenBootNotComplete(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/system/version":
					return jsonResponse(`{"code":0,"msg":"","data":"3.4.2"}`), nil
				case "/api/system/bootProgress":
					return jsonResponse(`{"code":0,"msg":"","data":{"progress":99,"details":"almost"}}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}
	var out strings.Builder

	code := run([]string{"status", "--addr", "http://mock.local", "--strict", "--json"}, &out, &out)
	if code != 1 {
		t.Fatalf("期望 strict 模式退出码为 1，实际为 %d，输出：\n%s", code, out.String())
	}

	var got statusOutput
	if err := json.Unmarshal([]byte(out.String()), &got); err != nil {
		t.Fatalf("status --strict --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if got.OK || !got.Strict || got.BootProgress != 99 {
		t.Fatalf("strict 模式输出不符合预期: %+v", got)
	}
}

func TestRunNoteCreateSendsCreateDocRequest(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	var gotMethod string
	var gotPath string
	var gotAuth string
	var gotContentType string
	var gotBody map[string]string
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotMethod = req.Method
				gotPath = req.URL.Path
				gotAuth = req.Header.Get("Authorization")
				gotContentType = req.Header.Get("Content-Type")
				body, err := io.ReadAll(req.Body)
				if err != nil {
					t.Fatalf("读取请求体失败: %v", err)
				}
				if err := json.Unmarshal(body, &gotBody); err != nil {
					t.Fatalf("请求体不是合法 JSON: %v", err)
				}
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260626123456-abcdefg"}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md", "# Hello",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("请求方法不符合预期: %s", gotMethod)
	}
	if gotPath != "/api/filetree/createDocWithMd" {
		t.Fatalf("请求路径不符合预期: %s", gotPath)
	}
	if gotAuth != "Bearer test-token" {
		t.Fatalf("Authorization 头不符合预期: %q", gotAuth)
	}
	if gotContentType != "application/json" {
		t.Fatalf("Content-Type 不符合预期: %q", gotContentType)
	}
	wantBody := map[string]string{
		"notebook": "nb1",
		"path":     "/foo/bar/测试标题",
		"title":    "测试标题",
		"markdown": "# Hello",
	}
	if len(gotBody) != len(wantBody) {
		t.Fatalf("请求体字段数量不符合预期: %+v", gotBody)
	}
	for key, want := range wantBody {
		if gotBody[key] != want {
			t.Fatalf("请求体字段 %s 不符合预期: got=%q want=%q body=%+v", key, gotBody[key], want, gotBody)
		}
	}
	if !strings.Contains(stdout.String(), "20260626123456-abcdefg") {
		t.Fatalf("stdout 未输出文档 ID：\n%s", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteCreateJSONMode(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260626160000-json123"}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb-json",
		"--path", "/json-path",
		"--title", "JSON测试标题",
		"--md", "# JSON",
		"--json",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create --json 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(stdout.String()), &got); err != nil {
		t.Fatalf("stdout 不是合法 JSON: %v\n%s", err, stdout.String())
	}
	if got["id"] != "20260626160000-json123" || got["title"] != "JSON测试标题" || got["path"] != "/json-path/JSON测试标题" || got["notebook"] != "nb-json" {
		t.Fatalf("JSON 输出不符合预期: %+v", got)
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteCreatePrintPathMode(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260626161000-print01"}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb-print",
		"--path", "/print-path",
		"--title", "打印路径测试",
		"--md", "# Print Path",
		"--print-path",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create --print-path 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	text := stdout.String()
	if !strings.Contains(text, "20260626161000-print01") {
		t.Fatalf("stdout 未输出文档 ID：\n%s", text)
	}
	if !strings.Contains(text, "最终路径: /print-path/打印路径测试") {
		t.Fatalf("stdout 未输出最终路径：\n%s", text)
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteNotebooksUsesExistingHTTPAPI(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	var gotMethod string
	var gotPath string
	var gotAuth string
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotMethod = req.Method
				gotPath = req.URL.Path
				gotAuth = req.Header.Get("Authorization")
				return jsonResponse(`{"code":0,"msg":"","data":{"notebooks":[{"id":"nb1","name":"收集箱","closed":false,"sort":1},{"id":"nb2","name":"归档","closed":true,"sort":9}]}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "notebooks",
		"--addr", "http://mock.local",
		"--token", "test-token",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note notebooks 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("请求方法不符合预期: %s", gotMethod)
	}
	if gotPath != "/api/notebook/lsNotebooks" {
		t.Fatalf("请求路径不符合预期: %s", gotPath)
	}
	if gotAuth != "Bearer test-token" {
		t.Fatalf("Authorization 头不符合预期: %q", gotAuth)
	}
	out := stdout.String()
	for _, want := range []string{
		"id=nb1 name=收集箱 closed=false sort=1",
		"id=nb2 name=归档 closed=true sort=9",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("stdout 未包含预期内容 %q：\n%s", want, out)
		}
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteNotebooksJSONMode(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":{"notebooks":[{"id":"nb1","name":"收集箱","closed":false,"sort":1},{"id":"nb2","name":"归档","closed":true,"sort":9}]}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "notebooks",
		"--addr", "http://mock.local",
		"--json",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note notebooks --json 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}

	var got []notebookInfo
	if err := json.Unmarshal([]byte(stdout.String()), &got); err != nil {
		t.Fatalf("note notebooks --json 输出不是合法 JSON: %v\n%s", err, stdout.String())
	}
	if len(got) != 2 || got[0].ID != "nb1" || got[0].Name != "收集箱" || got[1].ID != "nb2" || got[1].Name != "归档" {
		t.Fatalf("note notebooks --json 输出不符合预期: %+v", got)
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteNotebooksReturnsNonZeroWhenServiceCodeFails(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":-1,"msg":"ls notebooks failed","data":{"notebooks":[]}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "notebooks",
		"--addr", "http://mock.local",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note notebooks 服务失败时返回非零退出码，stdout:\n%s\nstderr:\n%s", stdout.String(), stderr.String())
	}
	if !strings.Contains(stderr.String(), "获取笔记本列表失败: ls notebooks failed") {
		t.Fatalf("stderr 未包含预期错误信息：\n%s", stderr.String())
	}
}

func TestRunNoteGetUsesExistingHTTPAPI(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	var gotMethod string
	var gotPath string
	var gotAuth string
	var gotContentType string
	var gotBody map[string]string
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotMethod = req.Method
				gotPath = req.URL.Path
				gotAuth = req.Header.Get("Authorization")
				gotContentType = req.Header.Get("Content-Type")
				body, err := io.ReadAll(req.Body)
				if err != nil {
					t.Fatalf("读取请求体失败: %v", err)
				}
				if err := json.Unmarshal(body, &gotBody); err != nil {
					t.Fatalf("请求体不是合法 JSON: %v", err)
				}
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260627090000-getdoc","rootID":"20260627090000-root","box":"nb1","path":"/foo/bar.sy","content":"<p>正文</p>","type":"NodeDocument","blockCount":3,"eof":true}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--id", "20260627090000-getdoc",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note get 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("请求方法不符合预期: %s", gotMethod)
	}
	if gotPath != "/api/filetree/getDoc" {
		t.Fatalf("请求路径不符合预期: %s", gotPath)
	}
	if gotAuth != "Bearer test-token" {
		t.Fatalf("Authorization 头不符合预期: %q", gotAuth)
	}
	if gotContentType != "application/json" {
		t.Fatalf("Content-Type 不符合预期: %q", gotContentType)
	}
	if len(gotBody) != 1 || gotBody["id"] != "20260627090000-getdoc" {
		t.Fatalf("请求体不符合预期: %+v", gotBody)
	}
	out := stdout.String()
	for _, want := range []string{
		"ID: 20260627090000-getdoc",
		"RootID: 20260627090000-root",
		"笔记本: nb1",
		"路径: /foo/bar.sy",
		"类型: NodeDocument",
		"块数: 3",
		"<p>正文</p>",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("stdout 未包含预期内容 %q：\n%s", want, out)
		}
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteGetJSONMode(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260627091000-json","rootID":"20260627091000-root","box":"nb-json","path":"/json/doc.sy","content":"<h1>JSON</h1>","type":"NodeDocument","blockCount":5,"keywords":["忽略"]}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--id", "20260627091000-json",
		"--json",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note get --json 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	var got noteGetOutput
	if err := json.Unmarshal([]byte(stdout.String()), &got); err != nil {
		t.Fatalf("note get --json 输出不是合法 JSON: %v\n%s", err, stdout.String())
	}
	if got.ID != "20260627091000-json" || got.RootID != "20260627091000-root" || got.Box != "nb-json" || got.Notebook != "nb-json" || got.Path != "/json/doc.sy" || got.Content != "<h1>JSON</h1>" || got.Type != "NodeDocument" || got.BlockCount != 5 {
		t.Fatalf("note get --json 输出不符合预期: %+v", got)
	}
	if strings.Contains(stdout.String(), "ID:") || strings.Contains(stdout.String(), "内容:") {
		t.Fatalf("stdout 被额外文本污染：\n%s", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteGetReturnsNonZeroWhenServiceCodeFails(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":3,"msg":"block not found","data":null}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--id", "missing-doc",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note get 服务失败时返回非零退出码，stdout:\n%s\nstderr:\n%s", stdout.String(), stderr.String())
	}
	if stdout.Len() != 0 {
		t.Fatalf("期望 stdout 为空，实际为：\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "获取文档失败: block not found") {
		t.Fatalf("stderr 未包含预期错误信息：\n%s", stderr.String())
	}
}

func TestRunNoteGetPrintsDashWhenPathIsEmpty(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260627092000-empty-path","rootID":"20260627092000-root","box":"nb-empty","path":"","content":"纯文本内容","type":"NodeDocument","blockCount":1}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--id", "20260627092000-empty-path",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望空路径文档退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "路径: -") {
		t.Fatalf("stdout 未将空路径打印为 -：\n%s", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteGetReturnsNonZeroWhenResponseIsInvalidJSON(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return jsonResponse(`{"code":0,"msg":"","data":`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--id", "invalid-json",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note get 在响应 JSON 非法时返回非零退出码，stdout:\n%s\nstderr:\n%s", stdout.String(), stderr.String())
	}
	if stdout.Len() != 0 {
		t.Fatalf("期望 stdout 为空，实际为：\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "获取文档失败:") {
		t.Fatalf("stderr 未包含预期错误前缀：\n%s", stderr.String())
	}
}

func TestRunNoteGetRequiresID(t *testing.T) {
	var stdout strings.Builder
	var stderr strings.Builder

	code := run([]string{
		"note", "get",
		"--addr", "http://mock.local",
		"--token", "test-token",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望缺少 --id 时返回非零退出码，stdout:\n%s\nstderr:\n%s", stdout.String(), stderr.String())
	}
	if stdout.Len() != 0 {
		t.Fatalf("期望 stdout 为空，实际为：\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "获取文档失败: 必须提供 --id") {
		t.Fatalf("stderr 未包含缺少 --id 的错误信息：\n%s", stderr.String())
	}
}

func TestRunNoteCreateWithMDFileSendsFileContent(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	mdFile := filepath.Join(t.TempDir(), "doc.md")
	if err := os.WriteFile(mdFile, []byte("# 从文件读取\n\n第二行"), 0644); err != nil {
		t.Fatalf("写入测试 Markdown 文件失败: %v", err)
	}

	var gotBody map[string]string
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				body, err := io.ReadAll(req.Body)
				if err != nil {
					t.Fatalf("读取请求体失败: %v", err)
				}
				if err := json.Unmarshal(body, &gotBody); err != nil {
					t.Fatalf("请求体不是合法 JSON: %v", err)
				}
				return jsonResponse(`{"code":0,"msg":"","data":{"id":"20260626131415-hijklmn"}}`), nil
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md-file", mdFile,
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create --md-file 退出码为 0，实际为 %d，stderr:\n%s", code, stderr.String())
	}
	if gotBody["markdown"] != "# 从文件读取\n\n第二行" {
		t.Fatalf("请求体 markdown 不符合预期: %+v", gotBody)
	}
	if gotBody["path"] != "/foo/bar/测试标题" {
		t.Fatalf("请求体 path 未自动拼接标题: %+v", gotBody)
	}
	if !strings.Contains(stdout.String(), "20260626131415-hijklmn") {
		t.Fatalf("stdout 未输出文档 ID：\n%s", stdout.String())
	}
}

func TestRunNoteCreateLookupLatestDocIDWhenCreateReturnsNull(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	var paths []string
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				paths = append(paths, req.URL.Path)
				switch req.URL.Path {
				case "/api/filetree/createDocWithMd":
					return jsonResponse(`{"code":0,"msg":"","data":null}`), nil
				case "/api/filetree/searchDocs":
					return jsonResponse(`{"code":0,"msg":"","data":[{"box":"nb1","hPath":"foo/bar/测试标题","path":"/20260626150000-old.sy"},{"box":"nb1","hPath":"foo/bar/测试标题","path":"/20260626150001-new.sy"}]}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md", "# Hello",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create 在 data=null 且可回查时成功，实际=%d stderr=%s", code, stderr.String())
	}
	if len(paths) != 2 || paths[0] != "/api/filetree/createDocWithMd" || paths[1] != "/api/filetree/searchDocs" {
		t.Fatalf("请求链路不符合预期: %+v", paths)
	}
	if !strings.Contains(stdout.String(), "20260626150001-new") {
		t.Fatalf("stdout 未输出最新回查得到的文档 ID：\n%s", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteCreateLookupDocIDWhenCreateReturnsNull(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	var paths []string
	var searchReq searchDocsRequest
	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				paths = append(paths, req.URL.Path)
				switch req.URL.Path {
				case "/api/filetree/createDocWithMd":
					return jsonResponse(`{"code":0,"msg":"","data":null}`), nil
				case "/api/filetree/searchDocs":
					body, err := io.ReadAll(req.Body)
					if err != nil {
						t.Fatalf("读取回查请求体失败: %v", err)
					}
					if err := json.Unmarshal(body, &searchReq); err != nil {
						t.Fatalf("回查请求体不是合法 JSON: %v", err)
					}
					return jsonResponse(`{"code":0,"msg":"","data":[{"box":"nb1","hPath":"foo/bar/测试标题","path":"/20260626150000-lookup01.sy"},{"box":"nb1","hPath":"foo/bar/其他标题","path":"/other.sy"}]}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md", "# Hello",
	}, &stdout, &stderr)

	if code != 0 {
		t.Fatalf("期望 note create 在 data=null 且可回查时成功，实际=%d stderr=%s", code, stderr.String())
	}
	if len(paths) != 2 || paths[0] != "/api/filetree/createDocWithMd" || paths[1] != "/api/filetree/searchDocs" {
		t.Fatalf("请求链路不符合预期: %+v", paths)
	}
	if searchReq.Keyword != "测试标题" {
		t.Fatalf("回查请求体不符合预期: %+v", searchReq)
	}
	if !strings.Contains(stdout.String(), "20260626150000-lookup01") {
		t.Fatalf("stdout 未输出回查得到的文档 ID：\n%s", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("期望 stderr 为空，实际为：\n%s", stderr.String())
	}
}

func TestRunNoteCreateFailsWhenLookupDocIDMissesTitle(t *testing.T) {
	oldFactory := newHTTPClient
	defer func() {
		newHTTPClient = oldFactory
	}()

	newHTTPClient = func(timeout time.Duration) *http.Client {
		return &http.Client{
			Timeout: timeout,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/filetree/createDocWithMd":
					return jsonResponse(`{"code":0,"msg":"","data":null}`), nil
				case "/api/filetree/searchDocs":
					return jsonResponse(`{"code":0,"msg":"","data":[{"box":"nb1","hPath":"foo/bar/其他标题","path":"/other.sy"}]}`), nil
				default:
					return nil, errors.New("unexpected path: " + req.URL.Path)
				}
			}),
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md", "# Hello",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note create 在回查不到标题时失败，stdout=%s stderr=%s", stdout.String(), stderr.String())
	}
	if !strings.Contains(stderr.String(), `创建成功但未找到标题为 "测试标题" 的文档 ID`) {
		t.Fatalf("stderr 未包含预期错误信息：\n%s", stderr.String())
	}
}

func TestJoinDocCreatePath(t *testing.T) {
	tests := []struct {
		name   string
		parent string
		title  string
		want   string
	}{
		{name: "普通父路径", parent: "/foo/bar", title: "测试标题", want: "/foo/bar/测试标题"},
		{name: "根路径", parent: "/", title: "测试标题", want: "/测试标题"},
		{name: "自动补前导斜杠与去尾斜杠", parent: "foo/bar/", title: "测试标题", want: "/foo/bar/测试标题"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := joinDocCreatePath(tt.parent, tt.title); got != tt.want {
				t.Fatalf("joinDocCreatePath()=%q want=%q", got, tt.want)
			}
		})
	}
}

func TestRunNoteCreateRejectsMDAndMDFileConflict(t *testing.T) {
	mdFile := filepath.Join(t.TempDir(), "doc.md")
	if err := os.WriteFile(mdFile, []byte("# Hello"), 0644); err != nil {
		t.Fatalf("写入测试 Markdown 文件失败: %v", err)
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
		"--md", "# Inline",
		"--md-file", mdFile,
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note create 在 --md 与 --md-file 同时提供时失败，stdout=%s stderr=%s", stdout.String(), stderr.String())
	}
	if !strings.Contains(stderr.String(), "--md 与 --md-file 不能同时提供") {
		t.Fatalf("stderr 未包含预期错误信息：\n%s", stderr.String())
	}
}

func TestRunNoteCreateRejectsMissingMDAndMDFile(t *testing.T) {
	var stdout strings.Builder
	var stderr strings.Builder
	code := run([]string{
		"note", "create",
		"--addr", "http://mock.local",
		"--token", "test-token",
		"--notebook", "nb1",
		"--path", "/foo/bar",
		"--title", "测试标题",
	}, &stdout, &stderr)

	if code == 0 {
		t.Fatalf("期望 note create 在未提供 --md 与 --md-file 时失败，stdout=%s stderr=%s", stdout.String(), stderr.String())
	}
	if !strings.Contains(stderr.String(), "必须提供 --md 或 --md-file 其中之一") {
		t.Fatalf("stderr 未包含预期错误信息：\n%s", stderr.String())
	}
}

func TestRunNoteCreateReturnsNonZeroOnFailures(t *testing.T) {
	cases := []struct {
		name       string
		response   *http.Response
		err        error
		wantStderr string
	}{
		{
			name:       "service code",
			response:   jsonResponse(`{"code":-1,"msg":"create failed","data":{"id":""}}`),
			wantStderr: "create failed",
		},
		{
			name: "http status",
			response: &http.Response{
				StatusCode: http.StatusBadGateway,
				Header:     make(http.Header),
				Body:       io.NopCloser(bytes.NewBufferString(`upstream unavailable`)),
			},
			wantStderr: "HTTP 502",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			oldFactory := newHTTPClient
			defer func() {
				newHTTPClient = oldFactory
			}()
			newHTTPClient = func(timeout time.Duration) *http.Client {
				return &http.Client{
					Timeout: timeout,
					Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
						return tc.response, tc.err
					}),
				}
			}

			var stdout strings.Builder
			var stderr strings.Builder
			code := run([]string{
				"note", "create",
				"--addr", "http://mock.local",
				"--token", "test-token",
				"--notebook", "nb1",
				"--path", "/foo/bar",
				"--title", "测试标题",
				"--md", "# Hello",
			}, &stdout, &stderr)

			if code == 0 {
				t.Fatalf("期望 note create 失败，stdout=%s stderr=%s", stdout.String(), stderr.String())
			}
			if !strings.Contains(stderr.String(), tc.wantStderr) {
				t.Fatalf("stderr 未包含预期错误信息 %q：\n%s", tc.wantStderr, stderr.String())
			}
		})
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewBufferString(body)),
	}
}

func TestRunEnvInfoShowsPaths(t *testing.T) {
	var out strings.Builder

	code := run([]string{"env", "info"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 env info 退出码为 0，实际为 %d", code)
	}
	text := out.String()
	for _, want := range []string{"项目根目录", "kernel 目录", "workspace.json"} {
		if !strings.Contains(text, want) {
			t.Fatalf("env info 输出缺少 %q：\n%s", want, text)
		}
	}
}

func TestReadWorkspaceInfoAndEnvWorkspaceJSON(t *testing.T) {
	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	older := filepath.Join(home, "ws-older")
	if err := os.MkdirAll(current, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(older, 0755); err != nil {
		t.Fatal(err)
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	confPath := filepath.Join(confDir, "workspace.json")
	if err := os.WriteFile(confPath, []byte("[\""+older+"\",\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}

	got, err := readWorkspaceInfo()
	if err != nil {
		t.Fatalf("readWorkspaceInfo 失败: %v", err)
	}
	if !got.Exists || got.Current != current || !got.CurrentExists || len(got.Recent) != 2 {
		t.Fatalf("workspace 信息不符合预期: %+v", got)
	}

	var out strings.Builder
	code := run([]string{"env", "workspace", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 env workspace --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded workspaceOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("env workspace --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.Current != current || decoded.CurrentSource != "last_recent" {
		t.Fatalf("env workspace --json 输出不符合预期: %+v", decoded)
	}
}

func TestEnvWorkspaceValidateIncludesExpectedDirs(t *testing.T) {
	home := t.TempDir()
	oldHomeEnv := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHomeEnv)
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(home, "ws-current")
	if err := os.MkdirAll(filepath.Join(current, "conf"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(current, "data"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(current, "repo"), 0755); err != nil {
		t.Fatal(err)
	}
	confDir := filepath.Join(home, ".config", "siyuan")
	if err := os.MkdirAll(confDir, 0755); err != nil {
		t.Fatal(err)
	}
	confPath := filepath.Join(confDir, "workspace.json")
	if err := os.WriteFile(confPath, []byte("[\""+current+"\"]"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"env", "workspace", "--validate", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 env workspace --validate --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded workspaceOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("env workspace --validate --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.Validation == nil || decoded.Validation.OK || decoded.Validation.MissingCount != 1 {
		t.Fatalf("workspace validate 结果不符合预期: %+v", decoded.Validation)
	}
	if len(decoded.Validation.ExpectedDirs) != 4 {
		t.Fatalf("expectedDirs 数量不符合预期: %+v", decoded.Validation.ExpectedDirs)
	}
}

func TestLogInfoFilesAndTailReadKnownFiles(t *testing.T) {
	dir := t.TempDir()
	outLog := filepath.Join(dir, "siyuan-out.log")
	errLog := filepath.Join(dir, "siyuan-error.log")
	if err := os.WriteFile(outLog, []byte("一\n二\n三\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(errLog, []byte("err line\n"), 0644); err != nil {
		t.Fatal(err)
	}
	var infoOut strings.Builder

	code := run([]string{"log", "info", "--log-dir", dir}, &infoOut, &infoOut)

	if code != 0 {
		t.Fatalf("期望 log info 退出码为 0，实际为 %d", code)
	}
	if !strings.Contains(infoOut.String(), "siyuan-out.log") {
		t.Fatalf("log info 未输出日志文件名：\n%s", infoOut.String())
	}

	var filesOut strings.Builder
	code = run([]string{"log", "files", "--log-dir", dir}, &filesOut, &filesOut)
	if code != 0 {
		t.Fatalf("期望 log files 退出码为 0，实际为 %d，输出：\n%s", code, filesOut.String())
	}
	if !strings.Contains(filesOut.String(), "siyuan-error.log") || !strings.Contains(filesOut.String(), "siyuan-out.log") {
		t.Fatalf("log files 未列出日志文件：\n%s", filesOut.String())
	}

	var filesJSONOut strings.Builder
	code = run([]string{"log", "files", "--log-dir", dir, "--json"}, &filesJSONOut, &filesJSONOut)
	if code != 0 {
		t.Fatalf("期望 log files --json 退出码为 0，实际为 %d，输出：\n%s", code, filesJSONOut.String())
	}
	var entries []logFileEntry
	if err := json.Unmarshal([]byte(filesJSONOut.String()), &entries); err != nil {
		t.Fatalf("log files --json 不是合法 JSON: %v\n%s", err, filesJSONOut.String())
	}
	if len(entries) != 2 {
		t.Fatalf("log files --json 条目数不符合预期: %+v", entries)
	}

	var tailOut strings.Builder
	code = run([]string{"log", "tail", "--log-dir", dir, "--file", "out", "--lines", "2"}, &tailOut, &tailOut)

	if code != 0 {
		t.Fatalf("期望 log tail 退出码为 0，实际为 %d，输出：\n%s", code, tailOut.String())
	}
	text := tailOut.String()
	if strings.Contains(text, "一") || !strings.Contains(text, "二") || !strings.Contains(text, "三") {
		t.Fatalf("tail 输出不符合预期：\n%s", text)
	}

	var filteredOut strings.Builder
	code = run([]string{"log", "tail", "--log-dir", dir, "--file", "out", "--lines", "3", "--contains", "三"}, &filteredOut, &filteredOut)
	if code != 0 {
		t.Fatalf("期望 log tail --contains 退出码为 0，实际为 %d，输出：\n%s", code, filteredOut.String())
	}
	if !strings.Contains(filteredOut.String(), "过滤关键字: 三") || !strings.Contains(filteredOut.String(), "三") || strings.Contains(filteredOut.String(), "二\n") {
		t.Fatalf("log tail --contains 输出不符合预期：\n%s", filteredOut.String())
	}
}

func TestLogSummaryAggregatesEntries(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "siyuan-out.log"), []byte("12345"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "siyuan-error.log"), []byte("1234567"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"log", "summary", "--log-dir", dir, "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 log summary --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded logSummaryOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("log summary --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.TotalFiles != 2 || decoded.TotalSize != 12 || len(decoded.Entries) != 2 || decoded.LargeCount != 0 {
		t.Fatalf("log summary 聚合结果不符合预期: %+v", decoded)
	}
}

func TestBuildCommandsShowSafeInfoOnly(t *testing.T) {
	var out strings.Builder

	code := run([]string{"build", "dry-run"}, &out, &out)

	if code != 0 {
		t.Fatalf("期望退出码为 0，实际为 %d", code)
	}
	text := out.String()
	if !strings.Contains(text, "/root/code/neu-siyuan-note/rebuild-and-restart.sh") {
		t.Fatalf("dry-run 未输出构建脚本路径：\n%s", text)
	}
	if !strings.Contains(text, "不会执行") {
		t.Fatalf("dry-run 未说明只输出不执行：\n%s", text)
	}

	out.Reset()
	code = run([]string{"build", "scripts"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 build scripts 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "rebuild-and-restart.sh") {
		t.Fatalf("build scripts 未输出构建脚本：\n%s", out.String())
	}
}

func TestLogSummaryTopLimitsLargestEntries(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "small.log"), []byte("12"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "large.log"), []byte("123456"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "mid.log"), []byte("1234"), 0644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	code := run([]string{"log", "summary", "--log-dir", dir, "--top", "2", "--json"}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 log summary --top 2 --json 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	var decoded logSummaryOutput
	if err := json.Unmarshal([]byte(out.String()), &decoded); err != nil {
		t.Fatalf("log summary --top 2 --json 不是合法 JSON: %v\n%s", err, out.String())
	}
	if decoded.Top != 2 || !decoded.Truncated || len(decoded.Entries) != 2 {
		t.Fatalf("log summary top 结果不符合预期: %+v", decoded)
	}
	if !strings.HasSuffix(decoded.Entries[0].Path, "large.log") || !strings.HasSuffix(decoded.Entries[1].Path, "mid.log") {
		t.Fatalf("log summary top 排序不符合预期: %+v", decoded.Entries)
	}
}

func TestLogSummaryRejectsNegativeTop(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "only.log"), []byte("123"), 0644); err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	code := run([]string{"log", "summary", "--log-dir", dir, "--top", "-1"}, &out, &out)
	if code != 1 {
		t.Fatalf("期望 log summary --top -1 退出码为 1，实际为 %d，输出：\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "top 不能小于 0") {
		t.Fatalf("负数 top 错误信息不符合预期：\n%s", out.String())
	}
}

func TestLogInfoShowsDiscoveredCount(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "one.log"), []byte("1"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "two.log"), []byte("22"), 0644); err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	code := run([]string{"log", "info", "--log-dir", dir}, &out, &out)
	if code != 0 {
		t.Fatalf("期望 log info 退出码为 0，实际为 %d，输出：\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "发现文件数: 2") {
		t.Fatalf("log info 未输出发现文件数：\n%s", out.String())
	}
}
