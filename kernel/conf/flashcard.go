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

// Flashcard 闪卡配置（已禁用，保留空结构以保持API兼容）
type Flashcard struct {
	Enabled          bool    `json:"enabled"`
	NewCardLimit     int     `json:"newCardLimit"`
	ReviewCardLimit  int     `json:"reviewCardLimit"`
	RequestRetention float64 `json:"requestRetention"`
	MaximumInterval  int     `json:"maximumInterval"`
	Weights          string  `json:"weights"`
}

func NewFlashcard() *Flashcard {
	return &Flashcard{
		Enabled:          false,
		NewCardLimit:     20,
		ReviewCardLimit:  200,
		RequestRetention: 0.9,
		MaximumInterval:  36500,
		Weights:          "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1",
	}
}
