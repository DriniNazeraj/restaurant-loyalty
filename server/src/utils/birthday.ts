import { AppError } from './errors.js';

export interface ParsedBirthday {
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number | null): number {
  switch (month) {
    case 2:
      return year === null || isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function parseBirthdayInput(
  input: string | { month: number; day: number; year?: number | null } | null | undefined,
  currentYear: number = new Date().getUTCFullYear()
): ParsedBirthday {
  if (input === null || input === undefined) {
    return { birthMonth: null, birthDay: null, birthYear: null };
  }

  let month: number;
  let day: number;
  let year: number | null = null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { birthMonth: null, birthDay: null, birthYear: null };
    }
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    const md = /^(?:--)?(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymd) {
      year = Number(ymd[1]);
      month = Number(ymd[2]);
      day = Number(ymd[3]);
    } else if (md) {
      month = Number(md[1]);
      day = Number(md[2]);
    } else {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid birthday format', {
        fields: { birthday: 'Use YYYY-MM-DD, MM-DD, or { month, day, year? }' },
      });
    }
  } else {
    month = input.month;
    day = input.day;
    year = input.year ?? null;
  }

  if (year !== null && (year < 1900 || year > currentYear)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid birth year', {
      fields: { birthday: `Birth year must be between 1900 and ${currentYear}` },
    });
  }

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid calendar date for birthday', {
      fields: { birthday: 'Day is not valid for the selected month' },
    });
  }

  return { birthMonth: month, birthDay: day, birthYear: year };
}

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
  iso: string;
}

export interface WeekWindow {
  start: string;
  end: string;
  days: CalendarDay[];
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the Monday–Sunday calendar week containing `now` in `timeZone` (default Europe/Tirane).
 */
export function getWeekRangeInTimezone(now: Date, timeZone = 'Europe/Tirane'): WeekWindow {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);

  // Use UTC noon on the local calendar date so weekday & date math never suffers DST shifts
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const jsWeekday = localAsUtc.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offsetFromMonday = jsWeekday === 0 ? 6 : jsWeekday - 1;

  const mondayUtc = new Date(localAsUtc.getTime() - offsetFromMonday * 86_400_000);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayUtc.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dayNum = d.getUTCDate();
    days.push({ year: y, month: m, day: dayNum, iso: formatIsoDate(y, m, dayNum) });
  }

  return {
    start: days[0]!.iso,
    end: days[6]!.iso,
    days,
  };
}

/**
 * Evaluates whether (birthMonth, birthDay) falls in the Monday–Sunday calendar week
 * containing `now` in `timeZone`. Feb 29 birthdays count as Feb 28 in non-leap years.
 */
export function isBirthdayInWeek(
  birthMonth: number | null,
  birthDay: number | null,
  now: Date,
  timeZone = 'Europe/Tirane'
): boolean {
  if (!birthMonth || !birthDay) return false;
  const week = getWeekRangeInTimezone(now, timeZone);

  return week.days.some((d) => {
    if (d.month === birthMonth && d.day === birthDay) {
      return true;
    }
    if (birthMonth === 2 && birthDay === 29 && !isLeapYear(d.year)) {
      return d.month === 2 && d.day === 28;
    }
    return false;
  });
}
