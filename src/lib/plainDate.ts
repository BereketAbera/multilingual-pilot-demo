// A plain date is a calendar day with no time and no zone: "2026-11-24". The API sends and
// accepts dates in this form. Arithmetic on it is done in UTC, where every day has 24 hours.

const DAY = 24 * 60 * 60 * 1000;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The date when it is complete and exists in the calendar, otherwise an empty string. */
export function completeDate(value: string): string {
  if (!PLAIN_DATE.test(value)) return '';
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value ? value : '';
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}

/** 29 February lands on 1 March in a year without one. */
export function addYears(date: string, years: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** How many days a month has. Without a year, February offers 29 so a leap day can be picked first. */
export function daysInMonth(year: string, month: string): number {
  if (!month) return 31;
  return new Date(Date.UTC(year ? Number(year) : 2024, Number(month), 0)).getUTCDate();
}
