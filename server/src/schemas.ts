import { z } from 'zod';

// ============================================================================
// Shared Constants & Enums
// ============================================================================

export const REWARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I
export const REWARD_CODE_LENGTH = 6;

export const StaffRoleSchema = z.enum(['owner', 'staff']);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const RewardStatusSchema = z.enum(['active', 'redeemed', 'expired']);
export type RewardStatus = z.infer<typeof RewardStatusSchema>;

export const AudienceTypeSchema = z.enum(['all_consented', 'birthdays_this_week']);
export type AudienceType = z.infer<typeof AudienceTypeSchema>;

export const CampaignStatusSchema = z.enum(['draft', 'ready', 'sending_not_connected']);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const ContactConsentFilterSchema = z.enum(['all', 'consented', 'not_consented']);
export type ContactConsentFilter = z.infer<typeof ContactConsentFilterSchema>;

export const ContactRewardFilterSchema = z.enum(['all', 'active', 'redeemed', 'expired']);
export type ContactRewardFilter = z.infer<typeof ContactRewardFilterSchema>;

export const ContactSortSchema = z.enum(['newest', 'name']);
export type ContactSort = z.infer<typeof ContactSortSchema>;

// ============================================================================
// Fixed Error Envelope
// ============================================================================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// Domain Models (DTOs)
// ============================================================================

export const PublicRestaurantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  rewardTitle: z.string(),
  rewardDescription: z.string(),
  brandColor: z.string(),
  consentText: z.string(),
  offerActive: z.boolean(),
  rewardExpiryDays: z.number().int().positive().nullable(),
});
export type PublicRestaurant = z.infer<typeof PublicRestaurantSchema>;

export const StaffRestaurantSchema = PublicRestaurantSchema.extend({
  timezone: z.string(),
});
export type StaffRestaurant = z.infer<typeof StaffRestaurantSchema>;

export const StaffUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: StaffRoleSchema,
  restaurantId: z.string().uuid(),
});
export type StaffUser = z.infer<typeof StaffUserSchema>;

export const RewardSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string().length(REWARD_CODE_LENGTH),
  title: z.string(),
  status: RewardStatusSchema,
  expiresAt: z.string().datetime().nullable(),
  redeemedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type RewardSummary = z.infer<typeof RewardSummarySchema>;

export const StaffRewardDetailSchema = RewardSummarySchema.extend({
  redeemedBy: z.string().nullable(), // staff display name
});
export type StaffRewardDetail = z.infer<typeof StaffRewardDetailSchema>;

export const ContactPublicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().email().nullable(),
  birthMonth: z.number().int().min(1).max(12).nullable(),
  birthDay: z.number().int().min(1).max(31).nullable(),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  marketingConsent: z.boolean(),
  consentedAt: z.string().datetime().nullable(),
});
export type ContactPublic = z.infer<typeof ContactPublicSchema>;

export const ContactWithRewardSchema = ContactPublicSchema.extend({
  consentText: z.string().nullable(),
  createdAt: z.string().datetime(),
  reward: RewardSummarySchema.extend({
    redeemedBy: z.string().nullable(),
  }),
});
export type ContactWithReward = z.infer<typeof ContactWithRewardSchema>;

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  audienceType: AudienceTypeSchema,
  status: CampaignStatusSchema,
  lastAttemptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const WeekRangeSchema = z.object({
  start: z.string(), // YYYY-MM-DD
  end: z.string(),   // YYYY-MM-DD
});
export type WeekRange = z.infer<typeof WeekRangeSchema>;

// ============================================================================
// Health
// ============================================================================

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ============================================================================
// Public Customer Routes
// ============================================================================

export const GetPublicRestaurantResponseSchema = z.object({
  restaurant: PublicRestaurantSchema,
});
export type GetPublicRestaurantResponse = z.infer<typeof GetPublicRestaurantResponseSchema>;

const BirthdayObjectSchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
});

export const BirthdayInputSchema = z.union([
  BirthdayObjectSchema,
  z.string().trim().min(1),
]).nullable().optional();

export const PublicSignupRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters'),
  phone: z.string().trim().min(5, 'Phone number is required').max(32, 'Phone number is too long'),
  email: z
    .union([z.string().trim().email('Invalid email address').max(254), z.literal(''), z.null()])
    .optional(),
  birthday: BirthdayInputSchema,
  marketingConsent: z.boolean().optional().default(false),
  deviceToken: z.string().trim().min(1).max(128).nullable().optional(),
});
export type PublicSignupRequest = z.input<typeof PublicSignupRequestSchema>;

export const PublicSignupUnmaskedResponseSchema = z.object({
  isExisting: z.boolean(),
  alreadyClaimed: z.literal(false),
  // First name only on unmasked responses; repeat claims never overwrite or leak stored PII.
  firstName: z.string(),
  deviceToken: z.string(),
  reward: RewardSummarySchema,
});
export type PublicSignupUnmaskedResponse = z.infer<typeof PublicSignupUnmaskedResponseSchema>;

export const PublicSignupMaskedResponseSchema = z.object({
  isExisting: z.literal(true),
  alreadyClaimed: z.literal(true),
  maskedCode: z.string(),
  last2: z.string().length(2),
  status: RewardStatusSchema,
  message: z.string(),
});
export type PublicSignupMaskedResponse = z.infer<typeof PublicSignupMaskedResponseSchema>;

export const PublicSignupResponseSchema = z.union([
  PublicSignupUnmaskedResponseSchema,
  PublicSignupMaskedResponseSchema,
]);
export type PublicSignupResponse = z.infer<typeof PublicSignupResponseSchema>;

export const PublicClaimStatusResponseSchema = z.object({
  status: RewardStatusSchema,
  redeemedAt: z.string().datetime().nullable(),
});
export type PublicClaimStatusResponse = z.infer<typeof PublicClaimStatusResponseSchema>;

// ============================================================================
// Auth Routes
// ============================================================================

export const LoginRequestSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  staff: StaffUserSchema,
  restaurant: StaffRestaurantSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const AuthMeResponseSchema = z.object({
  staff: StaffUserSchema,
  restaurant: StaffRestaurantSchema,
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

// ============================================================================
// Contacts Routes
// ============================================================================

export const ContactsFilterQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  consent: ContactConsentFilterSchema.optional().default('all'),
  reward: ContactRewardFilterSchema.optional().default('all'),
  sort: ContactSortSchema.optional().default('newest'),
});
export type ContactsFilterQuery = z.infer<typeof ContactsFilterQuerySchema>;

export const ListContactsQuerySchema = ContactsFilterQuerySchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

export const ListContactsResponseSchema = z.object({
  contacts: z.array(ContactWithRewardSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(1),
  }),
});
export type ListContactsResponse = z.infer<typeof ListContactsResponseSchema>;

// ============================================================================
// Reward Lookup, Redeem & Undo Redeem
// ============================================================================

export const RewardCodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(
      z
        .string()
        .length(REWARD_CODE_LENGTH, `Reward code must be ${REWARD_CODE_LENGTH} characters`)
        .regex(new RegExp(`^[${REWARD_CODE_ALPHABET}]+$`), 'Invalid reward code characters')
    ),
});
export type RewardCodeParam = z.infer<typeof RewardCodeParamSchema>;

export const RewardLookupContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().email().nullable(),
});
export type RewardLookupContact = z.infer<typeof RewardLookupContactSchema>;

export const StaffRewardResponseSchema = z.object({
  reward: StaffRewardDetailSchema,
  contact: RewardLookupContactSchema,
});
export type StaffRewardResponse = z.infer<typeof StaffRewardResponseSchema>;

// ============================================================================
// QR & Settings
// ============================================================================

export const QrResponseSchema = z.object({
  landingUrl: z.string().url(),
  qrSvg: z.string(),
  qrDataUrl: z.string(),
  restaurant: z.object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    rewardTitle: z.string(),
    brandColor: z.string(),
  }),
});
export type QrResponse = z.infer<typeof QrResponseSchema>;

export const UpdateRestaurantSettingsRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    tagline: z.string().trim().min(1).max(160).optional(),
    rewardTitle: z.string().trim().min(1).max(80).optional(),
    rewardDescription: z.string().trim().min(1).max(300).optional(),
    brandColor: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Brand color must be a 6-digit hex code')
      .optional(),
    consentText: z.string().trim().min(1).max(300).optional(),
    offerActive: z.boolean().optional(),
    rewardExpiryDays: z.number().int().min(1).max(3650).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one setting field must be provided',
  });
export type UpdateRestaurantSettingsRequest = z.infer<typeof UpdateRestaurantSettingsRequestSchema>;

export const UpdateRestaurantSettingsResponseSchema = z.object({
  restaurant: StaffRestaurantSchema,
});
export type UpdateRestaurantSettingsResponse = z.infer<typeof UpdateRestaurantSettingsResponseSchema>;

// ============================================================================
// Campaigns
// ============================================================================

export const AudienceCountsResponseSchema = z.object({
  timezone: z.string(),
  weekRange: WeekRangeSchema,
  counts: z.object({
    all_consented: z.number().int().min(0),
    birthdays_this_week: z.number().int().min(0),
  }),
});
export type AudienceCountsResponse = z.infer<typeof AudienceCountsResponseSchema>;

export const ListCampaignsResponseSchema = z.object({
  campaigns: z.array(CampaignSchema),
});
export type ListCampaignsResponse = z.infer<typeof ListCampaignsResponseSchema>;

export const CreateCampaignRequestSchema = z.object({
  title: z.string().trim().min(1, 'Campaign title is required').max(120),
  message: z.string().trim().min(1, 'Campaign message is required').max(1000),
  audienceType: AudienceTypeSchema,
  status: z.enum(['draft', 'ready']).optional().default('draft'),
});
export type CreateCampaignRequest = z.input<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().min(1).max(1000).optional(),
    audienceType: AudienceTypeSchema.optional(),
    status: z.enum(['draft', 'ready']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

export const CampaignResponseSchema = z.object({
  campaign: CampaignSchema,
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;

export const DeleteCampaignResponseSchema = z.object({
  deleted: z.literal(true),
  id: z.string().uuid(),
});
export type DeleteCampaignResponse = z.infer<typeof DeleteCampaignResponseSchema>;

export const AudienceSampleItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phoneE164: z.string(),
  birthMonth: z.number().int().min(1).max(12).nullable(),
  birthDay: z.number().int().min(1).max(31).nullable(),
});
export type AudienceSampleItem = z.infer<typeof AudienceSampleItemSchema>;

export const AudiencePreviewResponseSchema = z.object({
  campaignId: z.string().uuid(),
  audienceType: AudienceTypeSchema,
  timezone: z.string(),
  weekRange: WeekRangeSchema,
  count: z.number().int().min(0),
  sample: z.array(AudienceSampleItemSchema),
});
export type AudiencePreviewResponse = z.infer<typeof AudiencePreviewResponseSchema>;

export const SendCampaignResponseSchema = z.object({
  campaign: CampaignSchema,
  dispatch: z.object({
    status: z.literal('sending_not_connected'),
    code: z.literal('SENDING_NOT_CONNECTED'),
    message: z.literal('sending not connected yet'),
    provider: z.string(),
    recipientCount: z.number().int().min(0),
    loggedAt: z.string().datetime(),
  }),
});
export type SendCampaignResponse = z.infer<typeof SendCampaignResponseSchema>;
