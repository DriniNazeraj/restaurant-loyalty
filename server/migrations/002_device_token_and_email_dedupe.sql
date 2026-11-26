CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_restaurant_email_lower
  ON contacts(restaurant_id, LOWER(email))
  WHERE email IS NOT NULL;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS device_token_hash TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rewards_device_token_hash
  ON rewards(device_token_hash)
  WHERE device_token_hash IS NOT NULL;

ALTER TABLE restaurants
  ALTER COLUMN reward_expiry_days SET DEFAULT 30;
