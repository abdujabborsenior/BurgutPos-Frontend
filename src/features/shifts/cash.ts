import { formatMoney } from '@/lib/format';

const MINUS = '−';

/** "+1 000" · "−2 500" · "0" — an amount with an explicit sign. */
export function formatSignedMoney(value: number): string {
  if (value > 0) return `+${formatMoney(value)}`;
  if (value < 0) return `${MINUS}${formatMoney(-value)}`;
  return formatMoney(0);
}

export type DifferenceKind = 'surplus' | 'shortage' | 'exact';

/** Counted minus expected cash: positive is a surplus, negative a shortage. */
export function differenceKind(value: number): DifferenceKind {
  if (value > 0) return 'surplus';
  if (value < 0) return 'shortage';
  return 'exact';
}

export const DIFFERENCE_LABELS: Record<DifferenceKind, string> = {
  surplus: 'Излишек',
  shortage: 'Недостача',
  exact: 'Без расхождений',
};

/** A shortage is a loss (danger); a surplus or an exact match is fine (success). */
export const DIFFERENCE_TEXT: Record<DifferenceKind, string> = {
  surplus: 'text-success-700',
  shortage: 'text-danger-700',
  exact: 'text-success-700',
};

/** Money difference rounded to tiyin, free of floating-point noise. */
export function cashDifference(counted: number, expected: number): number {
  return Math.round((counted - expected) * 100) / 100;
}
