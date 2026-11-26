import { z } from 'zod';
import type { DishUnit, IngredientUnit, StockItemType, StockLocation, StockMovementType } from '@/api/types';
import type { BadgeTone } from '@/components/ui';
import { formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS, INGREDIENT_UNIT_LABELS } from '@/lib/labels';

/** Limits mirrored from the API DTOs (stock.dto.ts, dish.dto.ts). */
export const MAX_STOCK_QTY = 10_000_000;
export const MAX_PRICE = 1_000_000_000;
export const MAX_RECEIPT_LINES = 50;
export const MAX_COMMENT = 500;

export type StockUnit = DishUnit | IngredientUnit;

const UNIT_LABELS: Record<StockUnit, string> = { ...INGREDIENT_UNIT_LABELS, ...DISH_UNIT_LABELS };

export const unitLabel = (unit: StockUnit | null | undefined): string => (unit ? UNIT_LABELS[unit] : '');

/** Positive integer id from a URL parameter; anything else is ignored. */
export function toId(value: string | undefined): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** The URL value when it is one of `allowed`, otherwise undefined. */
export const pickOption = <T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.find((item) => item === value);

export const isFractionalDishUnit = (unit: DishUnit): boolean => FRACTIONAL_DISH_UNITS.includes(unit);

/**
 * Fraction digits accepted for a quantity: dishes sold by the piece or portion
 * are counted in whole units, KG/L dishes and every ingredient up to 0.001.
 */
export function qtyDecimals(itemType: StockItemType, unit: StockUnit | null | undefined): number {
  if (itemType === 'INGREDIENT') return 3;
  return unit && isFractionalDishUnit(unit as DishUnit) ? 3 : 0;
}

/** Rounds away binary noise (0.1 + 0.2) to the given number of decimals. */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

const MINUS = '\u2212';
const NBSP = '\u00a0';

/** "+5", "−3,5", "0" — with a true minus sign. */
export function formatSignedQty(value: number): string {
  if (value > 0) return `+${formatQty(value)}`;
  if (value < 0) return `${MINUS}${formatQty(Math.abs(value))}`;
  return '0';
}

/** "12 шт" with a no-break space; the unit is omitted when unknown. */
export function formatQtyUnit(value: number, unit: StockUnit | null | undefined): string {
  const label = unitLabel(unit);
  return label ? `${formatQty(value)}${NBSP}${label}` : formatQty(value);
}

/**
 * Number field fed by NumericInput (which emits `null` when empty) that must be
 * filled in: the form keeps `number | null`, the submitted value is `number`.
 */
export function requiredNumber(message: string, refine?: (schema: z.ZodNumber) => z.ZodNumber) {
  const inner = z.number({ error: message });
  return z
    .number()
    .nullable()
    .pipe(refine ? refine(inner) : inner);
}

export const commentSchema = z.string().trim().max(MAX_COMMENT, `Не более ${MAX_COMMENT} символов`);

/** Receipt destination wording ("куда"), as opposed to LOCATION_LABELS ("где"). */
export const RECEIPT_LOCATION_LABELS: Record<StockLocation, string> = {
  WAREHOUSE: 'На склад',
  SALE: 'В продажу',
};

export const MOVEMENT_TONES: Record<StockMovementType, BadgeTone> = {
  RECEIPT: 'success',
  SALE: 'brand',
  SALE_RETURN: 'neutral',
  TRANSFER: 'neutral',
  WRITE_OFF: 'danger',
  RECEIPT_CANCEL: 'warning',
  ADJUSTMENT: 'warning',
};

export const ITEM_TYPE_FILTER_OPTIONS: { value: '' | StockItemType; label: string }[] = [
  { value: '', label: 'Все позиции' },
  { value: 'DISH', label: 'Блюда и товары' },
  { value: 'INGREDIENT', label: 'Ингредиенты' },
];
