import { describe, expect, it } from 'vitest';
import { REWARD_CODE_ALPHABET, REWARD_CODE_LENGTH } from '../src/schemas.js';
import { normalizePhoneE164 } from '../src/utils/phone.js';
import { generateRewardCode } from '../src/utils/rewardCode.js';
import { buildCsv, escapeCsvCell } from '../src/utils/csv.js';
import { getWeekRangeInTimezone, isBirthdayInWeek, parseBirthdayInput } from '../src/utils/birthday.js';

describe('normalizePhoneE164', () => {
  it('normalizes Albanian phone format variants identically', () => {
    expect(normalizePhoneE164('0691234567')).toBe('+355691234567');
    expect(normalizePhoneE164('+355691234567')).toBe('+355691234567');
    expect(normalizePhoneE164('00355691234567')).toBe('+355691234567');
    expect(normalizePhoneE164('069 123 4567')).toBe('+355691234567');
    expect(normalizePhoneE164('+355 (69) 123-4567')).toBe('+355691234567');
    expect(normalizePhoneE164('355691234567')).toBe('+355691234567');
    expect(normalizePhoneE164('691234567')).toBe('+355691234567');
  });

  it('accepts international E.164 and 00-prefixed numbers', () => {
    expect(normalizePhoneE164('+14155552671')).toBe('+14155552671');
    expect(normalizePhoneE164('00390612345678')).toBe('+390612345678');
  });

  it('rejects invalid phone numbers', () => {
    expect(normalizePhoneE164('')).toBeNull();
    expect(normalizePhoneE164('12345')).toBeNull();
    expect(normalizePhoneE164('+3550691234567')).toBeNull();
    expect(normalizePhoneE164('abc')).toBeNull();
  });
});

describe('generateRewardCode', () => {
  it('generates 6-char codes from the unambiguous alphabet only', () => {
    const allowed = new Set(REWARD_CODE_ALPHABET.split(''));
    for (let i = 0; i < 200; i++) {
      const code = generateRewardCode();
      expect(code).toHaveLength(REWARD_CODE_LENGTH);
      for (const ch of code) {
        expect(allowed.has(ch)).toBe(true);
        expect(['0', 'O', '1', 'I']).not.toContain(ch);
      }
    }
  });
});

describe('CSV escaping and formula injection protection', () => {
  it('prefixes = + - @ tab CR with single quote and quotes commas/quotes', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil.com","Click")')).toBe(
      '"\'=HYPERLINK(""http://evil.com"",""Click"")"'
    );
    expect(escapeCsvCell('+1234')).toBe("'+1234");
    expect(escapeCsvCell('-cmd')).toBe("'-cmd");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('\tpayload')).toBe("'\tpayload");
    expect(escapeCsvCell('\rpayload')).toBe('"\'\rpayload"');

    const csv = buildCsv(['name', 'note'], [['=HYPERLINK("http://x","y")', 'normal, text']]);
    expect(csv).toContain('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csv).toContain('"normal, text"');
  });
});

describe('birthday week calculation (Europe/Tirane, Mon-Sun, Feb 29, Dec/Jan wrap)', () => {
  it('uses Monday-Sunday calendar week in Europe/Tirane', () => {
    // Thursday Nov 26, 2026 -> week is Mon Nov 23 .. Sun Nov 29
    const thu = new Date('2026-11-26T12:00:00Z');
    const range = getWeekRangeInTimezone(thu, 'Europe/Tirane');
    expect(range.start).toBe('2026-11-23');
    expect(range.end).toBe('2026-11-29');

    expect(isBirthdayInWeek(11, 23, thu, 'Europe/Tirane')).toBe(true); // Monday
    expect(isBirthdayInWeek(11, 29, thu, 'Europe/Tirane')).toBe(true); // Sunday
    expect(isBirthdayInWeek(11, 22, thu, 'Europe/Tirane')).toBe(false); // Previous Sunday
    expect(isBirthdayInWeek(11, 30, thu, 'Europe/Tirane')).toBe(false); // Next Monday
  });

  it('respects Europe/Tirane midnight boundary', () => {
    // Sun Nov 29, 2026 23:30 UTC == Mon Nov 30, 2026 00:30 Europe/Tirane (UTC+1)
    const tiraneMonday = new Date('2026-11-29T23:30:00Z');
    const range = getWeekRangeInTimezone(tiraneMonday, 'Europe/Tirane');
    expect(range.start).toBe('2026-11-30');
    expect(range.end).toBe('2026-12-06');
    expect(isBirthdayInWeek(11, 30, tiraneMonday, 'Europe/Tirane')).toBe(true);
    expect(isBirthdayInWeek(11, 29, tiraneMonday, 'Europe/Tirane')).toBe(false);
  });

  it('treats Feb 29 birthdays as Feb 28 in non-leap years', () => {
    // Non-leap year 2026: Mon Feb 23 .. Sun Mar 1
    const nonLeap = new Date('2026-02-25T12:00:00Z');
    expect(isBirthdayInWeek(2, 29, nonLeap, 'Europe/Tirane')).toBe(true);

    // Non-leap year 2026 week AFTER Feb 28 (Mon Mar 2 .. Sun Mar 8) -> false
    const nextWeek = new Date('2026-03-02T12:00:00Z');
    expect(isBirthdayInWeek(2, 29, nextWeek, 'Europe/Tirane')).toBe(false);

    // Leap year 2024: Mon Feb 26 .. Sun Mar 3 (Feb 28 and Feb 29 both in week)
    const leap = new Date('2024-02-28T12:00:00Z');
    expect(isBirthdayInWeek(2, 29, leap, 'Europe/Tirane')).toBe(true);
  });

  it('handles Dec/Jan year wrap cleanly', () => {
    // Wed Dec 31, 2025 -> Mon 2025-12-29 .. Sun 2026-01-04
    const nye = new Date('2025-12-31T12:00:00Z');
    const range = getWeekRangeInTimezone(nye, 'Europe/Tirane');
    expect(range.start).toBe('2025-12-29');
    expect(range.end).toBe('2026-01-04');
    expect(isBirthdayInWeek(12, 29, nye, 'Europe/Tirane')).toBe(true);
    expect(isBirthdayInWeek(1, 2, nye, 'Europe/Tirane')).toBe(true);
    expect(isBirthdayInWeek(1, 5, nye, 'Europe/Tirane')).toBe(false);
  });

  it('validates calendar dates on birthday input', () => {
    expect(parseBirthdayInput('1996-02-29', 2026)).toEqual({ birthMonth: 2, birthDay: 29, birthYear: 1996 });
    expect(parseBirthdayInput({ month: 2, day: 29 }, 2026)).toEqual({ birthMonth: 2, birthDay: 29, birthYear: null });
    expect(() => parseBirthdayInput('1995-02-29', 2026)).toThrow();
    expect(() => parseBirthdayInput('2000-04-31', 2026)).toThrow();
  });
});
