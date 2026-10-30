import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  addCalendarMonths,
  getBusinessDate,
  getBusinessDateParts,
  getWeekdayAbbreviation,
} from '../shared/businessDate.ts';

describe('business date helpers', () => {
  it('uses the Asia/Kolkata calendar date rather than the UTC date', () => {
    const instant = new Date('2026-10-30T20:00:00.000Z');

    expect(getBusinessDate(instant)).toBe('2026-10-31');
    expect(getBusinessDateParts(instant)).toEqual({ year: 2026, month: 10, day: 31 });
  });

  it('uses the Asia/Kolkata month and year at UTC month boundaries', () => {
    const instant = new Date('2026-10-31T20:00:00.000Z');

    expect(getBusinessDateParts(instant)).toEqual({ year: 2026, month: 11, day: 1 });
    expect(addCalendarMonths(2026, 11, 1)).toEqual({ year: 2026, month: 12 });
    expect(addCalendarMonths(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });

  it('steps date-only values without applying the host timezone', () => {
    expect(addCalendarDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(getWeekdayAbbreviation('2026-10-31')).toBe('Sat');
  });
});
