import { useState } from 'react';
import type { ReportTablePlace } from '@/api/report-types';
import type { DishUnit, OrderType } from '@/api/types';
import { formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS, ORDER_TYPE_LABELS } from '@/lib/labels';

/** "Стол VIP 2 (Асосий зал)" for a table order, the order type otherwise. */
export function orderPlace(type: OrderType, table: ReportTablePlace | null): string {
  if (!table) return ORDER_TYPE_LABELS[type];
  return table.hallName ? `Стол ${table.name} (${table.hallName})` : `Стол ${table.name}`;
}

/** "2" for pieces and portions, "0,5 кг" for dishes sold by weight or volume. */
export function lineQuantity(quantity: number, unit: DishUnit): string {
  return FRACTIONAL_DISH_UNITS.includes(unit)
    ? `${formatQty(quantity)} ${DISH_UNIT_LABELS[unit]}`
    : formatQty(quantity);
}

/**
 * State of a window opened from a report row. The last row stays on screen
 * while the window fades out, and every opening starts again on page 1.
 */
export function useDrilldown<T>(target: T | null, initialLimit = 10) {
  const [shown, setShown] = useState(target);
  const [previous, setPrevious] = useState(target);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  if (target !== previous) {
    setPrevious(target);
    if (target !== null) {
      setShown(target);
      setPage(1);
    }
  }
  return {
    shown,
    page,
    limit,
    offset: (page - 1) * limit,
    setPage,
    setLimit: (next: number) => {
      setLimit(next);
      setPage(1);
    },
  };
}
