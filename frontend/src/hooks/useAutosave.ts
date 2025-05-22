    // src/hooks/useAutosave.ts
    import { useRef, useEffect, useCallback } from 'react';
    import debounce from 'lodash.debounce';

    type SaveFunction<T> = (data: T) => Promise<boolean | void>;

    interface AutosaveOptions<T> {
      data: T;
      onSave: SaveFunction<T>;
      debounceMs?: number;
      enabled?: boolean;
    }

    export function useAutosave<T>({ // Make sure 'export' is here
      data,
      onSave,
      debounceMs = 3000,
      enabled = true,
    }: AutosaveOptions<T>) {
      const isMounted = useRef(false);

      const debouncedSave = useCallback(
        debounce(async (saveData: T) => {
          if (!enabled) {
            // console.log('[useAutosave] Autosave skipped: Not enabled when debounced function was called.');
            return;
          }
          console.log('[useAutosave] Debounced save triggered. Attempting to execute onSave with data:', saveData);
          try {
            await onSave(saveData);
            console.log('[useAutosave] onSave successfully executed after debounce.');
          } catch (error) {
            console.error('[useAutosave] Autosave failed during onSave execution:', error);
          }
        }, debounceMs),
        [onSave, debounceMs, enabled]
      );

      useEffect(() => {
        if (!enabled) {
          // console.log('[useAutosave] Autosave explicitly disabled. Cancelling any pending saves.');
          debouncedSave.cancel();
          return;
        }

        if (isMounted.current) {
          if (data !== undefined && data !== null) {
            // console.log('[useAutosave] Data prop changed or autosave re-enabled. Scheduling debounced save.');
            debouncedSave(data);
          }
        } else {
          isMounted.current = true;
          // console.log('[useAutosave] Hook mounted. Autosave is currently enabled:', enabled);
          // Optional: if you want to save on initial mount when data is present
          // if (enabled && data !== undefined && data !== null) {
          //   debouncedSave(data);
          // }
        }

        return () => {
          // console.log('[useAutosave] Cleaning up: Cancelling pending debounced save.');
          debouncedSave.cancel();
        };
      }, [data, debouncedSave, enabled]);
    }
