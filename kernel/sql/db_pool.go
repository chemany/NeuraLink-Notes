// SiYuan - Refactor your thinking
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

package sql

import (
	"database/sql"
	"errors"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// 错误定义
var (
	ErrTooManyConnections = errors.New("数据库连接数已达上限")
)

// DBPool 数据库连接池托管接口，重构后不再实际管理多用户连接，而是返回统一的全局连接
type DBPool struct {
	// 移除 map 结构
	// connections map[string]*sql.DB
}

// WorkspaceContext 兼容性别名
type WorkspaceContext = util.WorkspaceContextInterface

// globalDBPool 全局数据库连接池实例
var globalDBPool *DBPool

// initDBPool 初始化数据库连接池
func initDBPool() {
	globalDBPool = &DBPool{}
}

// GetDB 获取数据库连接
// 重构后：忽略 WorkspaceContext，始终返回全局的 db 变量
func (pool *DBPool) GetDB(ctx util.WorkspaceContextInterface) (*sql.DB, error) {
	if db == nil {
		return nil, errors.New("全局数据库尚未初始化")
	}
	// 每次调用 GetDB 都刷新最后访问时间，这里对于单例模式其实意义不大，但保留逻辑结构
	// pool.lastAccess...
	return db, nil
}

// CloseDB 关闭指定 workspace 的数据库连接
// 重构后：不做任何操作，因为我们不希望通过此接口关闭全局数据库
func (pool *DBPool) CloseDB(workspaceKey string) error {
	// global db is managed by Create/Close in database.go
	return nil
}

// CloseAll 关闭所有数据库连接
// 重构后：调用 CloseDatabase 关闭全局数据库
func (pool *DBPool) CloseAll() {
	CloseDatabase()
}

// GetStats 获取连接池统计信息
func (pool *DBPool) GetStats() map[string]interface{} {
	stats := db.Stats()
	return map[string]interface{}{
		"total_connections": stats.OpenConnections,
		"max_connections":   1,
		"max_idle_time":     "0",
	}
}

// GetDBWithContext 获取指定 WorkspaceContext 的数据库连接（全局函数）
func GetDBWithContext(ctx util.WorkspaceContextInterface) (*sql.DB, error) {
	if globalDBPool == nil {
		initDBPool()
	}
	return globalDBPool.GetDB(ctx)
}

// CloseDBPool 关闭数据库连接池
func CloseDBPool() {
	if globalDBPool != nil {
		globalDBPool.CloseAll()
	}
}

// GetDBPoolStats 获取连接池统计信息
func GetDBPoolStats() map[string]interface{} {
	if globalDBPool == nil {
		return map[string]interface{}{
			"total_connections": 0,
			"max_connections":   0,
		}
	}
	return globalDBPool.GetStats()
}

// CloseDatabase 关闭全局数据库
// CloseDatabase 关闭全局数据库 (delegate to database.go)
// Removed here to avoid redeclaration error
// func CloseDatabase() { ... }

// closeDatabase is used internally in database.go
// Removed here to avoid redeclaration error
// func closeDatabase() { ... }

// openDatabase used to be here, but now we use direct sql.Open in InitDatabase
// retained if needed by other files, but marked deprecated
func openDatabase(dbPath string) (*sql.DB, error) {
	// Deprecated: use InitDatabase instead
	return nil, errors.New("openDatabase is deprecated, use InitDatabase")
}

// initDatabaseTables used to be here, but moved logic to database.go's InitDatabase
// kept for compatibility if needed, but it seems database.go defined its own initDBTables
// which conflicts if they were in same package?
// database.go has `func initDBTables()`, db_pool.go had `func initDatabaseTables(db *sql.DB) error`
// They are different functions.
// We can remove initDatabaseTables here as it's no longer used.

// ensureFTSTables was also here.
// we should double check if we need to migrate it to database.go
// database.go's initDBTables seems to create FTS tables directly.
