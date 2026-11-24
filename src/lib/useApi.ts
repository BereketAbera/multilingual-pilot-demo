import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './api';

interface Result<T> {
  key: string;
  data: T | null;
  error: unknown;
}

/** Loads one API resource. `loading` is true until the answer for the current path arrives. */
export function useApi<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = `${path}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    apiGet<T>(path, controller.signal).then(
      (data) => setResult({ key, data, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, data: null, error });
      },
    );
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: current === null, reload };
}
