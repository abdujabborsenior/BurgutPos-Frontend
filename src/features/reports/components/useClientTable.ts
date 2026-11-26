import type { SortOrder } from '@/api/types';
import { useListState } from '@/hooks/useListState';
import { oneOf, sortHandler } from './report-utils';

type SortValue = string | number | null | undefined;

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  // Missing values always go last, whatever the direction.
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Sorting and paging of a report that arrives whole (tables, employees,
 * cashiers, shifts, categories). State lives in the URL like on server-paged
 * reports, so the two kinds of tables behave identically.
 */
export function useClientTable<T, K extends string>(
  rows: readonly T[] | undefined,
  options: {
    sorters: Record<K, (row: T) => SortValue>;
    defaultSort: { sortBy: NoInfer<K>; sortOrder: SortOrder };
    limit?: number;
  },
) {
  const { sorters, defaultSort } = options;
  const list = useListState({ limit: options.limit ?? 10, ...defaultSort });
  const keys = Object.keys(sorters) as K[];
  const sortBy = oneOf(list.sortBy, keys) ?? defaultSort.sortBy;
  const sortOrder: SortOrder = list.sortBy === sortBy && list.sortOrder ? list.sortOrder : defaultSort.sortOrder;

  const pick = sorters[sortBy];
  const sorted = rows
    ? [...rows]
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const result = compare(pick(a.row), pick(b.row));
          const missing = pick(a.row) == null || pick(b.row) == null;
          // Stable: equal values keep the server's order.
          return (missing ? result : sortOrder === 'ASC' ? result : -result) || a.index - b.index;
        })
        .map((entry) => entry.row)
    : undefined;

  const total = sorted?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / list.limit));
  const page = Math.min(list.page, pages);
  const offset = (page - 1) * list.limit;

  return {
    rows: sorted?.slice(offset, offset + list.limit),
    total,
    page,
    limit: list.limit,
    offset,
    sortBy,
    sortOrder,
    setPage: list.setPage,
    setLimit: list.setLimit,
    onSortChange: sortHandler({ sortBy, sortOrder }, defaultSort, list.setSort),
  };
}
