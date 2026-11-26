import { formatDateKey, shiftDateKey, todayKey } from './format';

/**
 * A period of local wall-clock minutes of the business time zone:
 * "2026-11-11T00:00" … "2026-11-11T23:59" (the last minute is included).
 * The same strings go to the API and into <input type="datetime-local">.
 */
export interface Period {
  from: string;
  to: string;
}

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last7'
  | 'last30';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'thisWeek', label: 'Эта неделя' },
  { value: 'lastWeek', label: 'Прошлая неделя' },
  { value: 'thisMonth', label: 'Этот месяц' },
  { value: 'lastMonth', label: 'Прошлый месяц' },
  { value: 'last7', label: 'Последние 7 дней' },
  { value: 'last30', label: 'Последние 30 дней' },
];

/** Longest period the API accepts. */
export const MAX_PERIOD_DAYS = 366;

const MINUTE_MS = 60_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Wall-clock minute ↔ UTC milliseconds: pure calendar arithmetic, never an instant. */
const toMs = (minute: string) => Date.parse(`${minute}:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 16);

export const dayStart = (day: string) => `${day}T00:00`;
export const dayEnd = (day: string) => `${day}T23:59`;
export const dayOf = (minute: string) => minute.slice(0, 10);
export const dayPeriod = (day: string): Period => ({ from: dayStart(day), to: dayEnd(day) });
export const todayPeriod = (): Period => dayPeriod(todayKey());

function isRealDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** A complete, real "YYYY-MM-DDTHH:mm" between years 2000 and 2100 (typing can produce "0002-…"). */
export function isPlausibleMinute(value: string): boolean {
  if (!MINUTE_RE.test(value) || !isRealDay(dayOf(value))) return false;
  const [hours, minutes] = value.slice(11).split(':').map(Number);
  const year = Number(value.slice(0, 4));
  return hours < 24 && minutes < 60 && year >= 2000 && year <= 2100;
}

/** URL value → minute: a bare day opens at 00:00 or, as an end, closes at 23:59. */
export function parseBound(value: string | null, edge: 'start' | 'end'): string | null {
  if (!value) return null;
  if (isRealDay(value)) return edge === 'start' ? dayStart(value) : dayEnd(value);
  return isPlausibleMinute(value) ? value : null;
}

/** Monday of the week that contains `day`. */
function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return shiftDateKey(day, -((weekday + 6) % 7));
}

const monthStart = (day: string) => `${day.slice(0, 8)}01`;

function monthEnd(day: string): string {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function addMonths(day: string, months: number): string {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function presetPeriod(preset: PeriodPreset, today: string = todayKey()): Period {
  const days = (from: string, to: string): Period => ({ from: dayStart(from), to: dayEnd(to) });
  switch (preset) {
    case 'today':
      return days(today, today);
    case 'yesterday':
      return days(shiftDateKey(today, -1), shiftDateKey(today, -1));
    case 'thisWeek':
      return days(weekStart(today), shiftDateKey(weekStart(today), 6));
    case 'lastWeek': {
      const start = shiftDateKey(weekStart(today), -7);
      return days(start, shiftDateKey(start, 6));
    }
    case 'thisMonth':
      return days(monthStart(today), monthEnd(today));
    case 'lastMonth': {
      const start = addMonths(today, -1);
      return days(start, monthEnd(start));
    }
    case 'last7':
      return days(shiftDateKey(today, -6), today);
    case 'last30':
      return days(shiftDateKey(today, -29), today);
  }
}

/** The preset the period equals, if any. */
export function matchPreset(period: Period, today: string = todayKey()): PeriodPreset | null {
  for (const { value } of PERIOD_PRESETS) {
    const candidate = presetPeriod(value, today);
    if (candidate.from === period.from && candidate.to === period.to) return value;
  }
  return null;
}

export const isWholeDays = (period: Period) => period.from.endsWith('T00:00') && period.to.endsWith('T23:59');

/**
 * The previous / next period of the same kind: a calendar month moves by a
 * month, whole days by their count, a custom time window by its own length.
 */
export function shiftPeriod(period: Period, direction: 1 | -1): Period {
  if (isWholeDays(period)) {
    const from = dayOf(period.from);
    const to = dayOf(period.to);
    if (from === monthStart(from) && to === monthEnd(from)) {
      const first = addMonths(from, direction);
      return { from: dayStart(first), to: dayEnd(monthEnd(first)) };
    }
    const length = daysBetween(from, to) + 1;
    return {
      from: dayStart(shiftDateKey(from, length * direction)),
      to: dayEnd(shiftDateKey(to, length * direction)),
    };
  }
  const span = toMs(period.to) - toMs(period.from) + MINUTE_MS;
  return { from: fromMs(toMs(period.from) + direction * span), to: fromMs(toMs(period.to) + direction * span) };
}

/** "06.11.2026", "01.11.2026 — 07.11.2026", "11.11.2026 08:00 — 12.11.2026 03:00". */
export function describePeriod(period: Period): string {
  const minute = (value: string) => `${formatDateKey(dayOf(value))} ${value.slice(11)}`;
  if (isWholeDays(period)) {
    const from = dayOf(period.from);
    const to = dayOf(period.to);
    return from === to ? formatDateKey(from) : `${formatDateKey(from)} — ${formatDateKey(to)}`;
  }
  return `${minute(period.from)} — ${minute(period.to)}`;
}

/** Changes one bound and keeps the period valid (ordered, within the API limit). */
export function withBound(period: Period, edge: 'from' | 'to', value: string): Period {
  const limit = MAX_PERIOD_DAYS * 24 * 60 * MINUTE_MS - MINUTE_MS;
  if (edge === 'from') {
    let to = period.to < value ? dayEnd(dayOf(value)) : period.to;
    if (toMs(to) - toMs(value) > limit) to = fromMs(toMs(value) + limit);
    return { from: value, to };
  }
  let from = period.from > value ? dayStart(dayOf(value)) : period.from;
  if (toMs(value) - toMs(from) > limit) from = fromMs(toMs(value) - limit);
  return { from, to: value };
}

/** Same period for another report's link: "?from=…&to=…" (empty for today). */
export function periodSearch(period: Period): string {
  const today = todayPeriod();
  if (period.from === today.from && period.to === today.to) return '';
  return `?${new URLSearchParams({ from: period.from, to: period.to })}`;
}
