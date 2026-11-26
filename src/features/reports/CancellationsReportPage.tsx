import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CANCELLATION_SORT, reportsApi, type CancellationsReportParams } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { CancellationRow } from '@/api/report-types';
import { DataTable, Pagination, Panel, StatCard, type Column } from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS } from '@/lib/labels';
import { Dash, KpiGrid, OrderLink, ReportEmpty, ReportError } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, oneOf, sortHandler } from './components/report-utils';
import { useReportScope } from './scope/useReportScope';

const FALLBACK_SORT = { sortBy: 'cancelledAt', sortOrder: 'DESC' } as const;

const columns: Column<CancellationRow>[] = [
  {
    key: 'order',
    header: 'Номер заказа',
    sortKey: 'orderNumber',
    cell: (row) => <OrderLink id={row.orderId} number={row.orderNumber} />,
  },
  {
    key: 'name',
    header: 'Блюдо',
    sortKey: 'name',
    cell: (row) => (
      <div className="flex flex-col items-center leading-tight">
        <span className="font-medium text-ink-900">{row.name}</span>
        {row.orderCancelled && <span className="text-xs text-ink-500">отмена всего заказа</span>}
      </div>
    ),
  },
  {
    key: 'quantity',
    header: 'Кол-во',
    sortKey: 'quantity',
    cell: (row) => (
      <span className="tabular">
        {formatQty(row.quantity)}
        {FRACTIONAL_DISH_UNITS.includes(row.unit) ? ` ${DISH_UNIT_LABELS[row.unit]}` : ''}
      </span>
    ),
  },
  { key: 'price', header: 'Цена', sortKey: 'price', cell: (row) => <span className="tabular">{formatMoney(row.price)}</span> },
  {
    key: 'amount',
    header: 'Сумма потерь',
    sortKey: 'amount',
    cell: (row) => <span className="font-medium text-danger-600 tabular">{formatMoney(row.amount)}</span>,
  },
  {
    key: 'cancelledBy',
    header: 'Сотрудник',
    cell: (row) => (row.cancelledBy ? <span className="whitespace-nowrap">{row.cancelledBy}</span> : <Dash />),
  },
  {
    key: 'cancelledAt',
    header: 'Дата отмены',
    sortKey: 'cancelledAt',
    cell: (row) => <span className="whitespace-nowrap tabular">{formatDateTime(row.cancelledAt)}</span>,
  },
  {
    key: 'reason',
    header: 'Причина',
    align: 'left',
    cell: (row) =>
      row.reason ? (
        <span className="line-clamp-2 max-w-72 text-[13px] text-ink-600" title={row.reason}>
          {row.reason}
        </span>
      ) : (
        <Dash />
      ),
  },
];

export default function CancellationsReportPage() {
  const scope = useReportScope();
  const list = useListState({ limit: 10 });
  const sortBy = oneOf(list.sortBy, CANCELLATION_SORT) ?? FALLBACK_SORT.sortBy;
  const sortOrder = list.sortBy === sortBy && list.sortOrder ? list.sortOrder : FALLBACK_SORT.sortOrder;

  const filters: CancellationsReportParams = { ...scope.params, sortBy, sortOrder };
  const params = { ...filters, page: list.page, limit: list.limit };
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('cancellations', params),
    queryFn: () => reportsApi.cancellations(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по отменам"
        kind="cancellations"
        exportParams={filters}
        facts={totals && countOf(totals.lines, ['отменённое блюдо', 'отменённых блюда', 'отменённых блюд'])}
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale} columns={2}>
          <StatCard label="Сумма потерь" tone="danger" loading={loading} value={totals ? formatMoney(totals.amount) : '—'} />
          <StatCard
            label="Отменено позиций"
            loading={loading}
            value={totals ? formatCount(totals.lines) : '—'}
            hint={totals && totals.orders > 0 ? `в ${countOf(totals.orders, ['заказе', 'заказах', 'заказах'])}` : undefined}
          />
        </KpiGrid>
      )}
      {scope.card()}
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
              rowKey={(row) => row.id}
              loading={loading}
              fetching={stale}
              numberedFrom={(list.page - 1) * list.limit}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={sortHandler({ sortBy, sortOrder }, FALLBACK_SORT, list.setSort)}
              empty={<ReportEmpty title="Отмен за период нет" />}
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
    </div>
  );
}
