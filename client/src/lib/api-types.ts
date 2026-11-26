/**
 * Mirrors server/src/schemas.ts (types only; the server uses zod v3, the client zod v4,
 * so we mirror instead of importing across packages). Keep in sync with docs/api.md.
 */
export type StaffRole = "owner" | "staff";
export type RewardStatus = "active" | "redeemed" | "expired";
export type AudienceType = "all_consented" | "birthdays_this_week";
export type CampaignStatus = "draft" | "ready" | "sending_not_connected";
export type ContactConsentFilter = "all" | "consented" | "not_consented";
export type ContactRewardFilter = "all" | "active" | "redeemed" | "expired";
export type ContactSort = "newest" | "name";

export type ApiErrorEnvelope = {
  error: { code: string; message: string; details?: unknown };
};

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  rewardTitle: string;
  rewardDescription: string;
  brandColor: string;
  consentText: string;
  offerActive: boolean;
  rewardExpiryDays: number | null;
};

export type StaffRestaurant = PublicRestaurant & { timezone: string };

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  restaurantId: string;
};

export type RewardSummary = {
  id: string;
  code: string;
  title: string;
  status: RewardStatus;
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
};

export type StaffRewardDetail = RewardSummary & { redeemedBy: string | null };

export type ContactWithReward = {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  marketingConsent: boolean;
  consentedAt: string | null;
  consentText: string | null;
  createdAt: string;
  reward: StaffRewardDetail;
};

export type Campaign = {
  id: string;
  restaurantId: string;
  title: string;
  message: string;
  audienceType: AudienceType;
  status: CampaignStatus;
  lastAttemptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeekRange = { start: string; end: string };

export type BirthdayInput = { month: number; day: number; year?: number | null } | string | null;

export type PublicSignupRequest = {
  name: string;
  phone: string;
  email?: string | null;
  birthday?: BirthdayInput;
  marketingConsent?: boolean;
  deviceToken?: string | null;
};

export type PublicSignupUnmaskedResponse = {
  isExisting: boolean;
  alreadyClaimed: false;
  firstName: string;
  deviceToken: string;
  reward: RewardSummary;
};

export type PublicSignupMaskedResponse = {
  isExisting: true;
  alreadyClaimed: true;
  maskedCode: string;
  last2: string;
  status: RewardStatus;
  message: string;
};

export type PublicSignupResponse = PublicSignupUnmaskedResponse | PublicSignupMaskedResponse;

export type PublicClaimStatusResponse = { status: RewardStatus; redeemedAt: string | null };

export type LoginResponse = { token: string; staff: StaffUser; restaurant: StaffRestaurant };
export type AuthMeResponse = { staff: StaffUser; restaurant: StaffRestaurant };

export type ContactsFilter = {
  q?: string;
  consent?: ContactConsentFilter;
  reward?: ContactRewardFilter;
  sort?: ContactSort;
};

export type ListContactsResponse = {
  contacts: ContactWithReward[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type StaffRewardResponse = {
  reward: StaffRewardDetail;
  contact: { id: string; name: string; phoneE164: string; email: string | null };
};

export type QrResponse = {
  landingUrl: string;
  qrSvg: string;
  qrDataUrl: string;
  restaurant: { slug: string; name: string; tagline: string; rewardTitle: string; brandColor: string };
};

export type UpdateRestaurantSettingsRequest = Partial<{
  name: string;
  tagline: string;
  rewardTitle: string;
  rewardDescription: string;
  brandColor: string;
  consentText: string;
  offerActive: boolean;
  rewardExpiryDays: number | null;
}>;

export type AudienceCountsResponse = {
  timezone: string;
  weekRange: WeekRange;
  counts: Record<AudienceType, number>;
};

export type CampaignInput = {
  title: string;
  message: string;
  audienceType: AudienceType;
  status?: "draft" | "ready";
};
