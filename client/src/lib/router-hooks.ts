import { useLocation, useParams as useWouterParams } from "wouter";
import { navigate as browserNavigate, useHistoryState } from "wouter/use-browser-location";

export type NavigateOptions = { replace?: boolean; state?: unknown };

export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  return browserNavigate;
}

export function usePathname(): string {
  return useLocation()[0];
}

/** `history.state` set by navigate(..., { state }); null after a fresh load. */
export function useLocationState<T>(): T | null {
  return (useHistoryState() as T | null) ?? null;
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useWouterParams() as T;
}

