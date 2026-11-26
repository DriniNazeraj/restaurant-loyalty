CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  reward_title TEXT NOT NULL,
  reward_description TEXT NOT NULL,
  brand_color TEXT NOT NULL DEFAULT '#B83A22',
  consent_text TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Tirane',
  reward_expiry_days INTEGER NULL CHECK (reward_expiry_days IS NULL OR reward_expiry_days > 0),
  offer_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_restaurant ON staff_users(restaurant_id);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  email TEXT NULL,
  birth_month SMALLINT NULL CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12)),
  birth_day SMALLINT NULL CHECK (birth_day IS NULL OR (birth_day BETWEEN 1 AND 31)),
  birth_year SMALLINT NULL CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100)),
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ NULL,
  consent_text TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contacts_restaurant_phone UNIQUE (restaurant_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_contacts_restaurant_created ON contacts(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_restaurant_consent ON contacts(restaurant_id, marketing_consent);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  redeemed_at TIMESTAMPTZ NULL,
  redeemed_by UUID NULL REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rewards_restaurant_code UNIQUE (restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_rewards_restaurant_code ON rewards(restaurant_id, code);

CREATE TABLE IF NOT EXISTS reward_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('redeem', 'undo_redeem')),
  actor_staff_id UUID NULL REFERENCES staff_users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_audit_logs_reward ON reward_audit_logs(reward_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all_consented', 'birthdays_this_week')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sending_not_connected')),
  last_attempted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant_updated ON campaigns(restaurant_id, updated_at DESC);
