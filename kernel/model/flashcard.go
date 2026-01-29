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
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/riff"
)

// builtinDeckID 内置卡组ID（闪卡功能已移除）
var builtinDeckID = "20210808180117-czj9b0p"

// Decks 卡组映射（闪卡功能已移除，保留空map）
var Decks = map[string]*riff.Deck{}

// LoadFlashcards 加载闪卡（闪卡功能已移除）
func LoadFlashcards() {
	// 闪卡功能已移除
}

// countBoxFlashcard 统计笔记本闪卡数量（闪卡功能已移除）
func countBoxFlashcard(boxID string, deck *riff.Deck, blocks []string) (count int, newCount int, reviewCount int) {
	// 闪卡功能已移除
	return 0, 0, 0
}

// countTreeFlashcard 统计文档闪卡数量（闪卡功能已移除）
func countTreeFlashcard(treeID string, deck *riff.Deck, blocks []string) (count int, newCount int, reviewCount int) {
	// 闪卡功能已移除
	return 0, 0, 0
}

// getTreeFlashcards 获取文档闪卡（闪卡功能已移除）
func getTreeFlashcards(treeID string) (cards []*RiffCard) {
	// 闪卡功能已移除
	return
}

// GetFlashcardNotebooks 获取有闪卡的笔记本（闪卡功能已移除）
func GetFlashcardNotebooks() (notebooks []*Box) {
	// 闪卡功能已移除
	return
}

// CreateRiffDeck 创建卡组
func CreateRiffDeck(name string) (deck *riff.Deck, err error) {
	// 闪卡功能已移除
	return
}

// RenameRiffDeck 重命名卡组
func RenameRiffDeck(id, name string) (err error) {
	// 闪卡功能已移除
	return
}

// RemoveRiffDeck 移除卡组
func RemoveRiffDeck(id string) (err error) {
	// 闪卡功能已移除
	return
}

// GetRiffDecks 获取所有卡组
func GetRiffDecks() (decks []*riff.Deck, err error) {
	// 闪卡功能已移除
	return
}

// AddRiffCards 添加闪卡
func AddRiffCards(deckID string, cards []*RiffCard) (newCards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// RemoveRiffCards 移除闪卡
func RemoveRiffCards(cardIDs []string) (err error) {
	// 闪卡功能已移除
	return
}

// GetRiffDueCards 获取待复习闪卡
func GetRiffDueCards(limit int) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// GetTreeRiffDueCards 获取文档待复习闪卡
func GetTreeRiffDueCards(treeID string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// GetNotebookRiffDueCards 获取笔记本待复习闪卡
func GetNotebookRiffDueCards(boxID string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// ReviewRiffCard 复习闪卡
func ReviewRiffCard(cardID string, rating int) (card *RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// SkipReviewRiffCard 跳过复习闪卡
func SkipReviewRiffCard(cardID string) (card *RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// GetRiffCards 获取闪卡
func GetRiffCards(deckID string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// GetTreeRiffCards 获取文档闪卡
func GetTreeRiffCards(treeID string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// GetNotebookRiffCards 获取笔记本闪卡
func GetNotebookRiffCards(boxID string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// ResetRiffCards 重置闪卡
func ResetRiffCards(cardIDs []string) (err error) {
	// 闪卡功能已移除
	return
}

// BatchSetRiffCardsDueTime 批量设置闪卡到期时间
func BatchSetRiffCardsDueTime(cardIDs []string, dueTime int64) (err error) {
	// 闪卡功能已移除
	return
}

// GetRiffCardsByBlockIDs 根据块ID获取闪卡
func GetRiffCardsByBlockIDs(blockIDs []string) (cards []*RiffCard, err error) {
	// 闪卡功能已移除
	return
}

// SetFlashcardConf 设置闪卡配置
func SetFlashcardConf(conf *conf.Flashcard) {
	// 闪卡功能已移除
	Conf.Flashcard = conf
	Conf.Save()
}
