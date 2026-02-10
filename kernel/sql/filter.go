package sql

import (
	"strings"

	"github.com/xwb1989/sqlparser"
)

// GetUserIDFallback 用于在 SQL 包未显式设置 Context 时回退获取当前用户 ID。
var GetUserIDFallback func() string

// GetUserIDFilter 获取用户 ID 过滤条件
func GetUserIDFilter() string {
	if ctx, ok := GetCurrentContext(); ok {
		userID := ctx.GetUserID()
		if "" != userID {
			return " AND user_id = '" + userID + "'"
		}
	}
	return ""
}

// GetUserID 获取用户 ID
func GetUserID() string {
	if ctx, ok := GetCurrentContext(); ok {
		if userID := ctx.GetUserID(); "" != userID {
			return userID
		}
	}

	if nil != GetUserIDFallback {
		return GetUserIDFallback()
	}
	return ""
}

// InjectUserIDFilter 为 SQL 语句注入 user_id 过滤条件
func InjectUserIDFilter(stmt string) string {
	userID := GetUserID()
	if "" == userID {
		return stmt
	}

	// 尝试使用 sqlparser 解析
	parsedStmt, err := sqlparser.Parse(stmt)
	if err != nil {
		// 解析失败，回退到字符串处理
		lowerStmt := strings.ToLower(stmt)
		if strings.Contains(lowerStmt, "user_id =") || strings.Contains(lowerStmt, "user_id=") {
			return stmt
		}

		if strings.Contains(lowerStmt, " where ") {
			idx := strings.Index(lowerStmt, " where ")
			if idx != -1 {
				return stmt[:idx+7] + "user_id = '" + userID + "' AND " + stmt[idx+7:]
			}
		}
		if strings.Contains(lowerStmt, " order by ") {
			idx := strings.Index(lowerStmt, " order by ")
			if idx != -1 {
				return stmt[:idx] + " WHERE user_id = '" + userID + "' " + stmt[idx:]
			}
		}
		if strings.Contains(lowerStmt, " limit ") {
			idx := strings.Index(lowerStmt, " limit ")
			if idx != -1 {
				return stmt[:idx] + " WHERE user_id = '" + userID + "' " + stmt[idx:]
			}
		}
		// 如果没有任何 WHERE/ORDER BY/LIMIT，且是简单语句，尝试直接附加
		if !strings.Contains(lowerStmt, "values") && !strings.Contains(lowerStmt, "set") {
			return stmt + " WHERE user_id = '" + userID + "'"
		}
		return stmt
	}

	// 递归注入函数
	injectRecursive(parsedStmt, userID)

	return sqlparser.String(parsedStmt)
}

func injectRecursive(node sqlparser.SQLNode, userID string) {
	_ = sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
		switch s := node.(type) {
		case *sqlparser.Select:
			injectWhere(&s.Where, userID)
		case *sqlparser.Update:
			injectWhere(&s.Where, userID)
		case *sqlparser.Delete:
			injectWhere(&s.Where, userID)
		}
		return true, nil
	}, node)
}

func injectWhere(where **sqlparser.Where, userID string) {
	userIDExpr := &sqlparser.ComparisonExpr{
		Operator: sqlparser.EqualStr,
		Left:     &sqlparser.ColName{Name: sqlparser.NewColIdent("user_id")},
		Right:    sqlparser.NewStrVal([]byte(userID)),
	}

	// 检查是否已经存在 user_id 过滤（简单检查）
	if *where != nil {
		if strings.Contains(sqlparser.String(*where), "user_id") {
			return
		}
		(*where).Expr = &sqlparser.AndExpr{
			Left:  &sqlparser.ParenExpr{Expr: (*where).Expr},
			Right: userIDExpr,
		}
	} else {
		*where = sqlparser.NewWhere(sqlparser.WhereStr, userIDExpr)
	}
}
