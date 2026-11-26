import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { ShiftReportRow } from '@/api/report-types';
import { Badge, DataTable, Pagination, Panel, PeriodCard, StatCard, type Column } from '@/components/ui';
import { formatDateTime, formatMoney } from '@/lib/format';
import { SHIFT_STATUS_LABELS } from '@/lib/labels';
import { Dash, KpiGrid, Pending, ReportEmpty, ReportError, SignedMoney } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, visibleKinds } from './components/report-utils';
import { useClientTable } from './components/useClientTable';
import { usePeriodParams } from '@/hooks/usePeriodParams';

const dateTime = (value: string | null) =>
  value ? <span className="whitespace-nowrap tabular">{formatDateTime(value)}</span> : <Dash />;

export default function ShiftsReportPage() {
  const { period, setPeriod } = usePeriodParams();
  const params = { from: period.from, to: period.to };
  const query = useQuery({
    queryKey: qk.report('shifts', params),
    queryFn: () => reportsApi.shifts(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;
  const kinds = visibleKinds(totals);

  const table = useClientTable(data?.items, {
    sorters: {
      id: (row) => row.id,
      cashier: (row) => row.openedBy,
      openedAt: (row) => row.openedAt,
      closedAt: (row) => row.closedAt,
      status: (row) => row.status,
      payments: (row) => row.paymentsCount,
      revenue: (row) => row.revenue,
      pending: (row) => row.pending,
      cash: (row) => row.cash,
      card: (row) => row.card,
      transfer: (row) => row.transfer,
      other: (row) => row.other,
      difference: (row) => row.difference,
    },
    defaultSort: { sortBy: 'openedAt', sortOrder: 'DESC' },
  });

  const columns: Column<ShiftReportRow>[] = [
    { key: 'id', header: 'Смена №', sortKey: 'id', cell: (row) => <span className="font-semibold text-ink-900 tabular">{row.id}</span> },
    {
      key: 'cashier',
      header: 'Кассир',
      sortKey: 'cashier',
      cell: (row) => <span className="whitespace-nowrap">{row.openedBy}</span>,
    },
    { key: 'openedAt', header: 'Открыта', sortKey: 'openedAt', cell: (row) => dateTime(row.openedAt) },
    { key: 'closedAt', header: 'Закрыта', sortKey: 'closedAt', cell: (row) => dateTime(row.closedAt) },
    {
      key: 'status',
      header: 'Статус',
      sortKey: 'status',
      cell: (row) => (
        <Badge size="sm" tone={row.status === 'OPEN' ? 'success' : 'neutral'} dot={row.status === 'OPEN'}>
          {SHIFT_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'payments',
      header: 'Платежей',
      sortKey: 'payments',
      cell: (row) => <span className="tabular">{formatCount(row.paymentsCount)}</span>,
    },
    {
      key: 'revenue',
      header: 'Выручка',
      sortKey: 'revenue',
      cell: (row) => <span className="font-medium text-ink-900 tabular">{formatMoney(row.revenue)}</span>,
    },
    { key: 'pending', header: 'Ожидает оплаты', sortKey: 'pending', cell: (row) => <Pending value={row.pending} /> },
    ...kinds.map(
      (kind): Column<ShiftReportRow> => ({
        key: kind.key,
        header: kind.label,
        sortKey: kind.key,
        cell: (row) => <span className="tabular">{formatMoney(row[kind.key])}</span>,
      }),
    ),
    {
      key: 'difference',
      header: 'Расхождение',
      sortKey: 'difference',
      cell: (row) => <SignedMoney value={row.difference} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по сменам"
        kind="shifts"
        exportParams={params}
        facts={data && countOf(data.items.length, ['смена', 'смены', 'смен'])}
      />
      {!(query.isError && !data) && (
        <KpiGrid stale={stale} columns={5}>
          <StatCard label="Выручка" loading={loading} value={totals ? formatMoney(totals.revenue) : '—'} />
          <StatCard label="Ожидает оплаты" tone="warning" loading={loading} value={totals ? formatMoney(totals.pending) : '—'} />
          {kinds.map((kind) => (
            <StatCard key={kind.key} label={kind.label} loading={loading} value={totals ? formatMoney(totals[kind.key]) : '—'} />
          ))}
        </KpiGrid>
      )}
      <PeriodCard value={period} onChange={setPeriod} />
      <Panel>
        {query.isError && !data ? (
          <ReportError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable
              columns={columns}
              rows={table.rows}
              rowKey={(row) => row.id}
              loading={loading}
              fetching={stale}
              numberedFrom={table.offset}
              sortBy={table.sortBy}
              sortOrder={table.sortOrder}
              onSortChange={table.onSortChange}
              empty={<ReportEmpty title="Нет смен за период" />}
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
    </div>
  );
}
