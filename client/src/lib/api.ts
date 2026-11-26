const DEFAULT_API_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;
  return raw.replace(/\/$/, "");
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "ALREADY_REDEEMED"
  | "CONTACT_CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  rewardTitle: string;
  rewardDescription: string;
  brandColor: string;
  consentText: string;
};

export type StaffRestaurant = PublicRestaurant & {
  timezone: string;
};

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: "staff";
  restaurantId: string;
};

export type Contact = {
  id: string;
  name: string;
  phoneE164: string;
  email: string;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  marketingConsent: boolean;
  consentedAt: string | null;
  consentText?: string | null;
  createdAt?: string;
  reward?: {
    id: string;
    code: string;
    title: string;
    redeemedAt: string | null;
  } | null;
};

export type Reward = {
  id: string;
  code: string;
  title: string;
  redeemedAt: string | null;
  redeemedBy?: string | null;
  createdAt?: string;
};

export type SignupRequest = {
  name: string;
  phone: string;
  email: string;
  birthday?: { month: number; day: number } | string | null;
  marketingConsent: boolean;
};

export type SignupResponse = {
  isExisting: boolean;
  contact: Contact;
  reward: Reward;
};

export type LoginResponse = {
  token: string;
  staff: StaffUser;
  restaurant: StaffRestaurant;
};

export type MeResponse = {
  staff: StaffUser;
  restaurant: StaffRestaurant;
};

export type ContactListResponse = {
  contacts: Contact[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type RewardLookupResponse = {
  reward: Reward;
  contact: Pick<Contact, "id" | "name" | "phoneE164" | "email">;
};

export type CampaignAudienceType = "all_consented" | "birthdays_this_week";

export type Campaign = {
  id: string;
  title: string;
  message: string;
  audienceType: CampaignAudienceType;
  status: "draft" | "sending_not_connected";
  lastAttemptedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CampaignListResponse = { campaigns: Campaign[] };
export type CampaignResponse = { campaign: Campaign };

export type QrCardResponse = {
  landingUrl: string;
  qrSvg: string;
  qrDataUrl: string;
  restaurant: Pick<
    PublicRestaurant,
    "slug" | "name" | "tagline" | "rewardTitle" | "brandColor"
  >;
};

type FetchOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;
  const url = `${getApiBaseUrl()}${path}`;
  const headerBag = new Headers(headers);
  headerBag.set("Accept", "application/json");
  if (body !== undefined) {
    headerBag.set("Content-Type", "application/json");
  }
  if (token) {
    headerBag.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: headerBag,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Couldn't connect. Check your signal and try again.", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    throw parseApiError(payload, response.status);
  }

  return payload as T;
}

function parseApiError(payload: unknown, status: number): ApiError {
  const body = payload as Partial<ApiErrorBody> | null;
  const rawCode = body?.error?.code;
  const message = body?.error?.message ?? defaultMessage(status);
  const fields = body?.error?.fields;
  const code = isApiErrorCode(rawCode) ? rawCode : mapStatus(status);
  return new ApiError(code, message, status, fields);
}

function isApiErrorCode(code: unknown): code is ApiErrorCode {
  return (
    typeof code === "string" &&
    [
      "VALIDATION_ERROR",
      "UNAUTHORIZED",
      "NOT_FOUND",
      "ALREADY_REDEEMED",
      "CONTACT_CONFLICT",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ].includes(code)
  );
}

function mapStatus(status: number): ApiErrorCode {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "ALREADY_REDEEMED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN";
}

function defaultMessage(status: number): string {
  if (status === 401) return "You were logged out, log in again";
  if (status === 404) return "No reward with that code";
  if (status === 429) return "Too many tries, wait a minute and try again.";
  if (status === 0) return "Couldn't connect. Check your signal and try again.";
  return "Something went wrong.";
}

export async function requestCsv(
  path: string,
  token: string,
): Promise<{ filename: string; text: string }> {
  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Couldn't connect. Check your signal and try again.", 0);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw parseApiError(payload, response.status);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return { filename: match?.[1] ?? "contacts.csv", text: await response.text() };
}

export const api = {
  health: () => request<{ ok: true }>("/api/health"),

  getRestaurant: (slug: string) =>
    request<{ restaurant: PublicRestaurant }>(`/api/public/restaurants/${encodeURIComponent(slug)}`),

  signup: (slug: string, body: SignupRequest) =>
    request<SignupResponse>(`/api/public/restaurants/${encodeURIComponent(slug)}/signups`, {
      method: "POST",
      body,
    }),

  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } }),

  me: (token: string) => request<MeResponse>("/api/auth/me", { token }),

  listContacts: (token: string, query: { q?: string; page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return request<ContactListResponse>(`/api/contacts${suffix}`, { token });
  },

  exportContactsCsv: (token: string, q?: string) => {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    return requestCsv(`/api/contacts/export.csv${suffix}`, token);
  },

  getReward: (token: string, code: string) =>
    request<RewardLookupResponse>(`/api/rewards/${encodeURIComponent(code)}`, { token }),

  redeemReward: (token: string, code: string) =>
    request<RewardLookupResponse>(`/api/rewards/${encodeURIComponent(code)}/redeem`, {
      method: "POST",
      token,
    }),

  getQr: (token: string) => request<QrCardResponse>("/api/qr", { token }),

  listCampaigns: (token: string) => request<CampaignListResponse>("/api/campaigns", { token }),

  createCampaign: (
    token: string,
    body: { title: string; message: string; audienceType: CampaignAudienceType },
  ) => request<CampaignResponse>("/api/campaigns", { method: "POST", token, body }),

  updateCampaign: (
    token: string,
    id: string,
    body: Partial<{ title: string; message: string; audienceType: CampaignAudienceType }>,
  ) =>
    request<CampaignResponse>(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: "PATCH",
      token,
      body,
    }),
};

export { request };
