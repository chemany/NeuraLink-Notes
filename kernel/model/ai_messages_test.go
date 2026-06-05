package model

import (
	"testing"

	"github.com/sashabaranov/go-openai"
)

func TestNormalizeSystemMessagesMergesMultipleSystemPrompts(t *testing.T) {
	messages := []openai.ChatCompletionMessage{
		{Role: "system", Content: "前端系统提示"},
		{Role: "user", Content: "第一个问题"},
		{Role: "assistant", Content: "第一个回答"},
		{Role: "system", Content: "RAG 注入内容"},
		{Role: "user", Content: "第二个问题"},
	}

	got := normalizeSystemMessages(messages)

	if len(got) != 4 {
		t.Fatalf("normalizeSystemMessages() returned %d messages, want 4", len(got))
	}

	if got[0].Role != "system" {
		t.Fatalf("first message role = %q, want system", got[0].Role)
	}

	wantSystem := "前端系统提示\n\nRAG 注入内容"
	if got[0].Content != wantSystem {
		t.Fatalf("merged system content = %q, want %q", got[0].Content, wantSystem)
	}

	for i := 1; i < len(got); i++ {
		if got[i].Role == "system" {
			t.Fatalf("message %d still has system role after normalization", i)
		}
	}

	if got[1].Content != "第一个问题" || got[2].Content != "第一个回答" || got[3].Content != "第二个问题" {
		t.Fatalf("non-system message order changed: %#v", got)
	}
}
