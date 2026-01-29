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

// Graph 关系图配置（已禁用，保留空结构以保持API兼容）
type Graph struct {
	Local  *GraphNode `json:"local"`
	Global *GraphNode `json:"global"`
}

type GraphNode struct {
	Enable       bool     `json:"enable"`
	MinLevenshteinSimilarity float64 `json:"minLevenshteinSimilarity"`
	MaxNodes     int      `json:"maxNodes"`
	MaxLinks     int      `json:"maxLinks"`
	ExpandLevel  int      `json:"expandLevel"`
}

func NewGraph() *Graph {
	return &Graph{
		Local: &GraphNode{
			Enable:       false,
			MinLevenshteinSimilarity: 0.4,
			MaxNodes:     200,
			MaxLinks:     500,
			ExpandLevel:  2,
		},
		Global: &GraphNode{
			Enable:       false,
			MinLevenshteinSimilarity: 0.6,
			MaxNodes:     500,
			MaxLinks:     800,
			ExpandLevel:  2,
		},
	}
}
