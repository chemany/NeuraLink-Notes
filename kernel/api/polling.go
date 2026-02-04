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

package api

import (
	"net/http"
	"runtime"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/task"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// getSystemStatus 返回系统状态信息，用于前端轮询
// 系统状态是全局的，不区分用户
func getSystemStatus(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	// 获取当前任务状态
	tasks := task.GetCurrentTasks()

	// 获取内存使用情况
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	ret.Data = map[string]interface{}{
		"status":  "running",
		"memory":  m.Alloc,
		"cpu":     0, // CPU使用率需要额外计算
		"msg":     "",
		"tasks":   tasks,
	}
}

// getTaskList 返回当前后台任务列表
// 后台任务是全局的，不区分用户
func getTaskList(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	tasks := task.GetCurrentTasks()
	ret.Data = map[string]interface{}{
		"tasks": tasks,
	}
}

// getRefCount 返回引用计数信息
// 使用用户的工作空间上下文来隔离数据
func getRefCount(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	// 设置当前执行上下文（用于用户数据隔离）
	ctx := model.GetWorkspaceContext(c)
	model.SetCurrentExecutionContext(ctx)
	defer model.ClearCurrentExecutionContext()

	// 获取请求参数
	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	rootID := ""
	if nil != arg["rootID"] {
		rootID = arg["rootID"].(string)
	}

	// 返回空的引用计数，前端需要时可以调用此API获取
	// 实际的引用计数更新由操作触发
	ret.Data = map[string]interface{}{
		"rootID":  rootID,
		"counts":  []map[string]interface{}{},
	}
}

// getTagList 返回标签列表
// 使用用户的工作空间上下文来隔离数据
func getTagList(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	// 设置当前执行上下文（用于用户数据隔离）
	ctx := model.GetWorkspaceContext(c)
	model.SetCurrentExecutionContext(ctx)
	defer model.ClearCurrentExecutionContext()

	// 获取请求参数
	arg, _ := util.JsonArg(c, ret)
	app := ""
	if nil != arg["app"] {
		app = arg["app"].(string)
	}

	// 使用现有的 BuildTags 获取标签（已支持用户隔离）
	tags := model.BuildTags(false, app)
	ret.Data = map[string]interface{}{
		"tags": tags,
	}
}
