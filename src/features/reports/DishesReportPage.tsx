import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { DISH_REPORT_SORT, reportsApi, type DishesReportParams } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { DishReportRow } from '@/api/report-types';
import {
  Badge,
  DataTable,
  Field,
  Pagination,
  Panel,
  SearchInput,
  Select,
  StatCard,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatMoney, formatQty } from '@/lib/format';
import { DishHistoryModal, type DishTarget } from './components/DishHistoryModal';
import {
  KpiGrid,
  Pending,
  ReportEmpty,
  ReportError,
  ReportNote,
  StackedValue,
} from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, oneOf, sortHandler, toId } from './components/report-utils';
import { useCategoryOptions } from './components/useFilterOptions';
import { useReportScope } from './scope/useReportScope';

const FALLBACK_SORT = { sortBy: 'quantity', sortOrder: 'DESC' } as const;

/** Where the dish stands in the period: sold, still on open bills, cancelled. */
function DishStatus({ row }: { row: DishReportRow }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {(row.quantity > 0 || row.revenue > 0) && (
        <Badge size="sm" tone="success">
          Оплачено
        </Badge>
      )}
      {row.pendingQuantity > 0 && (
        <Badge size="sm" tone="warning">
          Ожидает
        </Badge>
      )}
      {row.cancelledQuantity > 0 && (
        <Badge size="sm" tone="danger">
          Отменено
        </Badge>
      )}
    </div>
  );
}

const columns: Column<DishReportRow>[] = [
  {
    key: 'name',
    header: 'Блюдо',
    sortKey: 'name',
    cell: (row) => (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-ink-900 font-medium">{row.name}</span>
        {row.categoryName && <span className="text-ink-500 text-xs">{row.categoryName}</span>}
      </div>
    ),
  },
  { key: 'status', header: 'Статус', cell: (row) => <DishStatus row={row} /> },
  {
    key: 'quantity',
    header: 'Кол-во',
    sortKey: 'quantity',
    cell: (row) => (
      <StackedValue
        value={row.quantity}
        pending={row.pendingQuantity}
        lost={row.cancelledQuantity}
        format={formatQty}
      />
    ),
  },
  {
    key: 'revenue',
    header: 'Выручка',
    sortKey: 'revenue',
    cell: (row) => (
      <StackedValue value={row.revenue} pending={row.pendingRevenue} lost={row.cancelledAmount} />
    ),
  },
];

export default function DishesReportPage() {
  const scope = useReportScope();
  const list = useListState({ limit: 10 });
  const sortBy = oneOf(list.sortBy, DISH_REPORT_SORT) ?? FALLBACK_SORT.sortBy;
  const sortOrder =
    list.sortBy === sortBy && list.sortOrder ? list.sortOrder : FALLBACK_SORT.sortOrder;
  const categoryId = toId(list.filters.categoryId);
  const categories = useCategoryOptions();
  const categoryOptions = useMemo<SelectOption<number | null>[]>(
    () => [{ value: null, label: 'Все' }, ...(categories.data ?? [])],
    [categories.data],
  );

  const filters: DishesReportParams = {
    ...scope.params,
    categoryId,
    search: list.search || undefined,
    sortBy,
    sortOrder,
  };
  const params = { ...filters, page: list.page, limit: list.limit };
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('dishes', params),
    queryFn: () => reportsApi.dishes(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;
  const [viewing, setViewing] = useState<DishTarget | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по блюдам"
        kind="dishes"
        exportParams={filters}
        facts={
          totals && countOf(totals.dishesCount, ['наименование', 'наименования', 'наименований'])
        }
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale} columns={2}>
          <StatCard
            label="Выручка"
            loading={loading}
            value={totals ? formatMoney(totals.revenue) : '—'}
            hint={totals && <Pending value={totals.pendingRevenue} label="Ожидает оплаты" />}
          />
          <StatCard
            label="Наименований"
            loading={loading}
            value={totals ? formatCount(totals.dishesCount) : '—'}
            hint={
              totals && (
                <Pending value={totals.pendingDishes} format={formatCount} label="Ожидает" />
              )
            }
          />
        </KpiGrid>
      )}
      {scope.card(
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Поиск">
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Блюдо"
              className="sm:w-full"
            />
          </Field>
          <Select
            label="Категория"
            value={categoryId ?? null}
            onChange={(value) => list.setFilter('categoryId', value)}
            options={categoryOptions}
          />
        </div>,
      )}
      {!scope.ready ? (
        scope.hint
      ) : (
        <Panel>
          {query.isError && !data ? (
            <ReportError error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div className="flex flex-col gap-4">
              <DataTable
                columns={columns}
                rows={data?.items}
                rowKey={(row) => row.dishId}
                onRowClick={setViewing}
                loading={loading}
                fetching={stale}
                numberedFrom={(list.page - 1) * list.limit}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={sortHandler({ sortBy, sortOrder }, FALLBACK_SORT, list.setSort)}
                empty={
                  <ReportEmpty
                    title="Нет продаж за период"
                    description="Измените период, поиск или категорию"
                  />
                }
              />
              <Pagination
                page={list.page}
                limit={list.limit}
                total={data?.total ?? 0}
                onPageChange={list.setPage}
                onLimitChange={list.setLimit}
              />
            </div>
          )}
        </Panel>
      )}
      <ReportNote>
        Оранжевым — ещё не оплачено, красным — отменено. Нажмите на блюдо, чтобы открыть его историю
        за период.
      </ReportNote>
      <DishHistoryModal
        target={viewing}
        scopeParams={scope.params}
        categoryId={categoryId}
        subtitle={scope.label}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
