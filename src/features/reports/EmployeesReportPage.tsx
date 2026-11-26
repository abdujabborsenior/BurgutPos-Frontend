import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { EmployeeReportRow, WaiterFigures } from '@/api/report-types';
import { DataTable, Pagination, Panel, StatCard, type Column } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { EmployeeOrdersModal, type EmployeeTarget } from './components/EmployeeOrdersModal';
import {
  KpiGrid,
  Pending,
  ReportEmpty,
  ReportError,
  ReportNote,
  StackedValue,
} from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount } from './components/report-utils';
import { useClientTable } from './components/useClientTable';
import { useReportScope } from './scope/useReportScope';

type Figure = Exclude<keyof WaiterFigures, 'ordersCount'>;

/** Column titles follow the configured rates: "Без 10%", "Доля 6%". */
function figureTitles(service: number, waiter: number): Record<Figure, string> {
  const s = formatMoney(service);
  return {
    revenue: 'Выручка',
    net: `Без ${s}%`,
    base: `Без ${s}% и С собой`,
    service: `${s}% от базы`,
    share: `Доля ${formatMoney(waiter)}%`,
  };
}

const FIGURES: Figure[] = ['revenue', 'net', 'base', 'service', 'share'];

export default function EmployeesReportPage() {
  const scope = useReportScope();
  const params = scope.params;
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('employees', params),
    queryFn: () => reportsApi.employees(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;
  const titles = figureTitles(data?.percent.service ?? 10, data?.percent.waiter ?? 0);
  const [viewing, setViewing] = useState<EmployeeTarget | null>(null);

  const table = useClientTable(data?.items, {
    sorters: {
      name: (row) => row.fullName,
      orders: (row) => row.ordersCount,
      revenue: (row) => row.revenue,
      net: (row) => row.net,
      base: (row) => row.base,
      service: (row) => row.service,
      share: (row) => row.share,
    },
    defaultSort: { sortBy: 'share', sortOrder: 'DESC' },
  });

  const columns: Column<EmployeeReportRow>[] = [
    {
      key: 'name',
      header: 'Сотрудник',
      sortKey: 'name',
      cell: (row) => (
        <span className="text-ink-900 font-medium whitespace-nowrap">
          {row.fullName ?? 'Без официанта'}
        </span>
      ),
    },
    {
      key: 'orders',
      header: 'Заказов',
      sortKey: 'orders',
      cell: (row) => (
        <StackedValue
          value={row.ordersCount}
          pending={row.pending.ordersCount}
          format={formatCount}
        />
      ),
    },
    ...FIGURES.map((figure): Column<EmployeeReportRow> => ({
      key: figure,
      header: titles[figure],
      sortKey: figure,
      cell: (row) => (
        <StackedValue
          value={row[figure]}
          pending={row.pending[figure]}
          strong={figure === 'share'}
          tone={figure === 'share' ? 'brand' : undefined}
        />
      ),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по сотрудникам"
        kind="employees"
        exportParams={params}
        facts={
          data &&
          `${countOf(data.items.length, ['сотрудник', 'сотрудника', 'сотрудников'])} · ${countOf(data.totals.ordersCount, ['заказ', 'заказа', 'заказов'])}`
        }
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale} columns={5}>
          {FIGURES.map((figure) => (
            <StatCard
              key={figure}
              label={titles[figure]}
              tone={figure === 'share' ? 'brand' : 'default'}
              loading={loading}
              value={totals ? formatMoney(totals[figure]) : '—'}
              hint={totals && <Pending value={totals.pending[figure]} />}
            />
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
                rowKey={(row) => row.userId ?? 'none'}
                onRowClick={setViewing}
                loading={loading}
                fetching={stale}
                numberedFrom={table.offset}
                sortBy={table.sortBy}
                sortOrder={table.sortOrder}
                onSortChange={table.onSortChange}
                empty={<ReportEmpty title="Нет заказов за период" />}
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
      <ReportNote>
        База доли — заказы с обслуживанием (за столом) без самого обслуживания: заказы с собой,
        доставка и зал в неё не входят. Оранжевым — заказы, которые ещё ожидают оплаты. Нажмите на
        строку, чтобы открыть счета сотрудника.
      </ReportNote>
      <EmployeeOrdersModal
        target={viewing}
        scopeParams={params}
        subtitle={scope.label}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
