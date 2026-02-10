package model

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestExecutionContextIsolationAcrossGoroutines(t *testing.T) {
	const workers = 256

	var mismatchCount int32
	start := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			expected := &WorkspaceContext{UserID: fmt.Sprintf("user-%d", i)}
			SetCurrentExecutionContext(expected)
			defer ClearCurrentExecutionContext()

			// Give other goroutines enough time to set their own contexts.
			time.Sleep(1 * time.Millisecond)

			got := GetCurrentExecutionContext()
			if got == nil || got.UserID != expected.UserID {
				atomic.AddInt32(&mismatchCount, 1)
			}
		}()
	}

	close(start)
	wg.Wait()

	if mismatchCount != 0 {
		t.Fatalf("execution context leaked across goroutines, mismatches=%d", mismatchCount)
	}
}
