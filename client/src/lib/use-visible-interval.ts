import { useEffect, useRef } from "react";

/**
 * Runs `callback` every `ms` only while document.visibilityState is "visible"
 * (DESIGN.md §3.2 / §8b). Also ticks on a visibilitychange back to visible.
 */
export function useVisibleInterval(
  callback: () => void,
  ms: number,
  enabled = true,
  immediate = false,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    };

    if (immediate) tick();
    const id = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, ms, immediate]);
}
