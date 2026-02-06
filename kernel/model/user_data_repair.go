// SiYuan - User Data Repair Tool
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package model

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/siyuan-note/logging"
	siyuanSQL "github.com/siyuan-note/siyuan/kernel/sql"
)

// RepairUserData 修复所有用户的数据库 user_id 字段
// 在系统启动时调用，确保历史数据的 user_id 正确
func RepairUserData() error {
	logging.LogInfof("Starting user data repair...")

	// 获取用户存储
	userStore := GetUserStore()
	if userStore == nil {
		logging.LogWarnf("User store not initialized, skipping data repair")
		return nil
	}

	users, err := userStore.List()
	if err != nil {
		logging.LogErrorf("Failed to list users: %s", err)
		return err
	}

	logging.LogInfof("Found %d users to repair", len(users))

	for _, user := range users {
		if err := repairUserData(user); err != nil {
			logging.LogErrorf("Failed to repair data for user %s: %s", user.Username, err)
			// 继续处理其他用户，不要中断
			continue
		}
	}

	logging.LogInfof("User data repair completed")
	return nil
}

// repairUserData 修复单个用户的数据
func repairUserData(user *User) error {
	logging.LogInfof("Repairing data for user: %s (ID: %s, Workspace: %s)", user.Username, user.ID, user.Workspace)

	if user.Workspace == "" {
		logging.LogWarnf("User %s has no workspace, skipping", user.Username)
		return nil
	}

	// 检查 workspace 是否存在
	if _, err := os.Stat(user.Workspace); os.IsNotExist(err) {
		logging.LogWarnf("User %s workspace does not exist: %s", user.Username, user.Workspace)
		return nil
	}

	// 获取用户的所有笔记本 (box)
	boxes, err := getUserBoxes(user.Workspace)
	if err != nil {
		logging.LogErrorf("Failed to get boxes for user %s: %s", user.Username, err)
		return err
	}

	if len(boxes) == 0 {
		logging.LogInfof("No boxes found for user %s", user.Username)
		return nil
	}

	logging.LogInfof("Found %d boxes for user %s", len(boxes), user.Username)

	// 修复每个笔记本的数据
	for _, box := range boxes {
		if err := repairBoxUserID(user.Username, box); err != nil {
			logging.LogErrorf("Failed to repair box %s for user %s: %s", box, user.Username, err)
			// 继续处理其他笔记本
			continue
		}
	}

	return nil
}

// getUserBoxes 获取用户的所有笔记本
func getUserBoxes(workspace string) ([]string, error) {
	dataDir := filepath.Join(workspace)
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, err
	}

	var boxes []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// 排除系统目录
		name := entry.Name()
		if name == "assets" || name == "conf" || name == "emojis" || name == "history" ||
			name == "plugins" || name == "public" || name == "repo" || name == "storage" ||
			name == "temp" || name == "templates" || name == "widgets" {
			continue
		}
		boxes = append(boxes, name)
	}

	return boxes, nil
}

// repairBoxUserID 修复指定笔记本中所有文档的 user_id
func repairBoxUserID(username, box string) error {
	// 从数据库查询该笔记本下所有文档的 path
	paths, err := getDocPathsByBox(box)
	if err != nil {
		return fmt.Errorf("failed to get doc paths: %w", err)
	}

	if len(paths) == 0 {
		return nil
	}

	logging.LogInfof("Repairing %d documents in box %s for user %s", len(paths), box, username)

	// 批量更新 user_id
	if err := updateBlocksUserID(username, box, paths); err != nil {
		return fmt.Errorf("failed to update blocks user_id: %w", err)
	}

	return nil
}

// getDocPathsByBox 从数据库获取指定笔记本下的所有文档路径
func getDocPathsByBox(box string) ([]string, error) {
	// 使用 raw SQL 查询，避免 user_id 过滤
	db := siyuanSQL.GetGlobalDB()
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	// 查询所有 root_id（文档ID）
	rows, err := db.Query("SELECT DISTINCT path FROM blocks WHERE box = ? AND type = 'd'", box)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			continue
		}
		paths = append(paths, path)
	}

	return paths, nil
}

// updateBlocksUserID 更新数据库中块的 user_id
func updateBlocksUserID(userID, box string, paths []string) error {
	db := siyuanSQL.GetGlobalDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	// 使用事务批量更新
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	// 更新 blocks 表
	result, err := tx.Exec("UPDATE blocks SET user_id = ? WHERE box = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update blocks: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d blocks in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	// 更新 spans 表
	result, err = tx.Exec("UPDATE spans SET user_id = ? WHERE box = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update spans: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d spans in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	// 更新 assets 表
	result, err = tx.Exec("UPDATE assets SET user_id = ? WHERE box = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update assets: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d assets in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	// 更新 attributes 表
	result, err = tx.Exec("UPDATE attributes SET user_id = ? WHERE box = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update attributes: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d attributes in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	// 更新 refs 表
	result, err = tx.Exec("UPDATE refs SET user_id = ? WHERE box = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update refs: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d refs in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	// 更新 blocktrees 表 - 使用独立事务，避免依赖 blocks 表数据
	result, err = tx.Exec("UPDATE blocktrees SET user_id = ? WHERE box_id = ? AND (user_id IS NULL OR user_id = '')", userID, box)
	if err != nil {
		return fmt.Errorf("failed to update blocktrees: %w", err)
	}

	if result != nil {
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			logging.LogInfof("Updated %d blocktrees in box %s to user_id %s", rowsAffected, box, userID)
		}
	}

	return nil
}

// SyncBlockTreesUserID 同步 blocktrees 表的 user_id
// 根据 blocks 表中已知的 box-user 映射来修复 blocktrees
func SyncBlockTreesUserID() error {
	db := siyuanSQL.GetGlobalDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	// 获取所有已知的 box-user 映射
	rows, err := db.Query("SELECT DISTINCT box, user_id FROM blocks WHERE user_id IS NOT NULL AND user_id != ''")
	if err != nil {
		return fmt.Errorf("failed to query box-user mapping: %w", err)
	}
	defer rows.Close()

	var mappings []struct {
		Box    string
		UserID string
	}
	for rows.Next() {
		var box, userID string
		if err := rows.Scan(&box, &userID); err != nil {
			continue
		}
		mappings = append(mappings, struct {
			Box    string
			UserID string
		}{Box: box, UserID: userID})
	}

	logging.LogInfof("Syncing blocktrees user_id for %d boxes...", len(mappings))

	// 更新每个 box 对应的 blocktrees
	for _, m := range mappings {
		result, err := db.Exec("UPDATE blocktrees SET user_id = ? WHERE box_id = ? AND (user_id IS NULL OR user_id = '')", m.UserID, m.Box)
		if err != nil {
			logging.LogErrorf("Failed to sync blocktrees for box %s: %s", m.Box, err)
			continue
		}
		if result != nil {
			rowsAffected, _ := result.RowsAffected()
			if rowsAffected > 0 {
				logging.LogInfof("Synced %d blocktrees in box %s to user_id %s", rowsAffected, m.Box, m.UserID)
			}
		}
	}

	return nil
}

// RepairUserDataByWorkspace 根据 workspace 路径修复指定用户的数据
// 用于用户登录时检查并修复自己的数据
func RepairUserDataByWorkspace(username, workspace string) error {
	user := &User{
		Username:  username,
		Workspace: workspace,
	}
	return repairUserData(user)
}

// ForceRepairAllUserData 强制修复所有数据（包括已有 user_id 的数据）
// 仅在数据完全混乱时使用，会将所有数据归属到指定的 workspace 所属用户
func ForceRepairAllUserData() error {
	logging.LogInfof("Starting force repair of all user data...")

	userStore := GetUserStore()
	if userStore == nil {
		logging.LogWarnf("User store not initialized, skipping force repair")
		return nil
	}

	users, err := userStore.List()
	if err != nil {
		return err
	}

	for _, user := range users {
		if err := forceRepairUserData(user); err != nil {
			logging.LogErrorf("Failed to force repair data for user %s: %s", user.Username, err)
			continue
		}
	}

	return nil
}

// forceRepairUserData 强制修复用户数据（更新所有数据，不只是空 user_id）
func forceRepairUserData(user *User) error {
	if user.Workspace == "" {
		return nil
	}

	boxes, err := getUserBoxes(user.Workspace)
	if err != nil {
		return err
	}

	db := siyuanSQL.GetGlobalDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	for _, box := range boxes {
		// 强制更新 blocks 表（不管原来的 user_id 是什么）
		result, err := db.Exec("UPDATE blocks SET user_id = ? WHERE box = ?", user.Username, box)
		if err != nil {
			logging.LogErrorf("Failed to force update blocks for box %s: %s", box, err)
			continue
		}
		if result != nil {
			rowsAffected, _ := result.RowsAffected()
			logging.LogInfof("Force updated %d blocks in box %s to user %s", rowsAffected, box, user.Username)
		}

		// 其他表...
		db.Exec("UPDATE spans SET user_id = ? WHERE box = ?", user.Username, box)
		db.Exec("UPDATE assets SET user_id = ? WHERE box = ?", user.Username, box)
		db.Exec("UPDATE attributes SET user_id = ? WHERE box = ?", user.Username, box)
		db.Exec("UPDATE refs SET user_id = ? WHERE box = ?", user.Username, box)
		db.Exec("UPDATE blocktrees SET user_id = ? WHERE box_id = ?", user.Username, box)
	}

	return nil
}

// GetRepairStatus 获取修复状态报告
func GetRepairStatus() map[string]interface{} {
	db := siyuanSQL.GetGlobalDB()
	if db == nil {
		return map[string]interface{}{
			"error": "database not initialized",
		}
	}

	status := make(map[string]interface{})

	// 统计各表 user_id 为空或缺失的记录数
	tables := []string{"blocks", "spans", "assets", "attributes", "refs", "blocktrees"}
	for _, table := range tables {
		var count int64
		err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE user_id IS NULL OR user_id = ''", table)).Scan(&count)
		if err != nil {
			status[table+"_error"] = err.Error()
		} else {
			status[table+"_missing_user_id"] = count
		}
	}

	// 统计各用户的记录数
	rows, err := db.Query("SELECT user_id, COUNT(*) FROM blocks GROUP BY user_id")
	if err == nil {
		defer rows.Close()
		userCounts := make(map[string]int64)
		for rows.Next() {
			var userID string
			var count int64
			if err := rows.Scan(&userID, &count); err == nil {
				if userID == "" {
					userID = "(empty)"
				}
				userCounts[userID] = count
			}
		}
		status["blocks_by_user"] = userCounts
	}

	return status
}

// InitUserDataRepair 初始化用户数据修复
// 在系统启动完成后调用（数据库已初始化）
func InitUserDataRepair() {
	if os.Getenv("SIYUAN_WEB_MODE") != "true" {
		return
	}

	logging.LogInfof("Initializing user data repair...")
	if err := RepairUserData(); err != nil {
		logging.LogErrorf("User data repair failed: %s", err)
	}

	// 同步 blocktrees 的 user_id（依赖于 blocks 表的数据）
	logging.LogInfof("Syncing blocktrees user_id...")
	if err := SyncBlockTreesUserID(); err != nil {
		logging.LogErrorf("Sync blocktrees user_id failed: %s", err)
	}
}
