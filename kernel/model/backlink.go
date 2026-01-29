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

package model

import (
	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/task"
	"github.com/siyuan-note/siyuan/kernel/treenode"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// RefreshBacklink 刷新反向链接（仅维护引用计数，UI功能已移除）
func RefreshBacklink(id string) {
	RefreshBacklinkWithContext(GetDefaultWorkspaceContext(), id)
}

// RefreshBacklinkWithContext 刷新反向链接（带上下文）
func RefreshBacklinkWithContext(ctx *WorkspaceContext, id string) {
	FlushTxQueue()
	refreshRefsByDefIDWithContext(ctx, id)
}

// refreshRefsByDefID 刷新引用计数
func refreshRefsByDefID(defID string) {
	refreshRefsByDefIDWithContext(GetDefaultWorkspaceContext(), defID)
}

// refreshRefsByDefIDWithContext 刷新引用计数（带上下文）
func refreshRefsByDefIDWithContext(ctx *WorkspaceContext, defID string) {
	refs := sql.QueryRefsByDefID(defID, true)
	var rootIDs []string
	for _, ref := range refs {
		rootIDs = append(rootIDs, ref.RootID)
		task.AppendAsyncTaskWithDelay(task.SetDefRefCount, util.SQLFlushInterval, refreshRefCount, ref.DefBlockID)
	}
	rootIDs = gulu.Str.RemoveDuplicatedElem(rootIDs)
	trees := LoadTreesWithContext(ctx, rootIDs)
	for _, tree := range trees {
		sql.UpdateRefsTreeQueue(tree)
		task.AppendAsyncTaskWithDelay(task.SetDefRefCount, util.SQLFlushInterval, refreshRefCount, tree.ID)
	}
	if bt := treenode.GetBlockTree(defID); nil != bt {
		task.AppendAsyncTaskWithDelay(task.SetDefRefCount, util.SQLFlushInterval, refreshRefCount, defID)
	}
}

// buildFullLinks 构建完整链接（用于全文检索，UI功能已移除）
func buildFullLinks(condition string) (forwardlinks, backlinks []*Block) {
	// 保留用于搜索查询
	return
}

// getBacklinkRenderNodes 获取反向链接渲染节点（UI功能已移除）
func getBacklinkRenderNodes(node *ast.Node, originalRefBlockIDs map[string]string) (ret []*ast.Node, expand bool) {
	// 双链UI功能已移除
	return
}
