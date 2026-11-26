/** Guest-side storage, scoped per restaurant slug (docs/api.md device token flow). */
const deviceTokenKey = (slug: string) => `loyalty_device_token:${slug}`;
const ticketKey = (slug: string) => `loyalty_ticket:${slug}`;

export type CachedTicket = {
  deviceToken: string;
  code: string;
  title: string;
  firstName: string;
  status: "active" | "redeemed" | "expired";
  expiresAt: string | null;
  redeemedAt: string | null;
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / storage full: the reward still shows for this visit.
  }
}

export function readDeviceToken(slug: string): string | null {
  return safeGet(deviceTokenKey(slug));
}

export function saveTicket(slug: string, ticket: CachedTicket): void {
  safeSet(deviceTokenKey(slug), ticket.deviceToken);
  safeSet(ticketKey(slug), JSON.stringify(ticket));
}

export function readTicket(slug: string, deviceToken?: string): CachedTicket | null {
  const raw = safeGet(ticketKey(slug));
  if (!raw) return null;
  try {
    const ticket = JSON.parse(raw) as CachedTicket;
    if (deviceToken && ticket.deviceToken !== deviceToken) return null;
    return ticket;
  } catch {
    return null;
  }
}
