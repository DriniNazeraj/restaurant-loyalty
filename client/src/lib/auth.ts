import type { StaffRestaurant, StaffUser } from "@/lib/api";

const TOKEN_KEY = "loyalty.staffToken";
const SESSION_KEY = "loyalty.staffSession";

export type StaffSession = {
  token: string;
  staff: StaffUser;
  restaurant: StaffRestaurant;
};

export function getStaffToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function readStaffSession(): StaffSession | null {
  const token = getStaffToken();
  const raw = localStorage.getItem(SESSION_KEY);
  if (!token || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Omit<StaffSession, "token">;
    return { token, ...parsed };
  } catch {
    return null;
  }
}

export function saveStaffSession(session: StaffSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ staff: session.staff, restaurant: session.restaurant }),
  );
}

export function clearStaffSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}
