package model

import (
	"github.com/siyuan-note/siyuan/kernel/sql"
)

// getUserIDFilter 获取用户 ID 过滤条件
func getUserIDFilter() string {
	return sql.GetUserIDFilter()
}

// getUserID 获取用户 ID
func getUserID() string {
	return sql.GetUserID()
}

// InjectUserIDFilter 兼容性别名，指向 sql.InjectUserIDFilter
func InjectUserIDFilter(stmt string) string {
	return sql.InjectUserIDFilter(stmt)
}
