import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { CashierReportRow } from '@/api/report-types';
import { DataTable, Pagination, Panel, StatCard, type Column } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { KpiGrid, ReportEmpty, ReportError } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, visibleKinds } from './components/report-utils';
import { useClientTable } from './components/useClientTable';
import { useReportScope } from './scope/useReportScope';

export default function CashiersReportPage() {
  const scope = useReportScope();
  const params = scope.params;
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('cashiers', params),
    queryFn: () => reportsApi.cashiers(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;
  const kinds = visibleKinds(totals);

  const table = useClientTable(data?.items, {
    sorters: {
      name: (row) => row.fullName,
      payments: (row) => row.paymentsCount,
      revenue: (row) => row.revenue,
      cash: (row) => row.cash,
      card: (row) => row.card,
      transfer: (row) => row.transfer,
      other: (row) => row.other,
    },
    defaultSort: { sortBy: 'revenue', sortOrder: 'DESC' },
  });

  const columns: Column<CashierReportRow>[] = [
    {
      key: 'name',
      header: 'Кассир',
      sortKey: 'name',
      cell: (row) => <span className="font-medium whitespace-nowrap text-ink-900">{row.fullName}</span>,
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
    ...kinds.map(
      (kind): Column<CashierReportRow> => ({
        key: kind.key,
        header: kind.label,
        sortKey: kind.key,
        cell: (row) => <span className="tabular">{formatMoney(row[kind.key])}</span>,
      }),
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по кассирам"
        kind="cashiers"
        exportParams={params}
        facts={
          totals &&
          `${countOf(data.items.length, ['кассир', 'кассира', 'кассиров'])} · ${countOf(totals.paymentsCount, ['платёж', 'платежа', 'платежей'])}`
        }
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale} columns={kinds.length + 1 >= 5 ? 5 : 4}>
          <StatCard label="Выручка" loading={loading} value={totals ? formatMoney(totals.revenue) : '—'} />
          {kinds.map((kind) => (
            <StatCard key={kind.key} label={kind.label} loading={loading} value={totals ? formatMoney(totals[kind.key]) : '—'} />
          ))}
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
              rows={table.rows}
              rowKey={(row) => row.cashierId}
              loading={loading}
              fetching={stale}
              numberedFrom={table.offset}
              sortBy={table.sortBy}
              sortOrder={table.sortOrder}
              onSortChange={table.onSortChange}
              empty={<ReportEmpty title="Нет платежей за период" />}
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
