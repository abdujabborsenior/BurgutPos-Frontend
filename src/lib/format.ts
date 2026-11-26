import { APP_TIMEZONE } from './env';

const NBSP = '\u00a0';

const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const qtyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const percentFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Normalises the various narrow/regular no-break spaces ICU may emit. */
const normaliseSpaces = (value: string) => value.replace(/[\u202f\u00a0]/g, NBSP);

/** 132 000 · 15 834,5 — amounts in so'm, no currency sign. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return normaliseSpaces(moneyFormatter.format(value));
}

/** 132 000 сум */
export function formatCurrency(value: number | null | undefined): string {
  const money = formatMoney(value);
  return money === '—' ? money : `${money}${NBSP}сум`;
}

/** 1,5 · 12 · 0,125 */
export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return normaliseSpaces(qtyFormatter.format(value));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${normaliseSpaces(percentFormatter.format(value))}%`;
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const partsFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(date: Date) {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) map[part.type] = part.value;
  return map as { day: string; month: string; year: string; hour: string; minute: string };
}

/** 11.11.2026 · 10:51 */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.day}.${p.month}.${p.year} · ${p.hour}:${p.minute}`;
}

/** 26.11.2026 • 08:24 — the stamp printed on the guest bill. */
export function formatReceiptDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.day}.${p.month}.${p.year} • ${p.hour}:${p.minute}`;
}

/** 11.11 17:16 — compact, for table cards and lists within the current year. */
export function formatShortDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

/** 11.11.2026 */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/** 17:16 */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** YYYY-MM-DD key of an instant in the business time zone. */
export function dateKey(value: Date = new Date()): string {
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}`;
}

export const todayKey = (): string => dateKey(new Date());

/** "YYYY-MM-DDTHH:mm" of an instant in the business time zone (period bounds, datetime inputs). */
export function minuteKey(value: Date = new Date()): string {
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-11-05" → "05.11.2026" */
export function formatDateKey(key: string | null | undefined): string {
  if (!key) return '—';
  const [year, month, day] = key.split('-');
  return `${day}.${month}.${year}`;
}

/** "2026-11-05" → "05.11" */
export function formatDayMonth(key: string): string {
  const [, month, day] = key.split('-');
  return `${day}.${month}`;
}

/** Elapsed time between two instants: "45 мин", "1 ч 05 мин". */
export function formatDuration(from: DateInput, to: DateInput = new Date()): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return '—';
  const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} ч ${String(rest).padStart(2, '0')} мин`;
}

/**
 * How long ago something happened, the way a person says it: "меньше минуты",
 * "26 минут", "около 11 часов", "2 дня". Used where the exact clock reading
 * adds nothing — e.g. how long a user has been connected.
 */
export function formatElapsed(from: DateInput, to: DateInput = new Date()): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (seconds < 45) return 'меньше минуты';
  const minutes = Math.round(seconds / 60);
  if (minutes < 45) return `${minutes} ${plural(minutes, ['минута', 'минуты', 'минут'])}`;
  const hours = Math.round(minutes / 60);
  if (minutes < 60 * 22) return `около ${hours} ${plural(hours, ['часа', 'часов', 'часов'])}`;
  const days = Math.round(hours / 24);
  return `${days} ${plural(days, ['день', 'дня', 'дней'])}`;
}

/** Russian plural: plural(5, ['позиция', 'позиции', 'позиций']) → "позиций". */
export function plural(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 1);
  return letters.toUpperCase();
}
