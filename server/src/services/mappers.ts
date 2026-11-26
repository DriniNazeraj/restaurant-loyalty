import type {
  Campaign,
  ContactPublic,
  PublicRestaurant,
  RewardStatus,
  RewardSummary,
  StaffRestaurant,
  StaffRewardDetail,
} from '../schemas.js';

export interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  reward_title: string;
  reward_description: string;
  brand_color: string;
  consent_text: string;
  timezone: string;
  reward_expiry_days: number | null;
  offer_active: boolean;
}

export function mapPublicRestaurant(row: RestaurantRow): PublicRestaurant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    rewardTitle: row.reward_title,
    rewardDescription: row.reward_description,
    brandColor: row.brand_color,
    consentText: row.consent_text,
    offerActive: row.offer_active,
    rewardExpiryDays: row.reward_expiry_days,
  };
}

export function mapStaffRestaurant(row: RestaurantRow): StaffRestaurant {
  return {
    ...mapPublicRestaurant(row),
    timezone: row.timezone,
  };
}

export function computeRewardStatus(
  redeemedAt: Date | string | null,
  expiresAt: Date | string | null,
  now: Date
): RewardStatus {
  if (redeemedAt) return 'redeemed';
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export interface RewardRow {
  id: string;
  code: string;
  title: string;
  expires_at: Date | string | null;
  redeemed_at: Date | string | null;
  created_at: Date | string;
  redeemed_by_name?: string | null;
}

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value ? toIso(value) : null;
}

export function mapRewardSummary(row: RewardRow, now: Date): RewardSummary {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: computeRewardStatus(row.redeemed_at, row.expires_at, now),
    expiresAt: toIsoOrNull(row.expires_at),
    redeemedAt: toIsoOrNull(row.redeemed_at),
    createdAt: toIso(row.created_at),
  };
}

export function mapStaffRewardDetail(row: RewardRow, now: Date): StaffRewardDetail {
  return {
    ...mapRewardSummary(row, now),
    redeemedBy: row.redeemed_by_name ?? null,
  };
}

export interface ContactRow {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  marketing_consent: boolean;
  consented_at: Date | string | null;
  consent_text?: string | null;
  created_at?: Date | string;
}

export function mapContactPublic(row: ContactRow): ContactPublic {
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phone_e164,
    email: row.email,
    birthMonth: row.birth_month,
    birthDay: row.birth_day,
    birthYear: row.birth_year,
    marketingConsent: row.marketing_consent,
    consentedAt: toIsoOrNull(row.consented_at),
  };
}

export interface CampaignRow {
  id: string;
  restaurant_id: string;
  title: string;
  message: string;
  audience_type: 'all_consented' | 'birthdays_this_week';
  status: 'draft' | 'ready' | 'sending_not_connected';
  last_attempted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    title: row.title,
    message: row.message,
    audienceType: row.audience_type,
    status: row.status,
    lastAttemptedAt: toIsoOrNull(row.last_attempted_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
