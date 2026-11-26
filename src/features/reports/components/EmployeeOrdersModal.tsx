import { useQuery } from '@tanstack/react-query';
import { ReceiptText } from 'lucide-react';
import { useRef } from 'react';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { EmployeeBill, EmployeeOrdersReport } from '@/api/report-types';
import { Badge, Button, Modal, Pagination, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import type { ReportScope } from '../scope/useReportScope';
import { lineQuantity, orderPlace, useDrilldown } from './drilldown';
import { ReportEmpty, ReportError } from './ReportBits';
import { countOf } from './report-utils';

const ORDER_FORMS: [string, string, string] = ['заказ', 'заказа', 'заказов'];

/** The row of «По сотрудникам» that was clicked. */
export interface EmployeeTarget {
  userId: number | null;
  fullName: string | null;
}

/**
 * Every bill behind one row of «По сотрудникам» — the same paid and pending
 * orders the row counts, newest first, each as a small receipt: its lines,
 * goods, discount, service, delivery and total.
 */
export function EmployeeOrdersModal({
  target,
  scopeParams,
  subtitle,
  onClose,
}: {
  target: EmployeeTarget | null;
  scopeParams: ReportScope['params'];
  subtitle: string;
  onClose: () => void;
}) {
  const view = useDrilldown(target);
  const top = useRef<HTMLDivElement>(null);
  const waiter = view.shown?.userId == null ? 'none' : String(view.shown.userId);
  const params = { ...scopeParams, waiter, page: view.page, limit: view.limit };
  const query = useQuery({
    queryKey: qk.report('employee-orders', params),
    queryFn: () => reportsApi.employeeOrders(params),
    enabled: view.shown !== null,
    // Paging keeps the current page on screen; another employee never flashes in.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as { waiter?: string } | undefined)?.waiter === waiter
        ? previous
        : undefined,
  });
  const data = query.data;
  const turnPage = (page: number) => {
    view.setPage(page);
    top.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="lg"
      icon={<ReceiptText />}
      title={`Заказы — ${view.shown?.fullName ?? 'Без официанта'}`}
      description={subtitle}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div ref={top} className="scroll-mt-6" />
      {query.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <ReportError error={query.error} onRetry={() => void query.refetch()} />
      ) : !data?.total ? (
        <ReportEmpty title="Нет заказов за период" />
      ) : (
        <div
          className={cn(
            'flex flex-col gap-4 transition-opacity',
            query.isPlaceholderData && 'opacity-60',
          )}
        >
          <BillsSummary totals={data.totals} />
          {data.items.map((bill) => (
            <BillTable key={bill.id} bill={bill} />
          ))}
          <Pagination
            page={view.page}
            limit={view.limit}
            total={data.total}
            onPageChange={turnPage}
            onLimitChange={view.setLimit}
          />
        </div>
      )}
    </Modal>
  );
}

/** Paid and still-pending orders of the employee for the whole period. */
function BillsSummary({ totals }: { totals: EmployeeOrdersReport['totals'] }) {
  return (
    <div className="bg-ink-50 text-ink-700 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg px-4 py-2.5 text-sm">
      <span>
        Оплачено:{' '}
        <span className="text-ink-900 tabular font-semibold">
          {countOf(totals.ordersCount, ORDER_FORMS)} · {formatMoney(totals.revenue)}
        </span>
      </span>
      {totals.pendingCount > 0 && (
        <span className="text-warning-600">
          Ожидает оплаты:{' '}
          <span className="tabular font-semibold">
            {countOf(totals.pendingCount, ORDER_FORMS)} · +{formatMoney(totals.pending)}
          </span>
        </span>
      )}
    </div>
  );
}

/** One bill as a receipt: title row, lines, then the money it adds up to. */
function BillTable({ bill }: { bill: EmployeeBill }) {
  const sums: { label: string; value: string; total?: boolean }[] = [
    { label: 'Товары', value: formatMoney(bill.subtotal) },
    ...(bill.discountAmount > 0
      ? [{ label: 'Скидка', value: `−${formatMoney(bill.discountAmount)}` }]
      : []),
    {
      label:
        bill.serviceAmount > 0 && bill.servicePercent > 0
          ? `Обслуживание ${formatQty(bill.servicePercent)}%`
          : 'Обслуживание',
      value: formatMoney(bill.serviceAmount),
    },
    ...(bill.deliveryFee > 0 ? [{ label: 'Доставка', value: formatMoney(bill.deliveryFee) }] : []),
    { label: 'Итого', value: formatMoney(bill.total), total: true },
  ];

  return (
    <div className="table-frame">
      <table className="table-grid w-full text-sm">
        <thead>
          <tr>
            <th colSpan={5} className="px-4 py-2.5 text-center">
              <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <span>Счёт №{bill.number}</span>
                <span className="text-ink-400">/</span>
                <span>{orderPlace(bill.type, bill.table)}</span>
                <span className="text-ink-400">/</span>
                <span className="tabular">{formatDateTime(bill.at)}</span>
                {bill.status === 'OPEN' && (
                  <Badge size="sm" tone="warning">
                    Ожидает оплаты
                  </Badge>
                )}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-ink-500 px-4 py-3 text-center">
                Позиций нет
              </td>
            </tr>
          ) : (
            bill.lines.map((line, index) => (
              <tr key={line.id}>
                <td className="text-ink-700 tabular w-10 px-3 py-2 text-center">{index + 1}</td>
                <td className="text-ink-900 px-3 py-2">{line.name}</td>
                <td className="text-ink-700 tabular w-20 px-3 py-2 text-right whitespace-nowrap">
                  {lineQuantity(line.quantity, line.unit)}
                </td>
                <td className="text-ink-700 tabular w-28 px-3 py-2 text-right whitespace-nowrap">
                  {formatMoney(line.price)}
                </td>
                <td className="text-ink-900 tabular w-32 px-3 py-2 text-right whitespace-nowrap">
                  {formatMoney(line.total)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          {sums.map((sum) => (
            <tr key={sum.label} className={sum.total ? 'bg-ink-50' : undefined}>
              <td
                colSpan={4}
                className={cn(
                  'px-3 py-2',
                  sum.total ? 'text-ink-900 font-semibold' : 'text-ink-700 font-medium',
                )}
              >
                {sum.label}
              </td>
              <td
                className={cn(
                  'tabular px-3 py-2 text-right whitespace-nowrap',
                  sum.total ? 'text-ink-900 font-semibold' : 'text-ink-900',
                )}
              >
                {sum.value}
              </td>
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
