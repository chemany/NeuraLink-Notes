    // src/hooks/useAutosave.ts
    import { useRef, useEffect, useCallback } from 'react';
    import debounce from 'lodash.debounce';

    type SaveFunction<T> = (data: T) => Promise<void>;

    interface AutosaveOptions<T> {
      data: T;
      onSave: SaveFunction<T>;
      debounceMs?: number;
      enabled?: boolean;
    }

    export function useAutosave<T>({ // Make sure 'export' is here
      data,
      onSave,
      debounceMs = 2000,
      enabled = true,
    }: AutosaveOptions<T>) {
      const isMounted = useRef(false);

      const debouncedSave = useCallback(
        debounce(async (saveData: T) => {
          if (!enabled) return; // Also check enabled inside debounced call
          console.log('Autosaving data:', saveData);
          try {
            await onSave(saveData);
            console.log('Autosave successful.');
          } catch (error) {
            console.error('Autosave failed:', error);
            // toast.error('自动保存笔记失败'); // Consider if toast is appropriate here or in calling component
          }
        }, debounceMs),
        [onSave, debounceMs, enabled] // Added enabled to dependencies
      );

      useEffect(() => {
        if (!enabled) {
          debouncedSave.cancel(); // Cancel any pending saves if disabled
          return;
        }

        if (isMounted.current) {
          if (data !== undefined && data !== null) {
            debouncedSave(data);
          }
        } else {
          isMounted.current = true;
        }

        return () => {
          debouncedSave.cancel();
        };
      }, [data, debouncedSave, enabled]);
    }
