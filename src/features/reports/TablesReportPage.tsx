import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { TableReportRow } from '@/api/report-types';
import { DataTable, Pagination, Panel, Select, StatCard, type Column, type SelectOption } from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatMoney } from '@/lib/format';
import { KpiGrid, Pending, ReportEmpty, ReportError } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, toId } from './components/report-utils';
import { useClientTable } from './components/useClientTable';
import { useHallOptions } from './components/useFilterOptions';
import { useReportScope } from './scope/useReportScope';

const columns: Column<TableReportRow>[] = [
  {
    key: 'table',
    header: 'Стол',
    sortKey: 'table',
    cell: (row) => <span className="font-medium text-ink-900">{row.tableName}</span>,
  },
  { key: 'hall', header: 'Зал', sortKey: 'hall', cell: (row) => row.hallName },
  {
    key: 'orders',
    header: 'Заказов',
    sortKey: 'orders',
    cell: (row) => <span className="tabular">{formatCount(row.ordersCount)}</span>,
  },
  {
    key: 'revenue',
    header: 'Выручка',
    sortKey: 'revenue',
    cell: (row) => <span className="font-medium text-ink-900 tabular">{formatMoney(row.revenue)}</span>,
  },
  {
    key: 'pending',
    header: 'Ожидает оплаты',
    sortKey: 'pending',
    cell: (row) => <Pending value={row.pending} />,
  },
];

export default function TablesReportPage() {
  const scope = useReportScope();
  const filters = useListState();
  const hallId = toId(filters.filters.hallId);
  const halls = useHallOptions();
  const hallOptions = useMemo<SelectOption<number | null>[]>(
    () => [{ value: null, label: 'Все залы' }, ...(halls.data ?? [])],
    [halls.data],
  );

  const params = { ...scope.params, hallId };
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('tables', params),
    queryFn: () => reportsApi.tables(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;

  const table = useClientTable(data?.items, {
    sorters: {
      table: (row) => row.tableName,
      hall: (row) => row.hallName,
      orders: (row) => row.ordersCount,
      revenue: (row) => row.revenue,
      pending: (row) => row.pending,
    },
    defaultSort: { sortBy: 'revenue', sortOrder: 'DESC' },
  });

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по столам"
        kind="tables"
        exportParams={params}
        facts={
          totals &&
          `${countOf(totals.tablesCount, ['стол', 'стола', 'столов'])} · ${countOf(totals.ordersCount, ['заказ', 'заказа', 'заказов'])}`
        }
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale}>
          <StatCard label="Выручка" loading={loading} value={totals ? formatMoney(totals.revenue) : '—'} />
          <StatCard
            label="Ожидает оплаты"
            tone="warning"
            loading={loading}
            value={totals ? formatMoney(totals.pending) : '—'}
            hint={totals && totals.pendingCount > 0 ? countOf(totals.pendingCount, ['открытый заказ', 'открытых заказа', 'открытых заказов']) : undefined}
          />
          <StatCard label="Заказов" loading={loading} value={totals ? formatCount(totals.ordersCount) : '—'} />
          <StatCard label="Столов" loading={loading} value={totals ? formatCount(totals.tablesCount) : '—'} />
        </KpiGrid>
      )}
      {scope.card(
        <Select
          label="Зал"
          value={hallId ?? null}
          onChange={(value) => filters.setFilter('hallId', value)}
          options={hallOptions}
          className="w-full sm:w-72"
        />,
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
              rows={table.rows}
              rowKey={(row) => row.tableId}
              loading={loading}
              fetching={stale}
              numberedFrom={table.offset}
              sortBy={table.sortBy}
              sortOrder={table.sortOrder}
              onSortChange={table.onSortChange}
              empty={<ReportEmpty title="Нет заказов за столами" />}
            />
            <Pagination
              page={table.page}
              limit={table.limit}
              total={table.total}
              onPageChange={table.setPage}
              onLimitChange={table.setLimit}
            />
          </div>
        )}
      </Panel>
      )}
    </div>
  );
}
