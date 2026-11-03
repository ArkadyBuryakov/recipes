import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";

const PREFIX = "recipes:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * useState mirrored to localStorage. Renders `initial` on the server and the first client render
 * (no hydration mismatch), then loads the stored value; syncs across tabs.
 */
export function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `initial` is only a fallback for this key
  useEffect(() => {
    setValue(read(key, initial));
    setLoaded(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + key) setValue(read(key, initial));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setValue((prev) => {
        const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch {
          // storage full or disabled: keep in memory
        }
        return next;
      });
    },
    [key],
  );

  return [value, set, loaded];
}
