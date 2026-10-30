export const BUSINESS_TZ = 'Asia/Kolkata';

export interface BusinessDateParts {
  year: number;
  month: number;
  day: number;
}

export interface BusinessMonthParts {
  year: number;
  month: number;
}

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getBusinessDateParts(date: Date = new Date()): BusinessDateParts {
  if (!Number.isFinite(date.getTime())) {
    throw new Error('A valid date is required to calculate the business date.');
  }

  const parts = businessDateFormatter.formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  if (!year || !month || !day) {
    throw new Error('Could not calculate the business date.');
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

export function getBusinessDate(date: Date = new Date()): string {
  const { year, month, day } = getBusinessDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarDays(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !Number.isSafeInteger(days)) {
    throw new Error('A valid YYYY-MM-DD date and whole-day offset are required.');
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (
    source.getUTCFullYear() !== year ||
    source.getUTCMonth() + 1 !== month ||
    source.getUTCDate() !== day
  ) {
    throw new Error('A valid YYYY-MM-DD date and whole-day offset are required.');
  }

  source.setUTCDate(source.getUTCDate() + days);
  return source.toISOString().slice(0, 10);
}

export function addCalendarMonths(year: number, month: number, offset: number): BusinessMonthParts {
  if (
    !Number.isSafeInteger(year) ||
    !Number.isSafeInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isSafeInteger(offset)
  ) {
    throw new Error('A valid year, month, and whole-month offset are required.');
  }

  const result = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
  };
}

export function getWeekdayAbbreviation(date: string): string {
  return getWeekdayName(date, 'short');
}

export function getWeekdayName(date: string, weekday: 'long' | 'short'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error('A valid YYYY-MM-DD date is required.');
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error('A valid YYYY-MM-DD date is required.');
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday,
    timeZone: 'UTC',
  }).format(parsedDate);
}
