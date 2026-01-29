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
	"sync/atomic"
	"time"

	"github.com/siyuan-note/siyuan/kernel/conf"
)

// KernelID 内核标识（云同步功能已移除，保留空值）
var KernelID = ""

// BootSyncSucc 启动同步成功标志（云同步功能已移除）
var BootSyncSucc = 0

// ExitSyncSucc 退出同步成功标志（云同步功能已移除）
var ExitSyncSucc = 0

// syncSameCount 同步相同计数（云同步功能已移除）
var syncSameCount atomic.Int64

// autoSyncErrCount 自动同步错误计数（云同步功能已移除）
var autoSyncErrCount = 0

// IncSync 增量同步（云同步功能已移除，保留空函数以保持API兼容）
func IncSync() {
	// 云同步功能已移除，此函数不再执行任何操作
}

// IncSyncWithContext 增量同步（带上下文）
func IncSyncWithContext(ctx *WorkspaceContext) {
	// 云同步功能已移除，此函数不再执行任何操作
}

// lockSync 获取同步锁
func lockSync() {
	// 云同步功能已移除，无需锁定
}

// unlockSync 释放同步锁
func unlockSync() {
	// 云同步功能已移除，无需解锁
}

// upsertIndexes 插入或更新索引
func upsertIndexes(upsertFilePaths []string) (upsertRootIDs []string) {
	// 云同步功能已移除
	return
}

// removeIndexes 移除索引
func removeIndexes(removeFilePaths []string) (removeRootIDs []string) {
	// 云同步功能已移除
	return
}

// formatRepoErrorMsg 格式化仓库错误消息
func formatRepoErrorMsg(err error) string {
	return err.Error()
}

// fixSyncInterval 修复同步间隔
func fixSyncInterval() time.Duration {
	// 云同步功能已移除
	return 0
}

// checkSync 检查同步状态
func checkSync(boot, exit, byHand bool) bool {
	// 云同步功能已移除
	return false
}

// incReindex 增量重新索引
func incReindex(upserts, removes []string) (upsertRootIDs, removeRootIDs []string) {
	// 云同步功能已移除
	return
}

// syncData 同步数据（云同步功能已移除）
func syncData(exit, byHand bool) {
	// 云同步功能已移除
}

// SetSyncEnable 设置同步启用状态
func SetSyncEnable(b bool) {
	Conf.Sync.Enabled = false
	Conf.Save()
}

// SetSyncInterval 设置同步间隔
func SetSyncInterval(interval int) {
	Conf.Sync.Interval = 30
	Conf.Save()
}

// SetSyncPerception 设置感知同步
func SetSyncPerception(b bool) {
	// 云同步功能已移除
}

// SetSyncMode 设置同步模式
func SetSyncMode(mode int) {
	// 云同步功能已移除
}

// SetSyncProvider 设置同步提供者
func SetSyncProvider(provider int) (err error) {
	// 云同步功能已移除
	return
}

// SetSyncProviderS3 设置S3同步配置
func SetSyncProviderS3(s3 *conf.S3) (err error) {
	// 云同步功能已移除
	return
}

// SetSyncProviderWebDAV 设置WebDAV同步配置
func SetSyncProviderWebDAV(webdav *conf.WebDAV) (err error) {
	// 云同步功能已移除
	return
}

// SetSyncProviderLocal 设置本地同步配置
func SetSyncProviderLocal(local *conf.Local) (err error) {
	// 云同步功能已移除
	return
}

// SetCloudSyncDir 设置云同步目录名称
func SetCloudSyncDir(name string) {
	// 云同步功能已移除
}

// SetSyncGenerateConflictDoc 设置是否生成冲突文档
func SetSyncGenerateConflictDoc(b bool) {
	// 云同步功能已移除
}

// BootSyncData 启动同步数据
func BootSyncData() {
	// 云同步功能已移除
}

// SyncData 下载同步数据
func SyncDataDownload() {
	// 云同步功能已移除
}

// SyncDataUpload 上传同步数据
func SyncDataUpload() {
	// 云同步功能已移除
}

// SyncDataJob 同步数据任务
func SyncDataJob() {
	// 云同步功能已移除
}

// SyncData 同步数据（主函数）
func SyncData(byHand bool) {
	// 云同步功能已移除
}

// planSyncAfter 计划延迟同步
func planSyncAfter(arg interface{}) {
	// 云同步功能已移除
}

// CreateCloudSyncDir 创建云同步目录
func CreateCloudSyncDir(name string) (err error) {
	// 云同步功能已移除
	return
}

// RemoveCloudSyncDir 移除云同步目录
func RemoveCloudSyncDir(name string) (err error) {
	// 云同步功能已移除
	return
}

// ListCloudSyncDir 列出云同步目录
func ListCloudSyncDir() (syncDirs []*Sync, hSize string, err error) {
	// 云同步功能已移除
	return
}

// getSyncIgnoreLines 获取同步忽略规则
func getSyncIgnoreLines() (ret []string) {
	// 云同步功能已移除
	return
}
