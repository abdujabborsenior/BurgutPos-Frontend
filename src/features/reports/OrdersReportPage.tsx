import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Printer, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ORDER_REPORT_SORT, reportsApi, type OrdersReportParams } from '@/api/analytics.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { OrderReportRow } from '@/api/report-types';
import type { OrderStatus, OrderType } from '@/api/types';
import {
  Badge,
  Combobox,
  DataTable,
  IconButton,
  Pagination,
  Panel,
  Segmented,
  Select,
  StatCard,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { usePrintOrder } from '@/features/pos/usePrintOrder';
import { useReopenOrder } from '@/features/pos/useReopenOrder';
import { useListState } from '@/hooks/useListState';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { ORDER_TYPE_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { AmountCard } from './components/AmountCard';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { ORDER_STATUS_VIEW } from './components/orderStatus';
import { Dash, KpiGrid, MethodChips, ReportEmpty, ReportError } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount, oneOf, sortHandler, toId } from './components/report-utils';
import { usePaymentMethodOptions, useTableOptions, useUserOptions } from './components/useFilterOptions';
import { useReportScope } from './scope/useReportScope';

const STATUS_OPTIONS: SelectOption<OrderStatus | null>[] = [
  { value: null, label: 'Все' },
  { value: 'OPEN', label: 'Ожидает оплаты' },
  { value: 'PAID', label: 'Оплачен' },
  { value: 'CANCELLED', label: 'Отменён' },
];

const ORDER_TYPES: OrderType[] = ['TABLE', 'TAKEAWAY', 'DELIVERY', 'HALL'];
const TYPE_OPTIONS: SelectOption<OrderType | null>[] = [
  { value: null, label: 'Все' },
  ...ORDER_TYPES.map((type) => ({ value: type, label: ORDER_TYPE_LABELS[type] })),
];

const TIME_FILTERS = [
  { value: 'opened' as const, label: 'По открытию' },
  { value: 'closed' as const, label: 'По закрытию' },
];

const dateTime = (value: string | null) => (value ? <span className="whitespace-nowrap tabular">{formatDateTime(value)}</span> : <Dash />);

export default function OrdersReportPage() {
  const scope = useReportScope();
  const list = useListState({ limit: 10 });
  const byClosing = list.filters.time === 'closed';
  const fallbackSort = { sortBy: byClosing ? 'closedAt' : 'createdAt', sortOrder: 'DESC' as const };
  const sortBy = oneOf(list.sortBy, ORDER_REPORT_SORT) ?? fallbackSort.sortBy;
  const sortOrder = list.sortBy === sortBy && list.sortOrder ? list.sortOrder : fallbackSort.sortOrder;

  const status = oneOf(list.filters.status, ['OPEN', 'PAID', 'CANCELLED'] as const);
  const type = oneOf(list.filters.type, ORDER_TYPES);
  const tableId = toId(list.filters.tableId);
  const waiterId = toId(list.filters.waiterId);
  const methodId = toId(list.filters.methodId);

  const tables = useTableOptions();
  const waiters = useUserOptions(Permission.OrdersServe);
  const methods = usePaymentMethodOptions();
  const tableOptions = useMemo(
    () => (tables.data ?? []).map((table) => ({ value: table.id, label: table.name, hint: table.hallName })),
    [tables.data],
  );
  const methodOptions = useMemo<SelectOption<number | null>[]>(
    () => [{ value: null, label: 'Все' }, ...(methods.data ?? [])],
    [methods.data],
  );

  const filters: OrdersReportParams = {
    ...scope.params,
    dateField: byClosing ? 'closedAt' : 'createdAt',
    status,
    type,
    tableId,
    waiterId,
    methodId,
    sortBy: sortBy as OrdersReportParams['sortBy'],
    sortOrder,
  };
  const params = { ...filters, page: list.page, limit: list.limit };
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('orders', params),
    queryFn: () => reportsApi.orders(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;

  // Printing goes through the order's print history: the bill via precheck
  // (a POS command), the receipt is printed and then logged.
  const printing = usePrintOrder();
  const canBill = useCan(Permission.PosAccess);
  const print = useMutation({
    mutationFn: async (row: OrderReportRow) => {
      if (row.status === 'OPEN') await printing.bill(row.id);
      else await printing.receipt(await reportsApi.order(row.id));
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось напечатать')),
  });
  const canReopen = useCan(Permission.OrdersReopen);
  const { reopen, pendingId } = useReopenOrder();
  const [detailId, setDetailId] = useState<number | null>(null);

  const printLabel = (row: OrderReportRow) =>
    row.status === 'PAID'
      ? 'Печать чека'
      : row.status === 'OPEN'
        ? canBill
          ? 'Печать счёта'
          : 'Счёт печатается на кассе'
        : 'Отменённый заказ не печатается';

  const columns: Column<OrderReportRow>[] = [
    { key: 'id', header: 'ID', sortKey: 'id', cell: (row) => <span className="text-ink-600 tabular">{row.id}</span> },
    {
      key: 'number',
      header: 'Номер заказа',
      sortKey: 'number',
      cell: (row) => <span className="font-semibold text-ink-900 tabular">{row.number}</span>,
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
        <div className="flex items-center justify-center gap-0.5">
          <IconButton
            size="sm"
            label={printLabel(row)}
            icon={<Printer />}
            disabled={row.status === 'CANCELLED' || row.status === 'MERGED' || (row.status === 'OPEN' && !canBill)}
            loading={print.isPending && print.variables?.id === row.id}
            onClick={() => print.mutate(row)}
          />
          {canReopen && (
            <IconButton
              size="sm"
              label={row.status === 'PAID' ? 'Восстановить' : 'Восстановить можно только оплаченный заказ'}
              icon={<RotateCcw />}
              disabled={row.status !== 'PAID'}
              loading={pendingId === row.id}
              onClick={() => void reopen(row)}
            />
          )}
        </div>
      ),
    },
    { key: 'type', header: 'Тип', cell: (row) => ORDER_TYPE_LABELS[row.type] },
    {
      key: 'table',
      header: 'Стол',
      cell: (row) => (row.table ? <span className="whitespace-nowrap">{row.table.name}</span> : <Dash />),
    },
    { key: 'createdAt', header: 'Открыт', sortKey: 'createdAt', cell: (row) => dateTime(row.createdAt) },
    { key: 'closedAt', header: 'Закрыт', sortKey: 'closedAt', cell: (row) => dateTime(row.closedAt ?? row.cancelledAt) },
    {
      key: 'waiter',
      header: 'Официант',
      sortKey: 'waiter',
      cell: (row) => (row.waiter ? <span className="whitespace-nowrap">{row.waiter.fullName}</span> : <Dash />),
    },
    {
      key: 'closedBy',
      header: 'Закрыл',
      sortKey: 'closedBy',
      cell: (row) => {
        const name = row.closedBy ?? row.cancelledBy;
        return name ? <span className="whitespace-nowrap">{name}</span> : <Dash />;
      },
    },
    { key: 'shift', header: 'Смена №', sortKey: 'shift', cell: (row) => <span className="tabular">{row.shiftId}</span> },
    { key: 'items', header: 'Блюд', sortKey: 'items', cell: (row) => <span className="tabular">{formatQty(row.itemsCount)}</span> },
    {
      key: 'total',
      header: 'Сумма',
      sortKey: 'total',
      cell: (row) => <span className="font-semibold text-ink-900 tabular">{formatMoney(row.total)}</span>,
    },
    { key: 'payments', header: 'Тип оплаты', cell: (row) => <MethodChips payments={row.payments} /> },
    {
      key: 'status',
      header: 'Статус',
      cell: (row) => (
        <span title={row.reopenCount ? `Возвращался в работу: ${row.reopenCount}` : undefined}>
          <Badge size="sm" tone={ORDER_STATUS_VIEW[row.status].tone}>
            {ORDER_STATUS_VIEW[row.status].label}
            {row.reopenCount > 0 && <RotateCcw className="size-3" aria-label="возвращался в работу" />}
          </Badge>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по заказам"
        kind="orders"
        exportParams={filters}
        facts={
          totals &&
          `${countOf(totals.count, ['заказ', 'заказа', 'заказов'])} · оплачено ${formatCount(totals.paidCount)} · ожидает ${formatCount(totals.openCount)} · отменено ${formatCount(totals.cancelledCount)}`
        }
      />

      {scope.ready && !(query.isError && !data) && (
        <>
          <KpiGrid stale={stale}>
            <StatCard label="Выручка (оплачено)" loading={loading} value={totals ? formatMoney(totals.revenue) : '—'} />
            <StatCard
              label="Ожидает оплаты"
              tone="warning"
              loading={loading}
              value={totals ? formatMoney(totals.pending) : '—'}
              hint={totals && totals.openCount > 0 ? countOf(totals.openCount, ['открытый заказ', 'открытых заказа', 'открытых заказов']) : undefined}
            />
            <StatCard label="Заказов всего" loading={loading} value={totals ? formatCount(totals.count) : '—'} />
            <StatCard label="Блюд" loading={loading} value={totals ? formatQty(totals.itemsCount) : '—'} />
          </KpiGrid>
          <AmountCard
            title="Способы оплаты"
            loading={loading}
            className={stale ? 'opacity-60' : undefined}
            rows={data?.paymentMethods.map((method) => ({ key: method.methodId, label: method.name, value: method.amount }))}
            total={totals?.revenue}
            pending={totals?.pending}
          />
        </>
      )}

      {scope.card(
        <div className="flex flex-col gap-4">
          {scope.mode === 'period' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-700">Фильтр по времени</span>
              <Segmented
                size="sm"
                items={TIME_FILTERS}
                value={byClosing ? 'closed' : 'opened'}
                onChange={(value) =>
                  list.setFilters({ time: value === 'closed' ? 'closed' : undefined, sort: undefined, order: undefined })
                }
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Select label="Статус" value={status ?? null} onChange={(value) => list.setFilter('status', value)} options={STATUS_OPTIONS} />
          <Select label="Тип" value={type ?? null} onChange={(value) => list.setFilter('type', value)} options={TYPE_OPTIONS} />
          <Combobox
            label="Стол"
            value={tableId ?? null}
            onChange={(value) => list.setFilter('tableId', value)}
            options={tableOptions}
            placeholder="Все"
            clearable
          />
          <Combobox
            label="Сотрудник"
            value={waiterId ?? null}
            onChange={(value) => list.setFilter('waiterId', value)}
            options={waiters.data ?? []}
            placeholder="Все"
            clearable
          />
            <Select label="Тип оплаты" value={methodId ?? null} onChange={(value) => list.setFilter('methodId', value)} options={methodOptions} />
          </div>
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
              rowKey={(row) => row.id}
              loading={loading}
              fetching={stale}
              numberedFrom={(list.page - 1) * list.limit}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={sortHandler({ sortBy, sortOrder }, fallbackSort, list.setSort)}
              onRowClick={(row) => setDetailId(row.id)}
              empty={<ReportEmpty description="Измените период или фильтры" />}
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
      <OrderDetailsModal orderId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
