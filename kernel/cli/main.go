package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	defaultAddr   = "http://127.0.0.1:6806"
	defaultLogDir = "/root/code/pm2-apps/logs"
)

var newHTTPClient = func(timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout}
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		printHelp(stdout)
		return 0
	}

	switch args[0] {
	case "help", "-h", "--help":
		printHelp(stdout)
		return 0
	case "health", "status":
		return runStatus(args[1:], stdout, stderr)
	case "log":
		return runLog(args[1:], stdout, stderr)
	case "build", "rebuild":
		return runBuild(args[1:], stdout, stderr)
	case "note":
		return runNote(args[1:], stdout, stderr)
	case "env", "config", "info":
		return runEnv(args[1:], stdout, stderr)
	default:
		fmt.Fprintf(stderr, "未知命令: %s\n\n", args[0])
		printHelp(stderr)
		return 1
	}
}

func printHelp(w io.Writer) {
	fmt.Fprintln(w, "灵枢笔记最小 CLI")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "用法:")
	fmt.Fprintln(w, "  siyuan-cli help")
	fmt.Fprintln(w, "  siyuan-cli status [--addr http://127.0.0.1:6806] [--json] [--check version|boot|all] [--strict]")
	fmt.Fprintln(w, "  siyuan-cli health [--addr http://127.0.0.1:6806] [--json] [--check version|boot|all] [--strict]")
	fmt.Fprintln(w, "  siyuan-cli status doctor [--addr http://127.0.0.1:6806] [--log-dir /root/code/pm2-apps/logs] [--json] [--strict] [--workspace-validate] [--top N]")
	fmt.Fprintln(w, "  siyuan-cli env info")
	fmt.Fprintln(w, "  siyuan-cli env workspace [--json] [--validate]")
	fmt.Fprintln(w, "  siyuan-cli log info [--log-dir /root/code/pm2-apps/logs]")
	fmt.Fprintln(w, "  siyuan-cli log files [--log-dir /root/code/pm2-apps/logs] [--json]")
	fmt.Fprintln(w, "  siyuan-cli log summary [--log-dir /root/code/pm2-apps/logs] [--json] [--top N]")
	fmt.Fprintln(w, "  siyuan-cli log tail [--log-dir /root/code/pm2-apps/logs] [--file out|error|kernel|/绝对路径] [--lines 100] [--contains 关键词]")
	fmt.Fprintln(w, "  siyuan-cli build info")
	fmt.Fprintln(w, "  siyuan-cli build scripts")
	fmt.Fprintln(w, "  siyuan-cli build dry-run [--script full|kernel]")
	fmt.Fprintln(w, "  siyuan-cli note notebooks [--addr http://127.0.0.1:6806] [--token TOKEN] [--json]")
	fmt.Fprintln(w, "  siyuan-cli note get --id DOC_ID --token TOKEN [--addr http://127.0.0.1:6806] [--json]")
	fmt.Fprintln(w, "  siyuan-cli note create --addr http://127.0.0.1:6806 --token TOKEN --notebook NOTEBOOK --path /父路径 --title 标题 (--md Markdown | --md-file /path/to/doc.md)")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "说明:")
	fmt.Fprintln(w, "  status/health 优先复用现有 HTTP API: /api/system/version 与 /api/system/bootProgress")
	fmt.Fprintln(w, "  env/config/info 仅输出本地路径与只读元信息")
	fmt.Fprintln(w, "  log 仅做只读查看，不修改日志")
	fmt.Fprintln(w, "  build dry-run 仅输出建议执行内容，不会执行构建、重启或 pm2 操作")
	fmt.Fprintln(w, "  note notebooks 通过 HTTP API 列出笔记本")
	fmt.Fprintln(w, "  note get 通过 HTTP API 获取文档最小信息")
	fmt.Fprintln(w, "  note create 通过 HTTP API 创建文档，并输出文档 ID")
}

type statusOutput struct {
	Addr         string `json:"addr"`
	Check        string `json:"check"`
	Strict       bool   `json:"strict,omitempty"`
	OK           bool   `json:"ok"`
	Version      string `json:"version,omitempty"`
	BootProgress int    `json:"bootProgress,omitempty"`
	BootDetails  string `json:"bootDetails,omitempty"`
	VersionError string `json:"versionError,omitempty"`
	BootError    string `json:"bootError,omitempty"`
}

type workspaceOutput struct {
	ConfigPath        string               `json:"configPath"`
	Exists            bool                 `json:"exists"`
	Current           string               `json:"current,omitempty"`
	Recent            []string             `json:"recent,omitempty"`
	CurrentExists     bool                 `json:"currentExists"`
	CurrentSource     string               `json:"currentSource,omitempty"`
	CurrentInferError string               `json:"currentInferError,omitempty"`
	Validation        *workspaceValidation `json:"validation,omitempty"`
}

type workspaceValidation struct {
	OK           bool                        `json:"ok"`
	CurrentPath  workspacePathCheck          `json:"currentPath"`
	RecentPaths  []workspacePathCheck        `json:"recentPaths,omitempty"`
	ExpectedDirs []workspaceExpectedDirCheck `json:"expectedDirs,omitempty"`
	MissingCount int                         `json:"missingCount"`
}

type workspacePathCheck struct {
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
	Kind   string `json:"kind,omitempty"`
}

type workspaceExpectedDirCheck struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
}

type logFileEntry struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

type logSummaryEntry struct {
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	ModTime   string `json:"modTime"`
	LargeFile bool   `json:"largeFile"`
}

type logSummaryOutput struct {
	LogDir      string            `json:"logDir"`
	TotalFiles  int               `json:"totalFiles"`
	TotalSize   int64             `json:"totalSize"`
	LargeCount  int               `json:"largeCount"`
	Entries     []logSummaryEntry `json:"entries"`
	Top         int               `json:"top,omitempty"`
	Truncated   bool              `json:"truncated,omitempty"`
	LargestPath string            `json:"largestPath,omitempty"`
	LargestSize int64             `json:"largestSize,omitempty"`
}

type doctorOutput struct {
	Addr      string           `json:"addr"`
	Strict    bool             `json:"strict,omitempty"`
	OK        bool             `json:"ok"`
	Status    statusOutput     `json:"status"`
	Workspace workspaceOutput  `json:"workspace"`
	Logs      logSummaryOutput `json:"logs"`
	Checks    []doctorCheck    `json:"checks"`
}

type doctorCheck struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Summary string `json:"summary"`
	Detail  string `json:"detail,omitempty"`
}

const largeLogThreshold = 100 * 1024 * 1024

func runStatus(args []string, stdout, stderr io.Writer) int {
	if len(args) > 0 && args[0] == "doctor" {
		return runStatusDoctor(args[1:], stdout, stderr)
	}

	fs := flag.NewFlagSet("status", flag.ContinueOnError)
	fs.SetOutput(stderr)
	addr := fs.String("addr", defaultAddr, "服务地址")
	timeout := fs.Duration("timeout", 3*time.Second, "HTTP 超时时间")
	jsonMode := fs.Bool("json", false, "以 JSON 输出")
	check := fs.String("check", "all", "检查项: version|boot|all")
	strict := fs.Bool("strict", false, "严格模式：要求启动进度完全完成")
	if err := fs.Parse(args); err != nil {
		return 1
	}

	status, err := collectStatus(*addr, *timeout, *check, *strict)
	if err != nil {
		fmt.Fprintf(stderr, "无效检查项: %v\n", err)
		return 1
	}

	if *jsonMode {
		data, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, string(data))
		if status.OK {
			return 0
		}
		return 1
	}

	fmt.Fprintf(stdout, "地址: %s\n", status.Addr)
	fmt.Fprintf(stdout, "检查项: %s\n", status.Check)
	fmt.Fprintf(stdout, "严格模式: %t\n", status.Strict)
	if status.OK {
		fmt.Fprintln(stdout, "状态: 服务可访问")
	} else {
		fmt.Fprintln(stdout, "状态: 服务不可访问或未完全就绪")
	}
	if status.Version != "" {
		fmt.Fprintf(stdout, "版本: %s\n", status.Version)
	}
	if status.VersionError != "" {
		fmt.Fprintf(stdout, "版本接口错误: %s\n", status.VersionError)
	}
	if status.BootDetails != "" || status.BootProgress != 0 || status.BootError == "" && status.Check != "version" {
		fmt.Fprintf(stdout, "启动进度: %d\n", status.BootProgress)
		fmt.Fprintf(stdout, "启动详情: %s\n", status.BootDetails)
	}
	if status.BootError != "" {
		fmt.Fprintf(stdout, "启动接口错误: %s\n", status.BootError)
	}
	if status.OK {
		return 0
	}
	return 1
}

func collectStatus(addr string, timeout time.Duration, check string, strict bool) (statusOutput, error) {
	mode := normalizeStatusCheck(check)
	if mode == "" {
		return statusOutput{}, fmt.Errorf("仅支持 version、boot、all，收到 %q", check)
	}

	client := newHTTPClient(timeout)
	status := statusOutput{Addr: addr, Check: mode, Strict: strict, OK: true}
	trimmedAddr := strings.TrimRight(addr, "/")
	if mode == "version" || mode == "all" {
		versionURL := trimmedAddr + "/api/system/version"
		version, versionErr := fetchStringData(client, versionURL)
		if versionErr == nil {
			status.Version = version
		} else {
			status.OK = false
			status.VersionError = versionErr.Error()
		}
	}
	if mode == "boot" || mode == "all" {
		bootURL := trimmedAddr + "/api/system/bootProgress"
		boot, bootErr := fetchBootProgress(client, bootURL)
		if bootErr == nil {
			status.BootProgress = boot.Progress
			status.BootDetails = boot.Details
		} else {
			status.OK = false
			status.BootError = bootErr.Error()
		}
	}
	applyStrictStatus(&status)
	return status, nil
}

func applyStrictStatus(status *statusOutput) {
	if status == nil || !status.Strict || !status.OK {
		return
	}
	switch status.Check {
	case "boot", "all":
		if status.BootProgress < 100 {
			status.OK = false
		}
	}
}

func normalizeStatusCheck(check string) string {
	switch strings.ToLower(strings.TrimSpace(check)) {
	case "", "all":
		return "all"
	case "version":
		return "version"
	case "boot":
		return "boot"
	default:
		return ""
	}
}

func runStatusDoctor(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("status doctor", flag.ContinueOnError)
	fs.SetOutput(stderr)
	addr := fs.String("addr", defaultAddr, "服务地址")
	timeout := fs.Duration("timeout", 3*time.Second, "HTTP 超时时间")
	logDir := fs.String("log-dir", defaultLogDir, "日志目录")
	jsonMode := fs.Bool("json", false, "以 JSON 输出")
	strict := fs.Bool("strict", false, "严格模式：要求启动进度完全完成")
	workspaceValidate := fs.Bool("workspace-validate", false, "附带工作空间路径与关键目录校验")
	top := fs.Int("top", 0, "仅在 doctor 聚合中输出体积最大的前 N 个日志文件")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if *top < 0 {
		fmt.Fprintln(stderr, "top 不能小于 0")
		return 1
	}

	doctor, err := collectDoctor(*addr, *timeout, *logDir, *strict, *workspaceValidate, *top)
	if err != nil {
		fmt.Fprintf(stderr, "采集 doctor 信息失败: %v\n", err)
		return 1
	}
	if *jsonMode {
		data, err := json.MarshalIndent(doctor, "", "  ")
		if err != nil {
			fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, string(data))
		if doctor.OK {
			return 0
		}
		return 1
	}

	fmt.Fprintf(stdout, "地址: %s\n", doctor.Addr)
	fmt.Fprintf(stdout, "严格模式: %t\n", doctor.Strict)
	if doctor.OK {
		fmt.Fprintln(stdout, "诊断结果: 通过")
	} else {
		fmt.Fprintln(stdout, "诊断结果: 存在异常")
	}
	fmt.Fprintln(stdout, "检查项:")
	for _, check := range doctor.Checks {
		statusText := "OK"
		if !check.OK {
			statusText = "FAIL"
		}
		fmt.Fprintf(stdout, "- [%s] %s: %s\n", statusText, check.Name, check.Summary)
		if check.Detail != "" {
			fmt.Fprintf(stdout, "  %s\n", check.Detail)
		}
	}
	return mapDoctorExitCode(doctor)
}

func collectDoctor(addr string, timeout time.Duration, logDir string, strict bool, workspaceValidate bool, top int) (doctorOutput, error) {
	status, err := collectStatus(addr, timeout, "all", strict)
	if err != nil {
		return doctorOutput{}, err
	}
	workspace, err := readWorkspaceInfo()
	if err != nil {
		return doctorOutput{}, err
	}
	if workspaceValidate {
		workspace.Validation = validateWorkspace(workspace)
	}
	logs, err := collectLogSummary(logDir, top)
	if err != nil {
		return doctorOutput{}, err
	}
	doctor := doctorOutput{Addr: addr, Strict: strict, Status: status, Workspace: workspace, Logs: logs}
	doctor.Checks = append(doctor.Checks, buildDoctorStatusCheck(status))
	doctor.Checks = append(doctor.Checks, buildDoctorWorkspaceCheck(workspace))
	doctor.Checks = append(doctor.Checks, buildDoctorLogCheck(logs))
	doctor.OK = true
	for _, check := range doctor.Checks {
		if !check.OK {
			doctor.OK = false
			break
		}
	}
	return doctor, nil
}

func buildDoctorStatusCheck(status statusOutput) doctorCheck {
	check := doctorCheck{Name: "status", OK: status.OK}
	if status.OK {
		check.Summary = fmt.Sprintf("version=%s boot=%d", fallbackString(status.Version, "unknown"), status.BootProgress)
		if status.BootDetails != "" {
			check.Detail = status.BootDetails
		}
		return check
	}
	var parts []string
	if status.VersionError != "" {
		parts = append(parts, "version="+status.VersionError)
	}
	if status.BootError != "" {
		parts = append(parts, "boot="+status.BootError)
	}
	if status.Strict && status.BootError == "" && status.BootProgress < 100 {
		parts = append(parts, fmt.Sprintf("strict boot=%d", status.BootProgress))
	}
	check.Summary = strings.Join(parts, "; ")
	if check.Summary == "" {
		check.Summary = fmt.Sprintf("boot=%d", status.BootProgress)
	}
	if status.BootDetails != "" {
		check.Detail = status.BootDetails
	}
	return check
}

func buildDoctorWorkspaceCheck(workspace workspaceOutput) doctorCheck {
	check := doctorCheck{Name: "workspace", OK: workspace.Exists && workspace.CurrentExists}
	if workspace.Current != "" {
		check.Summary = fmt.Sprintf("current=%s", workspace.Current)
	} else {
		check.Summary = "未推断出当前工作空间"
	}
	if workspace.Validation != nil {
		check.OK = check.OK && workspace.Validation.OK
		check.Detail = fmt.Sprintf("validation=%t missing=%d", workspace.Validation.OK, workspace.Validation.MissingCount)
	} else if workspace.CurrentInferError != "" {
		check.Detail = workspace.CurrentInferError
	}
	return check
}

func buildDoctorLogCheck(summary logSummaryOutput) doctorCheck {
	check := doctorCheck{Name: "logs", OK: summary.TotalFiles > 0}
	check.Summary = fmt.Sprintf("files=%d total=%d", summary.TotalFiles, summary.TotalSize)
	var details []string
	if summary.LargestPath != "" {
		details = append(details, fmt.Sprintf("largest=%s (%d)", summary.LargestPath, summary.LargestSize))
	}
	if summary.Top > 0 {
		details = append(details, fmt.Sprintf("top=%d", summary.Top))
	}
	if summary.Truncated {
		details = append(details, "truncated=true")
	}
	check.Detail = strings.Join(details, " ")
	return check
}

func mapDoctorExitCode(doctor doctorOutput) int {
	if doctor.OK {
		return 0
	}
	return 1
}

func fallbackString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func runEnv(args []string, stdout, stderr io.Writer) int {
	subcmd := "info"
	rest := args
	if len(args) > 0 {
		subcmd = args[0]
		rest = args[1:]
	}

	switch subcmd {
	case "info":
		root := detectRepoRoot()
		return printEnvInfo(root, stdout)
	case "workspace":
		fs := flag.NewFlagSet("env workspace", flag.ContinueOnError)
		fs.SetOutput(stderr)
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		validate := fs.Bool("validate", false, "校验工作空间路径与关键目录")
		if err := fs.Parse(rest); err != nil {
			return 1
		}
		return printEnvWorkspace(stdout, stderr, *jsonMode, *validate)
	default:
		fmt.Fprintf(stderr, "未知 env 子命令: %s\n", subcmd)
		return 1
	}
}

func runLog(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "log 需要子命令: info、files、summary 或 tail")
		return 1
	}

	switch args[0] {
	case "info":
		fs := flag.NewFlagSet("log info", flag.ContinueOnError)
		fs.SetOutput(stderr)
		logDir := fs.String("log-dir", defaultLogDir, "日志目录")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		return printLogInfo(*logDir, stdout, stderr)
	case "files":
		fs := flag.NewFlagSet("log files", flag.ContinueOnError)
		fs.SetOutput(stderr)
		logDir := fs.String("log-dir", defaultLogDir, "日志目录")
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		return printLogFiles(*logDir, *jsonMode, stdout, stderr)
	case "summary":
		fs := flag.NewFlagSet("log summary", flag.ContinueOnError)
		fs.SetOutput(stderr)
		logDir := fs.String("log-dir", defaultLogDir, "日志目录")
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		top := fs.Int("top", 0, "仅输出体积最大的前 N 个日志文件")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		return printLogSummary(*logDir, *jsonMode, *top, stdout, stderr)
	case "tail":
		fs := flag.NewFlagSet("log tail", flag.ContinueOnError)
		fs.SetOutput(stderr)
		logDir := fs.String("log-dir", defaultLogDir, "日志目录")
		fileArg := fs.String("file", "out", "日志文件标识: out|error|kernel|绝对路径")
		lines := fs.Int("lines", 100, "输出尾部行数")
		contains := fs.String("contains", "", "仅输出包含该关键字的尾部行")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		return printLogTail(*logDir, *fileArg, *lines, *contains, stdout, stderr)
	default:
		fmt.Fprintf(stderr, "未知 log 子命令: %s\n", args[0])
		return 1
	}
}

func runBuild(args []string, stdout, stderr io.Writer) int {
	subcmd := "info"
	rest := args
	if len(args) > 0 {
		subcmd = args[0]
		rest = args[1:]
	}

	switch subcmd {
	case "info":
		root := detectRepoRoot()
		printBuildInfo(root, stdout)
		return 0
	case "scripts":
		root := detectRepoRoot()
		return printBuildScripts(root, stdout, stderr)
	case "dry-run":
		fs := flag.NewFlagSet("build dry-run", flag.ContinueOnError)
		fs.SetOutput(stderr)
		scriptName := fs.String("script", "full", "脚本类型: full|kernel")
		if err := fs.Parse(rest); err != nil {
			return 1
		}
		root := detectRepoRoot()
		return printBuildDryRun(root, *scriptName, stdout, stderr)
	default:
		fmt.Fprintf(stderr, "未知 build 子命令: %s\n", subcmd)
		return 1
	}
}

func runNote(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "note 需要子命令: notebooks、get 或 create")
		return 1
	}

	switch args[0] {
	case "notebooks":
		fs := flag.NewFlagSet("note notebooks", flag.ContinueOnError)
		fs.SetOutput(stderr)
		addr := fs.String("addr", defaultAddr, "服务地址")
		token := fs.String("token", "", "认证令牌")
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}

		notebooks, err := lsNotebooks(*addr, *token)
		if err != nil {
			fmt.Fprintf(stderr, "获取笔记本列表失败: %v\n", err)
			return 1
		}
		if *jsonMode {
			data, err := json.MarshalIndent(notebooks, "", "  ")
			if err != nil {
				fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
				return 1
			}
			fmt.Fprintln(stdout, string(data))
			return 0
		}
		for _, notebook := range notebooks {
			fmt.Fprintf(stdout, "id=%s name=%s closed=%t sort=%d\n", notebook.ID, notebook.Name, notebook.Closed, notebook.Sort)
		}
		return 0
	case "get":
		fs := flag.NewFlagSet("note get", flag.ContinueOnError)
		fs.SetOutput(stderr)
		addr := fs.String("addr", defaultAddr, "服务地址")
		token := fs.String("token", "", "认证令牌")
		id := fs.String("id", "", "文档 ID")
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		if strings.TrimSpace(*id) == "" {
			fmt.Fprintln(stderr, "获取文档失败: 必须提供 --id")
			return 1
		}

		doc, err := getDoc(*addr, *token, *id)
		if err != nil {
			fmt.Fprintf(stderr, "获取文档失败: %v\n", err)
			return 1
		}
		if *jsonMode {
			data, err := json.MarshalIndent(doc, "", "  ")
			if err != nil {
				fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
				return 1
			}
			fmt.Fprintln(stdout, string(data))
			return 0
		}
		docPath := doc.Path
		if strings.TrimSpace(docPath) == "" {
			docPath = "-"
		}
		fmt.Fprintf(stdout, "ID: %s\n", doc.ID)
		fmt.Fprintf(stdout, "RootID: %s\n", doc.RootID)
		fmt.Fprintf(stdout, "笔记本: %s\n", doc.Box)
		fmt.Fprintf(stdout, "路径: %s\n", docPath)
		fmt.Fprintf(stdout, "类型: %s\n", doc.Type)
		fmt.Fprintf(stdout, "块数: %d\n", doc.BlockCount)
		fmt.Fprintln(stdout, "内容:")
		fmt.Fprintln(stdout, doc.Content)
		return 0
	case "create":
		fs := flag.NewFlagSet("note create", flag.ContinueOnError)
		fs.SetOutput(stderr)
		addr := fs.String("addr", defaultAddr, "服务地址")
		token := fs.String("token", "", "认证令牌")
		notebook := fs.String("notebook", "", "笔记本 ID")
		path := fs.String("path", "", "父级路径")
		title := fs.String("title", "", "文档标题")
		md := fs.String("md", "", "Markdown 内容")
		mdFile := fs.String("md-file", "", "Markdown 文件路径")
		jsonMode := fs.Bool("json", false, "以 JSON 输出")
		printPath := fs.Bool("print-path", false, "额外输出最终创建路径")
		if err := fs.Parse(args[1:]); err != nil {
			return 1
		}
		if *md != "" && *mdFile != "" {
			fmt.Fprintln(stderr, "创建文档失败: --md 与 --md-file 不能同时提供")
			return 1
		}
		if *md == "" && *mdFile == "" {
			fmt.Fprintln(stderr, "创建文档失败: 必须提供 --md 或 --md-file 其中之一")
			return 1
		}
		if *mdFile != "" {
			data, err := os.ReadFile(*mdFile)
			if err != nil {
				fmt.Fprintf(stderr, "创建文档失败: 读取 Markdown 文件失败: %v\n", err)
				return 1
			}
			*md = string(data)
		}

		reqBody := createDocRequest{
			Notebook: *notebook,
			Path:     joinDocCreatePath(*path, *title),
			Title:    *title,
			Markdown: *md,
		}
		docID, err := createDoc(*addr, *token, reqBody)
		if err != nil {
			fmt.Fprintf(stderr, "创建文档失败: %v\n", err)
			return 1
		}
		if *jsonMode {
			data, err := json.MarshalIndent(map[string]any{
				"id":       docID,
				"title":    *title,
				"path":     reqBody.Path,
				"notebook": *notebook,
			}, "", "  ")
			if err != nil {
				fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
				return 1
			}
			fmt.Fprintln(stdout, string(data))
			return 0
		}
		fmt.Fprintf(stdout, "创建文档成功，ID: %s\n", docID)
		if *printPath {
			fmt.Fprintf(stdout, "最终路径: %s\n", reqBody.Path)
		}
		return 0
	default:
		fmt.Fprintf(stderr, "未知 note 子命令: %s\n", args[0])
		return 1
	}
}

func printBuildInfo(root string, w io.Writer) {
	fmt.Fprintln(w, "构建入口信息:")
	fmt.Fprintf(w, "项目根目录: %s\n", root)
	fmt.Fprintf(w, "完整重建脚本: %s\n", filepath.Join(root, "rebuild-and-restart.sh"))
	fmt.Fprintf(w, "仅后端脚本: %s\n", filepath.Join(root, "rebuild-kernel-only.sh"))
	fmt.Fprintln(w, "说明: 按本机规范，完整重建优先使用 rebuild-and-restart.sh；CLI 本身不执行这些高风险操作。")
}

func printBuildScripts(root string, stdout, stderr io.Writer) int {
	scripts := []string{
		"rebuild-and-restart.sh",
		"rebuild-kernel-only.sh",
		"rebuild-and-test-websocket.sh",
		"rebuild-index.sh",
		"rebuild-user-index.sh",
	}
	fmt.Fprintf(stdout, "项目根目录: %s\n", root)
	fmt.Fprintln(stdout, "可见构建/维护脚本:")
	found := 0
	for _, name := range scripts {
		path := filepath.Join(root, name)
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		found++
		fmt.Fprintf(stdout, "- %s | 大小=%d 字节 | 修改时间=%s\n", path, info.Size(), info.ModTime().Format(time.RFC3339))
	}
	if found == 0 {
		fmt.Fprintln(stderr, "未找到可识别构建脚本")
		return 1
	}
	return 0
}

func printBuildDryRun(root, scriptName string, stdout, stderr io.Writer) int {
	scriptPath := filepath.Join(root, "rebuild-and-restart.sh")
	scriptDesc := "完整重建前端和后端，然后重启服务"
	command := "bash " + scriptPath
	if scriptName == "kernel" {
		scriptPath = filepath.Join(root, "rebuild-kernel-only.sh")
		scriptDesc = "仅重新编译后端内核并重启服务"
		command = "bash " + scriptPath
	} else if scriptName != "full" {
		fmt.Fprintf(stderr, "不支持的脚本类型: %s\n", scriptName)
		return 1
	}

	fmt.Fprintln(stdout, "构建 dry-run:")
	fmt.Fprintf(stdout, "脚本类型: %s\n", scriptName)
	fmt.Fprintf(stdout, "脚本路径: %s\n", scriptPath)
	fmt.Fprintf(stdout, "用途: %s\n", scriptDesc)
	fmt.Fprintf(stdout, "建议命令: %s\n", command)
	fmt.Fprintln(stdout, "说明: 本命令不会执行构建、不会重启服务、不会修改 pm2 配置。")
	return 0
}

func printEnvInfo(root string, stdout io.Writer) int {
	workingDir, _ := os.Getwd()
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".config", "siyuan")
	workspaceConf := filepath.Join(configDir, "workspace.json")

	fmt.Fprintln(stdout, "环境信息:")
	fmt.Fprintf(stdout, "当前目录: %s\n", workingDir)
	fmt.Fprintf(stdout, "项目根目录: %s\n", root)
	fmt.Fprintf(stdout, "kernel 目录: %s\n", filepath.Join(root, "kernel"))
	fmt.Fprintf(stdout, "默认服务地址: %s\n", defaultAddr)
	fmt.Fprintf(stdout, "默认日志目录: %s\n", defaultLogDir)
	fmt.Fprintf(stdout, "用户主目录: %s\n", homeDir)
	fmt.Fprintf(stdout, "SiYuan 配置目录: %s\n", configDir)
	fmt.Fprintf(stdout, "workspace.json: %s\n", workspaceConf)
	return 0
}

func printEnvWorkspace(stdout, stderr io.Writer, jsonMode bool, validate bool) int {
	workspace, err := readWorkspaceInfo()
	if err != nil {
		fmt.Fprintf(stderr, "读取 workspace 信息失败: %v\n", err)
		return 1
	}

	if validate {
		workspace.Validation = validateWorkspace(workspace)
	}

	if jsonMode {
		data, err := json.MarshalIndent(workspace, "", "  ")
		if err != nil {
			fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, string(data))
		return 0
	}

	fmt.Fprintf(stdout, "workspace.json: %s\n", workspace.ConfigPath)
	fmt.Fprintf(stdout, "文件存在: %t\n", workspace.Exists)
	if workspace.Current != "" {
		fmt.Fprintf(stdout, "当前推断工作空间: %s\n", workspace.Current)
		fmt.Fprintf(stdout, "当前路径存在: %t\n", workspace.CurrentExists)
		if workspace.CurrentSource != "" {
			fmt.Fprintf(stdout, "推断来源: %s\n", workspace.CurrentSource)
		}
	} else if workspace.CurrentInferError != "" {
		fmt.Fprintf(stdout, "当前推断工作空间: 未能确定 (%s)\n", workspace.CurrentInferError)
	} else {
		fmt.Fprintln(stdout, "当前推断工作空间: 未找到")
	}
	if workspace.Validation != nil {
		printWorkspaceValidation(stdout, workspace.Validation)
	}

	fmt.Fprintln(stdout, "最近工作空间:")
	if len(workspace.Recent) == 0 {
		fmt.Fprintln(stdout, "- 无")
		return 0
	}
	for _, item := range workspace.Recent {
		fmt.Fprintf(stdout, "- %s\n", item)
	}
	return 0
}

func readWorkspaceInfo() (workspaceOutput, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return workspaceOutput{}, err
	}
	configPath := filepath.Join(homeDir, ".config", "siyuan", "workspace.json")
	result := workspaceOutput{ConfigPath: configPath}
	data, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			result.CurrentInferError = "workspace.json 不存在"
			return result, nil
		}
		return workspaceOutput{}, err
	}
	result.Exists = true

	var paths []string
	if err := json.Unmarshal(data, &paths); err != nil {
		return workspaceOutput{}, err
	}
	for _, item := range paths {
		trimmed := strings.TrimRight(item, " \t\n")
		if trimmed == "" {
			continue
		}
		if !containsString(result.Recent, trimmed) {
			result.Recent = append(result.Recent, trimmed)
		}
	}
	current, source := inferCurrentWorkspace(result.Recent)
	result.Current = current
	result.CurrentSource = source
	if current != "" {
		result.CurrentExists = dirExists(current)
	} else if len(result.Recent) == 0 {
		result.CurrentInferError = "workspace.json 中没有工作空间记录"
		result.CurrentSource = "empty"
	} else {
		result.CurrentInferError = "最近工作空间都不是现有目录"
	}
	return result, nil
}

func validateWorkspace(workspace workspaceOutput) *workspaceValidation {
	validation := &workspaceValidation{}
	if workspace.Current != "" {
		validation.CurrentPath = workspacePathCheck{Path: workspace.Current, Exists: dirExists(workspace.Current), Kind: "current"}
		if !validation.CurrentPath.Exists {
			validation.MissingCount++
		}
	}
	for _, item := range workspace.Recent {
		check := workspacePathCheck{Path: item, Exists: dirExists(item), Kind: "recent"}
		if !check.Exists {
			validation.MissingCount++
		}
		validation.RecentPaths = append(validation.RecentPaths, check)
	}
	if workspace.Current != "" {
		for _, name := range []string{"conf", "data", "repo", "temp"} {
			path := filepath.Join(workspace.Current, name)
			check := workspaceExpectedDirCheck{Name: name, Path: path, Exists: dirExists(path)}
			if !check.Exists {
				validation.MissingCount++
			}
			validation.ExpectedDirs = append(validation.ExpectedDirs, check)
		}
	}
	validation.OK = validation.MissingCount == 0
	return validation
}

func printWorkspaceValidation(stdout io.Writer, validation *workspaceValidation) {
	if validation == nil {
		return
	}
	fmt.Fprintf(stdout, "校验结果: %t\n", validation.OK)
	if validation.CurrentPath.Path != "" {
		fmt.Fprintf(stdout, "当前工作空间存在: %t (%s)\n", validation.CurrentPath.Exists, validation.CurrentPath.Path)
	}
	if len(validation.ExpectedDirs) > 0 {
		fmt.Fprintln(stdout, "当前工作空间关键目录:")
		for _, item := range validation.ExpectedDirs {
			fmt.Fprintf(stdout, "- %s	%t	%s\n", item.Name, item.Exists, item.Path)
		}
	}
	if len(validation.RecentPaths) > 0 {
		fmt.Fprintln(stdout, "最近工作空间存在性:")
		for _, item := range validation.RecentPaths {
			fmt.Fprintf(stdout, "- %t	%s\n", item.Exists, item.Path)
		}
	}
	fmt.Fprintf(stdout, "缺失项数量: %d\n", validation.MissingCount)
}

func inferCurrentWorkspace(paths []string) (string, string) {
	if len(paths) == 0 {
		return "", ""
	}
	last := paths[len(paths)-1]
	if dirExists(last) {
		return last, "last_recent"
	}
	for i := len(paths) - 2; i >= 0; i-- {
		if dirExists(paths[i]) {
			return paths[i], "last_existing_recent"
		}
	}
	return last, "last_recent_missing"
}

func printLogInfo(logDir string, stdout, stderr io.Writer) int {
	files := candidateLogFiles(logDir)
	discovered, _ := collectLogFiles(logDir)
	fmt.Fprintf(stdout, "日志目录: %s\n", logDir)
	if len(discovered) > 0 {
		fmt.Fprintf(stdout, "发现文件数: %d\n", len(discovered))
	}
	for _, file := range files {
		info, err := os.Stat(file.Path)
		if err != nil {
			fmt.Fprintf(stdout, "%s: 不存在 (%s)\n", file.Name, file.Path)
			continue
		}
		fmt.Fprintf(stdout, "%s: %s | 大小=%d 字节 | 修改时间=%s\n", file.Name, file.Path, info.Size(), info.ModTime().Format(time.RFC3339))
	}

	if len(files) == 0 {
		fmt.Fprintln(stderr, "未找到可识别日志文件")
		return 1
	}
	return 0
}

func printLogFiles(logDir string, jsonMode bool, stdout, stderr io.Writer) int {
	files, err := collectLogFiles(logDir)
	if err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 1
	}
	if jsonMode {
		data, err := json.MarshalIndent(files, "", "  ")
		if err != nil {
			fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, string(data))
		return 0
	}

	fmt.Fprintf(stdout, "日志目录: %s\n", logDir)
	for _, file := range files {
		fmt.Fprintf(stdout, "%s\t%d\t%s\n", file.Path, file.Size, file.ModTime)
	}
	return 0
}

func collectLogFiles(logDir string) ([]logFileEntry, error) {
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return nil, fmt.Errorf("读取日志目录失败: %v", err)
	}
	var files []logFileEntry
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, fmt.Errorf("读取文件信息失败: %s: %v", entry.Name(), err)
		}
		files = append(files, logFileEntry{
			Path:    filepath.Join(logDir, entry.Name()),
			Size:    info.Size(),
			ModTime: info.ModTime().Format(time.RFC3339),
		})
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("日志目录为空: %s", logDir)
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})
	return files, nil
}

func printLogSummary(logDir string, jsonMode bool, top int, stdout, stderr io.Writer) int {
	summary, err := collectLogSummary(logDir, top)
	if err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 1
	}
	if jsonMode {
		data, err := json.MarshalIndent(summary, "", "  ")
		if err != nil {
			fmt.Fprintf(stderr, "生成 JSON 失败: %v\n", err)
			return 1
		}
		fmt.Fprintln(stdout, string(data))
		return 0
	}
	fmt.Fprintf(stdout, "日志目录: %s\n", summary.LogDir)
	fmt.Fprintf(stdout, "总文件数: %d\n", summary.TotalFiles)
	fmt.Fprintf(stdout, "总大小: %d 字节\n", summary.TotalSize)
	fmt.Fprintf(stdout, "超大文件数: %d\n", summary.LargeCount)
	if summary.Top > 0 {
		fmt.Fprintf(stdout, "Top: %d\n", summary.Top)
	}
	if summary.LargestPath != "" {
		fmt.Fprintf(stdout, "最大文件: %s (%d 字节)\n", summary.LargestPath, summary.LargestSize)
	}
	for _, entry := range summary.Entries {
		fmt.Fprintf(stdout, "- %s | 大小=%d | 修改时间=%s | 超大=%t\n", entry.Path, entry.Size, entry.ModTime, entry.LargeFile)
	}
	return 0
}

func collectLogSummary(logDir string, top int) (logSummaryOutput, error) {
	if top < 0 {
		return logSummaryOutput{}, fmt.Errorf("top 不能小于 0")
	}
	files, err := collectLogFiles(logDir)
	if err != nil {
		return logSummaryOutput{}, err
	}
	summary := logSummaryOutput{LogDir: logDir}
	for _, file := range files {
		entry := logSummaryEntry{
			Path:      file.Path,
			Size:      file.Size,
			ModTime:   file.ModTime,
			LargeFile: file.Size > largeLogThreshold,
		}
		summary.Entries = append(summary.Entries, entry)
		summary.TotalFiles++
		summary.TotalSize += file.Size
		if entry.LargeFile {
			summary.LargeCount++
		}
		if entry.Size > summary.LargestSize || summary.LargestPath == "" {
			summary.LargestPath = entry.Path
			summary.LargestSize = entry.Size
		}
	}
	sort.Slice(summary.Entries, func(i, j int) bool {
		if summary.Entries[i].Size == summary.Entries[j].Size {
			return summary.Entries[i].Path < summary.Entries[j].Path
		}
		return summary.Entries[i].Size > summary.Entries[j].Size
	})
	if top > 0 && top < len(summary.Entries) {
		summary.Top = top
		summary.Truncated = true
		summary.Entries = summary.Entries[:top]
	} else if top > 0 {
		summary.Top = top
	}
	return summary, nil
}

func printLogTail(logDir, fileArg string, lines int, contains string, stdout, stderr io.Writer) int {
	if lines <= 0 {
		fmt.Fprintln(stderr, "lines 必须大于 0")
		return 1
	}

	path, err := resolveLogFile(logDir, fileArg)
	if err != nil {
		fmt.Fprintf(stderr, "解析日志文件失败: %v\n", err)
		return 1
	}

	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintf(stderr, "读取日志文件失败: %v\n", err)
		return 1
	}

	tail := tailLines(string(data), lines)
	if contains != "" {
		tail = filterLinesContaining(tail, contains)
	}
	fmt.Fprintf(stdout, "日志文件: %s\n", path)
	fmt.Fprintf(stdout, "尾部 %d 行:\n", lines)
	if contains != "" {
		fmt.Fprintf(stdout, "过滤关键字: %s\n", contains)
	}
	fmt.Fprint(stdout, tail)
	if !strings.HasSuffix(tail, "\n") && tail != "" {
		fmt.Fprintln(stdout)
	}
	return 0
}

type logFile struct {
	Name string
	Path string
}

func candidateLogFiles(logDir string) []logFile {
	return []logFile{
		{Name: "pm2-out", Path: filepath.Join(logDir, "siyuan-out.log")},
		{Name: "pm2-error", Path: filepath.Join(logDir, "siyuan-error.log")},
		{Name: "kernel-temp", Path: filepath.Join(logDir, "siyuan.log")},
	}
}

func resolveLogFile(logDir, fileArg string) (string, error) {
	if filepath.IsAbs(fileArg) {
		return fileArg, nil
	}

	switch fileArg {
	case "out":
		return filepath.Join(logDir, "siyuan-out.log"), nil
	case "error":
		return filepath.Join(logDir, "siyuan-error.log"), nil
	case "kernel":
		return filepath.Join(logDir, "siyuan.log"), nil
	default:
		return "", fmt.Errorf("仅支持 out、error、kernel 或绝对路径，收到 %q", fileArg)
	}
}

func tailLines(content string, lines int) string {
	if content == "" {
		return ""
	}
	scanner := bufio.NewScanner(strings.NewReader(content))
	var all []string
	for scanner.Scan() {
		all = append(all, scanner.Text())
	}
	if len(all) == 0 {
		return ""
	}
	if lines >= len(all) {
		return strings.Join(all, "\n") + "\n"
	}
	return strings.Join(all[len(all)-lines:], "\n") + "\n"
}

func filterLinesContaining(content, keyword string) string {
	if keyword == "" || content == "" {
		return content
	}
	scanner := bufio.NewScanner(strings.NewReader(content))
	var matched []string
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, keyword) {
			matched = append(matched, line)
		}
	}
	if len(matched) == 0 {
		return ""
	}
	return strings.Join(matched, "\n") + "\n"
}

type stringResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data string `json:"data"`
}

type bootProgressResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Progress int    `json:"progress"`
		Details  string `json:"details"`
	} `json:"data"`
}

type bootProgressData struct {
	Progress int
	Details  string
}

type createDocRequest struct {
	Notebook string `json:"notebook"`
	Path     string `json:"path"`
	Title    string `json:"title"`
	Markdown string `json:"markdown"`
}

type createDocResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

type listDocsByPathRequest struct {
	Notebook          string `json:"notebook"`
	Path              string `json:"path"`
	MaxListCount      int    `json:"maxListCount"`
	IgnoreMaxListHint bool   `json:"ignoreMaxListHint"`
}

type docTreeNode struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listDocsByPathResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Box   string        `json:"box"`
		Path  string        `json:"path"`
		Files []docTreeNode `json:"files"`
	} `json:"data"`
}

type searchDocsRequest struct {
	Keyword string `json:"k"`
}

type searchDocsResponse struct {
	Code int               `json:"code"`
	Msg  string            `json:"msg"`
	Data []searchDocResult `json:"data"`
}

type searchDocResult struct {
	Box   string `json:"box"`
	HPath string `json:"hPath"`
	Path  string `json:"path"`
}

type notebookInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Closed bool   `json:"closed"`
	Sort   int    `json:"sort"`
}

type noteGetOutput struct {
	ID         string `json:"id"`
	RootID     string `json:"rootID"`
	Box        string `json:"box"`
	Notebook   string `json:"notebook"`
	Path       string `json:"path"`
	Content    string `json:"content"`
	Type       string `json:"type"`
	BlockCount int    `json:"blockCount"`
}

type lsNotebooksResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Notebooks []notebookInfo `json:"notebooks"`
	} `json:"data"`
}

type noteGetResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		ID         string `json:"id"`
		RootID     string `json:"rootID"`
		Box        string `json:"box"`
		Path       string `json:"path"`
		Content    string `json:"content"`
		Type       string `json:"type"`
		BlockCount int    `json:"blockCount"`
	} `json:"data"`
}

func fetchStringData(client *http.Client, url string) (string, error) {
	body, err := doGET(client, url)
	if err != nil {
		return "", err
	}
	var resp stringResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", err
	}
	if resp.Code != 0 {
		return "", errors.New(resp.Msg)
	}
	return resp.Data, nil
}

func fetchBootProgress(client *http.Client, url string) (bootProgressData, error) {
	body, err := doGET(client, url)
	if err != nil {
		return bootProgressData{}, err
	}
	var resp bootProgressResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return bootProgressData{}, err
	}
	if resp.Code != 0 {
		return bootProgressData{}, errors.New(resp.Msg)
	}
	return bootProgressData{
		Progress: resp.Data.Progress,
		Details:  resp.Data.Details,
	}, nil
}

func createDoc(addr, token string, reqBody createDocRequest) (string, error) {
	client := newHTTPClient(3 * time.Second)
	url := strings.TrimRight(addr, "/") + "/api/filetree/createDocWithMd"
	body, err := doJSONRequest(client, http.MethodPost, url, token, map[string]any{
		"notebook": reqBody.Notebook,
		"path":     reqBody.Path,
		"title":    reqBody.Title,
		"markdown": reqBody.Markdown,
	})
	if err != nil {
		return "", err
	}
	var resp createDocResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", err
	}
	if resp.Code != 0 {
		if resp.Msg == "" {
			return "", fmt.Errorf("服务返回 code=%d", resp.Code)
		}
		return "", errors.New(resp.Msg)
	}
	docID, err := extractCreateDocID(resp.Data)
	if err != nil {
		if !isJSONNull(resp.Data) {
			return "", err
		}
	}
	if docID == "" {
		docID, err = lookupCreatedDocID(client, addr, token, reqBody)
		if err != nil {
			return "", err
		}
	}
	return docID, nil
}

func isJSONNull(data json.RawMessage) bool {
	trimmed := bytes.TrimSpace(data)
	return len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null"))
}

func extractCreateDocID(data json.RawMessage) (string, error) {
	var docID string
	if err := json.Unmarshal(data, &docID); err == nil {
		return docID, nil
	}
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	return payload.ID, nil
}

func lookupCreatedDocID(client *http.Client, addr, token string, reqBody createDocRequest) (string, error) {
	url := strings.TrimRight(addr, "/") + "/api/filetree/searchDocs"
	respBody, err := doJSONRequest(client, http.MethodPost, url, token, searchDocsRequest{
		Keyword: reqBody.Title,
	})
	if err != nil {
		return "", fmt.Errorf("创建成功但回查文档 ID 失败: %w", err)
	}
	var resp searchDocsResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return "", fmt.Errorf("创建成功但回查文档 ID 失败: %w", err)
	}
	if resp.Code != 0 {
		if resp.Msg == "" {
			return "", fmt.Errorf("创建成功但回查文档 ID 失败: 服务返回 code=%d", resp.Code)
		}
		return "", fmt.Errorf("创建成功但回查文档 ID 失败: %s", resp.Msg)
	}
	var latestDocID string
	for _, file := range resp.Data {
		if file.Box != reqBody.Notebook {
			continue
		}
		if path.Base(file.HPath) != reqBody.Title {
			continue
		}
		base := path.Base(file.Path)
		if strings.HasSuffix(base, ".sy") {
			latestDocID = strings.TrimSuffix(base, ".sy")
		}
	}
	if latestDocID != "" {
		return latestDocID, nil
	}
	return "", fmt.Errorf("创建成功但未找到标题为 %q 的文档 ID", reqBody.Title)
}

func joinDocCreatePath(parentPath, title string) string {
	parent := strings.TrimSpace(parentPath)
	if parent == "" || parent == "/" {
		parent = "/"
	} else {
		parent = strings.TrimRight(parent, "/")
		if !strings.HasPrefix(parent, "/") {
			parent = "/" + parent
		}
	}
	title = strings.TrimSpace(title)
	if title == "" {
		return parent
	}
	if parent == "/" {
		return "/" + title
	}
	return parent + "/" + title
}

func docParentPath(docPath string) string {
	trimmed := strings.TrimSpace(docPath)
	if trimmed == "" || trimmed == "/" {
		return "/"
	}
	trimmed = strings.TrimRight(trimmed, "/")
	if trimmed == "" {
		return "/"
	}
	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}
	parent := path.Dir(trimmed)
	if parent == "." || parent == "" {
		return "/"
	}
	if !strings.HasPrefix(parent, "/") {
		parent = "/" + parent
	}
	return parent
}

func lsNotebooks(addr, token string) ([]notebookInfo, error) {
	client := newHTTPClient(3 * time.Second)
	url := strings.TrimRight(addr, "/") + "/api/notebook/lsNotebooks"
	body, err := doJSONRequest(client, http.MethodPost, url, token, map[string]any{})
	if err != nil {
		return nil, err
	}
	var resp lsNotebooksResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if resp.Code != 0 {
		if resp.Msg == "" {
			return nil, fmt.Errorf("服务返回 code=%d", resp.Code)
		}
		return nil, errors.New(resp.Msg)
	}
	return resp.Data.Notebooks, nil
}

func getDoc(addr, token, id string) (noteGetOutput, error) {
	client := newHTTPClient(3 * time.Second)
	url := strings.TrimRight(addr, "/") + "/api/filetree/getDoc"
	body, err := doJSONRequest(client, http.MethodPost, url, token, map[string]any{
		"id": id,
	})
	if err != nil {
		return noteGetOutput{}, err
	}
	var resp noteGetResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return noteGetOutput{}, err
	}
	if resp.Code != 0 {
		if resp.Msg == "" {
			return noteGetOutput{}, fmt.Errorf("服务返回 code=%d", resp.Code)
		}
		return noteGetOutput{}, errors.New(resp.Msg)
	}
	return noteGetOutput{
		ID:         resp.Data.ID,
		RootID:     resp.Data.RootID,
		Box:        resp.Data.Box,
		Notebook:   resp.Data.Box,
		Path:       resp.Data.Path,
		Content:    resp.Data.Content,
		Type:       resp.Data.Type,
		BlockCount: resp.Data.BlockCount,
	}, nil
}

func doGET(client *http.Client, url string) ([]byte, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func doJSONRequest(client *http.Client, method, url, token string, payload any) ([]byte, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(method, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func detectRepoRoot() string {
	wd, err := os.Getwd()
	if err != nil {
		return "/root/code/neu-siyuan-note"
	}
	for dir := wd; dir != "/" && dir != "."; dir = filepath.Dir(dir) {
		if fileExists(filepath.Join(dir, "rebuild-and-restart.sh")) && fileExists(filepath.Join(dir, "kernel", "go.mod")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}
	return "/root/code/neu-siyuan-note"
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
