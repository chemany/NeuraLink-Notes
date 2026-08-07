package api

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestResolveOCRAssetPathPrefersWebUserAsset(t *testing.T) {
	tempDir := t.TempDir()
	userDataRoot := filepath.Join(tempDir, "notes")
	globalDataDir := filepath.Join(userDataRoot, "data")
	userAssetPath := filepath.Join(userDataRoot, "testuser3", "assets", "ocr-test.png")

	if err := os.MkdirAll(filepath.Dir(userAssetPath), 0o755); err != nil {
		t.Fatalf("create user asset dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(globalDataDir, "assets"), 0o755); err != nil {
		t.Fatalf("create global asset dir: %v", err)
	}
	if err := os.WriteFile(userAssetPath, []byte("ocr"), 0o644); err != nil {
		t.Fatalf("write user asset: %v", err)
	}

	originalDataDir := util.DataDir
	originalWorkspaceDir := util.WorkspaceDir
	originalUserDataRoot := os.Getenv("SIYUAN_USER_DATA_ROOT")
	t.Cleanup(func() {
		util.DataDir = originalDataDir
		util.WorkspaceDir = originalWorkspaceDir
		if originalUserDataRoot == "" {
			_ = os.Unsetenv("SIYUAN_USER_DATA_ROOT")
		} else {
			_ = os.Setenv("SIYUAN_USER_DATA_ROOT", originalUserDataRoot)
		}
	})

	util.DataDir = globalDataDir
	util.WorkspaceDir = tempDir
	if err := os.Setenv("SIYUAN_USER_DATA_ROOT", userDataRoot); err != nil {
		t.Fatalf("set env: %v", err)
	}

	got, err := resolveOCRAssetPath("assets/ocr-test.png")
	if err != nil {
		t.Fatalf("resolveOCRAssetPath returned error: %v", err)
	}
	if got != userAssetPath {
		t.Fatalf("expected user asset path %q, got %q", userAssetPath, got)
	}
}
