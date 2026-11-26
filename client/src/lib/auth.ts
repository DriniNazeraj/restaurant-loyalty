import { useSyncExternalStore } from "react";
import type { StaffRestaurant, StaffUser } from "@/lib/api-types";

const SESSION_KEY = "loyalty.staffSession";

export type StaffSession = { token: string; staff: StaffUser; restaurant: StaffRestaurant };

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSession: StaffSession | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function readStaffSession(): StaffSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  try {
    cachedSession = raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

export function getStaffToken(): string | null {
  return readStaffSession()?.token ?? null;
}

export function saveStaffSession(session: StaffSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emit();
}

export function updateSessionRestaurant(restaurant: StaffRestaurant): void {
  const session = readStaffSession();
  if (session) saveStaffSession({ ...session, restaurant });
}

export function clearStaffSession(): void {
  localStorage.removeItem(SESSION_KEY);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStaffSession(): StaffSession | null {
  return useSyncExternalStore(subscribe, readStaffSession, () => null);
}

export function isOwner(session: StaffSession | null): boolean {
  return session?.staff.role === "owner";
}
