import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { SortOrder } from '@/api/types';

export interface ListStateDefaults {
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: Record<string, string>;
}

/**
 * Table state (page, page size, search, sorting, filters) kept in the URL, so
 * refresh, back/forward and shared links restore exactly the same view.
 */
export function useListState(defaults: ListStateDefaults = {}) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Number(params.get('limit')) || defaults.limit || 10;
    const search = params.get('q') ?? '';
    const sortBy = params.get('sort') ?? defaults.sortBy;
    const order = params.get('order');
    const sortOrder: SortOrder | undefined =
      order === 'ASC' || order === 'DESC' ? order : params.get('sort') ? 'ASC' : defaults.sortOrder;
    const filters: Record<string, string> = { ...(defaults.filters ?? {}) };
    for (const [key, value] of params.entries()) {
      if (!['page', 'limit', 'q', 'sort', 'order'].includes(key)) filters[key] = value;
    }
    return { page, limit, search, sortBy, sortOrder, filters };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch: Record<string, string | number | undefined | null>, resetPage = true) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            const defaultValue = defaults.filters?.[key];
            if (value === undefined || value === null || value === '' || String(value) === defaultValue) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  return {
    ...state,
    setPage: (page: number) => update({ page: page > 1 ? page : undefined }, false),
    setLimit: (limit: number) => update({ limit: limit === (defaults.limit ?? 10) ? undefined : limit }),
    setSearch: (search: string) => update({ q: search }),
    setSort: (sortBy: string | undefined, sortOrder: SortOrder | undefined) =>
      update({ sort: sortBy, order: sortBy ? sortOrder : undefined }),
    setFilter: (key: string, value: string | number | undefined | null) => update({ [key]: value }),
    setFilters: (patch: Record<string, string | number | undefined | null>) => update(patch),
  };
}
