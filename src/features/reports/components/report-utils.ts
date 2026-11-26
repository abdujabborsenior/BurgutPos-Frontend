import type { SortOrder } from '@/api/types';
import { formatDateKey, formatMoney, plural } from '@/lib/format';

const NBSP = '\u00a0';

// ─────────────────────────────── URL params ───────────────────────────────

/** Positive integer id from a URL param; anything else means "no filter". */
export function toId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** The URL value when it is one of `allowed`, otherwise undefined. */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

type SortSetter = (sortBy: string | undefined, sortOrder: SortOrder | undefined) => void;

/**
 * DataTable cycles a column ASC → DESC → off, and "off" falls back to the
 * default sort. On the default column that click would change nothing, so
 * there the direction flips instead.
 */
export function sortHandler(
  current: { sortBy?: string; sortOrder?: SortOrder },
  fallback: { sortBy: string; sortOrder: SortOrder },
  setSort: SortSetter,
): SortSetter {
  return (sortBy, sortOrder) => {
    if (sortBy === undefined && current.sortBy === fallback.sortBy && current.sortOrder === fallback.sortOrder) {
      setSort(fallback.sortBy, fallback.sortOrder === 'ASC' ? 'DESC' : 'ASC');
      return;
    }
    setSort(sortBy, sortOrder);
  };
}

// ─────────────────────────────── Numbers ───────────────────────────────

/** Client-side total with rounding, so float drift (0.1 + 0.2) never reaches the screen. */
export function sumBy<T>(rows: readonly T[], pick: (row: T) => number | null | undefined, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(rows.reduce((sum, row) => sum + (pick(row) ?? 0), 0) * factor) / factor;
}

/** Share of `part` in `whole`, in percent with one decimal; 0 for an empty whole. */
export function ratio(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Whole counts (orders, guests, lines): 1 234. */
export const formatCount = (value: number | null | undefined): string => formatMoney(value);

const compactFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/** Axis ticks for large amounts: 250 тыс. · 1,5 млн */
export function formatCompactMoney(value: number): string {
  return compactFormatter.format(value).replace(/[\u202f\u00a0]/g, NBSP);
}

/** Differences keep their sign: +5 000 · −3 200 · 0 */
export function formatSignedMoney(value: number): string {
  if (value > 0) return `+${formatMoney(value)}`;
  if (value < 0) return `\u2212${formatMoney(Math.abs(value))}`;
  return formatMoney(0);
}

/** Money columns of the cash reports, by payment-method type. */
export const KIND_COLUMNS = [
  { key: 'cash', label: 'Наличными' },
  { key: 'card', label: 'Картой' },
  { key: 'transfer', label: 'Переводом' },
  { key: 'other', label: 'Другое' },
] as const;
export type KindKey = (typeof KIND_COLUMNS)[number]['key'];

/** "Другое" appears only when such money exists — most restaurants never use it. */
export const visibleKinds = (totals: Record<KindKey, number> | undefined) =>
  KIND_COLUMNS.filter((kind) => kind.key !== 'other' || Boolean(totals?.other));

/** "203 заказа" with the right Russian ending. */
export const countOf = (value: number, forms: [string, string, string]) =>
  `${formatCount(value)}${NBSP}${plural(value, forms)}`;

// ─────────────────────────────── Dates ───────────────────────────────

const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' });

/** "2026-11-05" → "05.11.2026, чт" (a calendar day, so its weekday is read in UTC). */
export function formatDayWithWeekday(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return formatDateKey(key);
  return `${formatDateKey(key)}, ${weekdayFormatter.format(date)}`;
}

/** 8 → "08:00" */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
