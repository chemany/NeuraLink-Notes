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

package conf

// Sync 云同步配置（已禁用，保留空结构以保持API兼容）
type Sync struct {
	Enabled             bool    `json:"enabled"`               // 是否开启同步
	Perception          bool    `json:"perception"`            // 是否开启感知
	Mode                int     `json:"mode"`                  // 同步模式
	Interval            int     `json:"interval"`              // 自动同步间隔
	Synced              int64   `json:"synced"`                // 最近同步时间
	Stat                string  `json:"stat"`                  // 最近同步统计信息
	GenerateConflictDoc bool    `json:"generateConflictDoc"`   // 云端同步冲突时是否生成冲突文档
	Provider            int     `json:"provider"`              // 云端存储服务提供者
	S3                  *S3     `json:"s3"`                    // S3 对象存储服务配置
	WebDAV              *WebDAV `json:"webdav"`                // WebDAV 服务配置
	Local               *Local  `json:"local"`                 // 本地文件系统 服务配置
	CloudName           string  `json:"cloudName"`             // 云端同步目录名称
}

func NewSync() *Sync {
	return &Sync{
		Enabled:  false,
		Provider: ProviderSiYuan,
	}
}

type S3 struct {
	Endpoint       string `json:"endpoint"`
	AccessKey      string `json:"accessKey"`
	SecretKey      string `json:"secretKey"`
	Bucket         string `json:"bucket"`
	Region         string `json:"region"`
	PathStyle      bool   `json:"pathStyle"`
	SkipTlsVerify  bool   `json:"skipTlsVerify"`
	Timeout        int    `json:"timeout"`
	ConcurrentReqs int    `json:"concurrentReqs"`
}

type WebDAV struct {
	Endpoint       string `json:"endpoint"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	SkipTlsVerify  bool   `json:"skipTlsVerify"`
	Timeout        int    `json:"timeout"`
	ConcurrentReqs int    `json:"concurrentReqs"`
}

type Local struct {
	Endpoint       string `json:"endpoint"`
	Timeout        int    `json:"timeout"`
	ConcurrentReqs int    `json:"concurrentReqs"`
}

const (
	ProviderSiYuan = 0
	ProviderS3     = 2
	ProviderWebDAV = 3
	ProviderLocal  = 4
)

func ProviderToStr(provider int) string {
	switch provider {
	case ProviderSiYuan:
		return "SiYuan"
	case ProviderS3:
		return "S3"
	case ProviderWebDAV:
		return "WebDAV"
	case ProviderLocal:
		return "Local File System"
	}
	return "Unknown"
}
