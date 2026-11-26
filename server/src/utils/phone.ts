/**
 * Normalizes a phone number into E.164 format with Albania (+355) as default region.
 * Returns null if the input cannot be parsed into a valid E.164 number.
 */
export function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  let candidate: string;

  if (cleaned.startsWith('+')) {
    candidate = cleaned;
  } else if (cleaned.startsWith('00')) {
    candidate = '+' + cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length >= 9 && cleaned.length <= 10) {
    // Local Albanian format, e.g. 0691234567 -> +355691234567
    candidate = '+355' + cleaned.slice(1);
  } else if (/^6[6-9]\d{7}$/.test(cleaned)) {
    // Bare 9-digit Albanian mobile number
    candidate = '+355' + cleaned;
  } else if (/^355\d{8,9}$/.test(cleaned)) {
    // Missing leading + on Albanian country code
    candidate = '+' + cleaned;
  } else {
    return null;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return null;
  }

  // Extra check for Albania (+355): mobile/landline should have 8-9 subscriber digits
  if (candidate.startsWith('+355')) {
    const subscriber = candidate.slice(4);
    if (subscriber.length < 8 || subscriber.length > 9 || subscriber.startsWith('0')) {
      return null;
    }
  }

  return candidate;
}
