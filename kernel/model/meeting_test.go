package model

import (
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestCallASRTimesOutWhenServiceDoesNotReturnResult(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	upgrader := websocket.Upgrader{}
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})}
	go server.Serve(listener)
	defer server.Close()

	oldEndpoint := asrEndpoint
	oldWriteTimeout := asrWriteTimeout
	oldResultTimeout := asrResultTimeout
	asrEndpoint = "ws://" + listener.Addr().String() + "/"
	asrWriteTimeout = time.Second
	asrResultTimeout = 20 * time.Millisecond
	defer func() {
		asrEndpoint = oldEndpoint
		asrWriteTimeout = oldWriteTimeout
		asrResultTimeout = oldResultTimeout
	}()

	audioData := make([]byte, 44+320)
	copy(audioData, "RIFF")
	_, err = Meeting.callASR(audioData)
	if err == nil || !strings.Contains(err.Error(), "ASR 识别超时") {
		t.Fatalf("期望 ASR 识别超时错误，实际为: %v", err)
	}
}
