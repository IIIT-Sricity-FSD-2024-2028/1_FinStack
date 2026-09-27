import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SUCCESS_DURATION_MS = 3000;

export function useTransientSuccess(
  durationMs = DEFAULT_SUCCESS_DURATION_MS,
) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearSuccess = useCallback(() => {
    clearTimer();
    if (mountedRef.current) setMessage(null);
  }, [clearTimer]);

  const showSuccess = useCallback(
    (nextMessage: string) => {
      clearTimer();
      if (!mountedRef.current) return;
      setMessage(nextMessage);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (mountedRef.current) setMessage(null);
      }, durationMs);
    },
    [clearTimer, durationMs],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return { message, showSuccess, clearSuccess };
}
