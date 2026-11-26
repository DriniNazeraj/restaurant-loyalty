import type { Pool } from 'pg';
import type { AudienceSampleItem, AudienceType } from '../schemas.js';
import { getWeekRangeInTimezone, isBirthdayInWeek } from '../utils/birthday.js';

export interface ConsentedContactRow {
  id: string;
  name: string;
  phone_e164: string;
  birth_month: number | null;
  birth_day: number | null;
}

export async function getConsentedAudience(
  pool: Pool,
  restaurantId: string,
  audienceType: AudienceType,
  timeZone: string,
  now: Date
): Promise<{
  weekRange: { start: string; end: string };
  recipients: ConsentedContactRow[];
  sample: AudienceSampleItem[];
}> {
  const { start, end } = getWeekRangeInTimezone(now, timeZone);

  // Always enforce marketing_consent = true at the SQL boundary
  const result = await pool.query<ConsentedContactRow>(
    `SELECT id, name, phone_e164, birth_month, birth_day
     FROM contacts
     WHERE restaurant_id = $1
       AND marketing_consent = true
     ORDER BY created_at DESC`,
    [restaurantId]
  );

  const recipients =
    audienceType === 'all_consented'
      ? result.rows
      : result.rows.filter((c) => isBirthdayInWeek(c.birth_month, c.birth_day, now, timeZone));

  const sample: AudienceSampleItem[] = recipients.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
    phoneE164: r.phone_e164,
    birthMonth: r.birth_month,
    birthDay: r.birth_day,
  }));

  return { weekRange: { start, end }, recipients, sample };
}
