import { normalizeRewardCode } from "@/lib/reward-code";
import type {
  AudienceCountsResponse,
  AuthMeResponse,
  Campaign,
  CampaignInput,
  ContactsFilter,
  ListContactsResponse,
  LoginResponse,
  PublicClaimStatusResponse,
  PublicRestaurant,
  PublicSignupRequest,
  PublicSignupResponse,
  QrResponse,
  StaffRestaurant,
  StaffRewardResponse,
  UpdateRestaurantSettingsRequest,
} from "@/lib/api-types";

export type * from "@/lib/api-types";

const DEFAULT_API_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_REDEEMED"
  | "REWARD_EXPIRED"
  | "OFFER_ENDED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

const KNOWN_CODES = new Set<string>([
  "VALIDATION_ERROR",
  "INVALID_JSON",
  "PAYLOAD_TOO_LARGE",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "ALREADY_REDEEMED",
  "REWARD_EXPIRED",
  "OFFER_ENDED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

/** Error shape: `{ error: { code, message, details? } }`; validation puts `details.fields`. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get fields(): Record<string, string> {
    const d = this.details as { fields?: Record<string, string> } | undefined;
    return d?.fields ?? {};
  }
}

const NETWORK_MESSAGE = "Couldn't connect. Check your signal and try again.";

function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN";
}

function toApiError(payload: unknown, status: number): ApiError {
  const err = (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
  const code =
    typeof err?.code === "string" && KNOWN_CODES.has(err.code) ? (err.code as ApiErrorCode) : statusToCode(status);
  const message = typeof err?.message === "string" ? err.message : "Something went wrong.";
  return new ApiError(code, message, status, err?.details);
}

/** Called when an authenticated request gets 401 (session expired / bad token). */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  accept?: "json" | "text";
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal, accept = "json" } = options;
  const headers = new Headers({ Accept: accept === "json" ? "application/json" : "text/csv" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", NETWORK_MESSAGE, 0);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const apiError = toApiError(payload, response.status);
    if (token && apiError.status === 401) unauthorizedHandler?.();
    throw apiError;
  }

  if (accept === "text") return (await response.text()) as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<{ ok: true }>("/api/health"),

  // Public
  getRestaurant: (slug: string) => request<{ restaurant: PublicRestaurant }>(`/api/public/restaurants/${enc(slug)}`),
  signup: (slug: string, body: PublicSignupRequest) =>
    request<PublicSignupResponse>(`/api/public/restaurants/${enc(slug)}/signups`, { method: "POST", body }),
  claimStatus: (deviceToken: string, signal?: AbortSignal) =>
    request<PublicClaimStatusResponse>(`/api/public/claims/${enc(deviceToken)}`, { signal }),

  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } }),
  me: (token: string) => request<AuthMeResponse>("/api/auth/me", { token }),

  // Contacts
  listContacts: (token: string, filter: ContactsFilter & { page?: number; limit?: number } = {}, signal?: AbortSignal) =>
    request<ListContactsResponse>(`/api/contacts${query(filter)}`, { token, signal }),
  exportContactsCsv: (token: string, filter: ContactsFilter = {}) =>
    request<string>(`/api/contacts/export.csv${query(filter)}`, { token, accept: "text" }),

  // Rewards
  getReward: (token: string, code: string) => request<StaffRewardResponse>(`/api/rewards/${enc(normalizeRewardCode(code))}`, { token }),
  redeemReward: (token: string, code: string) =>
    request<StaffRewardResponse>(`/api/rewards/${enc(normalizeRewardCode(code))}/redeem`, { method: "POST", token }),
  undoRedeem: (token: string, code: string) =>
    request<StaffRewardResponse>(`/api/rewards/${enc(normalizeRewardCode(code))}/undo-redeem`, { method: "POST", token }),

  // QR + settings
  getQr: (token: string) => request<QrResponse>("/api/qr", { token }),
  updateSettings: (token: string, body: UpdateRestaurantSettingsRequest) =>
    request<{ restaurant: StaffRestaurant }>("/api/restaurant/settings", { method: "PATCH", token, body }),

  // Campaigns
  audienceCounts: (token: string) => request<AudienceCountsResponse>("/api/campaigns/audience-counts", { token }),
  listCampaigns: (token: string) => request<{ campaigns: Campaign[] }>("/api/campaigns", { token }),
  createCampaign: (token: string, body: CampaignInput) =>
    request<{ campaign: Campaign }>("/api/campaigns", { method: "POST", token, body }),
  updateCampaign: (token: string, id: string, body: Partial<CampaignInput>) =>
    request<{ campaign: Campaign }>(`/api/campaigns/${enc(id)}`, { method: "PATCH", token, body }),
  deleteCampaign: (token: string, id: string) =>
    request<{ deleted: true; id: string }>(`/api/campaigns/${enc(id)}`, { method: "DELETE", token }),
};
