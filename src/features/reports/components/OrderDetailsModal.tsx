import { useMutation, useQuery } from '@tanstack/react-query';
import { Printer, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { reportsApi } from '@/api/analytics.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { OrderDetail, OrderItemView, OrderPrintKind } from '@/api/types';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';
import { usePrintOrder } from '@/features/pos/usePrintOrder';
import { useReopenOrder } from '@/features/pos/useReopenOrder';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatQty, plural } from '@/lib/format';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS, ORDER_TYPE_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { ORDER_STATUS_VIEW } from './orderStatus';

const PRINT_KIND_LABELS: Record<OrderPrintKind, string> = { PRECHECK: 'Счёт', RECEIPT: 'Чек' };

/**
 * One order from the reports: who opened and served it, every line with who
 * added it and when, the totals, the payments and every printed bill or
 * receipt — with the same print and «Восстановить» actions as the list row.
 * `orderId = null` closes it; the last order stays on screen while it fades.
 */
export function OrderDetailsModal({
  orderId,
  onClose,
}: {
  orderId: number | null;
  onClose: () => void;
}) {
  const [shownId, setShownId] = useState(orderId);
  if (orderId !== null && orderId !== shownId) setShownId(orderId);

  const query = useQuery({
    queryKey: qk.order(shownId ?? 0),
    queryFn: () => reportsApi.order(shownId ?? 0),
    enabled: shownId !== null,
  });
  const order = query.data;

  const printing = usePrintOrder();
  const canBill = useCan(Permission.PosAccess);
  const canReopen = useCan(Permission.OrdersReopen);
  const { reopen, pendingId } = useReopenOrder();
  const print = useMutation({
    mutationFn: async (target: OrderDetail) => {
      if (target.status === 'OPEN') await printing.bill(target.id);
      else await printing.receipt(target);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось напечатать')),
  });

  const status = order ? ORDER_STATUS_VIEW[order.status] : null;
  const printable = order?.status === 'PAID' || order?.status === 'OPEN';

  return (
    <Modal
      open={orderId !== null}
      onClose={onClose}
      size="lg"
      title={
        order && status ? (
          <span className="flex flex-wrap items-center gap-2.5">
            Заказ #{order.number}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        ) : (
          'Заказ'
        )
      }
      footer={
        order && printable ? (
          <>
            <Button
              variant="secondary"
              leftIcon={<Printer className="size-4" />}
              loading={print.isPending}
              disabled={order.status === 'OPEN' && !canBill}
              title={order.status === 'OPEN' && !canBill ? 'Счёт печатается на кассе' : undefined}
              onClick={() => print.mutate(order)}
            >
              {order.status === 'PAID' ? 'Печать чека' : 'Печать счёта'}
            </Button>
            {canReopen && order.status === 'PAID' && (
              <Button
                variant="secondary"
                leftIcon={<RotateCcw className="size-4" />}
                loading={pendingId === order.id}
                onClick={() => void reopen(order)}
              >
                Восстановить
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-danger-600 py-6 text-center text-sm">{getErrorMessage(query.error)}</p>
      ) : order ? (
        <OrderBody order={order} />
      ) : null}
    </Modal>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  const facts: { label: string; value: ReactNode }[] = [];
  /** Long free text (address, reasons, comment) gets the full width below the grid. */
  const notes: { label: string; value: ReactNode }[] = [];
  const add = (label: string, value: ReactNode, when = true, wide = false) => {
    if (when) (wide ? notes : facts).push({ label, value });
  };
  add('ID', order.id);
  add('Номер заказа', order.number);
  add('Тип', ORDER_TYPE_LABELS[order.type]);
  add(
    'Стол',
    order.table ? [order.table.name, order.table.hall?.name].filter(Boolean).join(' · ') : null,
    Boolean(order.table),
  );
  add('Гостей', order.guests, (order.guests ?? 0) > 0);
  add('Клиент', order.customerName, Boolean(order.customerName));
  add('Телефон', order.customerPhone, Boolean(order.customerPhone));
  add('Адрес доставки', order.deliveryAddress, Boolean(order.deliveryAddress), true);
  add('Открыт', formatDateTime(order.createdAt));
  add('Оплачен', formatDateTime(order.closedAt), order.status === 'PAID');
  add('Отменён', formatDateTime(order.cancelledAt), order.status === 'CANCELLED');
  add('Официант', order.waiter?.fullName ?? '—');
  add('Закрыл', order.closedBy?.fullName, Boolean(order.closedBy));
  add('Отменил', order.cancelledBy?.fullName, Boolean(order.cancelledBy));
  add('Причина отмены', order.cancelReason, Boolean(order.cancelReason), true);
  add('Смена №', order.shiftId ?? '—');
  add(
    'Возвращался в работу',
    [
      order.reopenCount > 1
        ? `${order.reopenCount} ${plural(order.reopenCount, ['раз', 'раза', 'раз'])}, последний`
        : null,
      formatDateTime(order.reopenedAt),
      order.reopenedBy?.fullName,
      order.reopenReason,
    ]
      .filter(Boolean)
      .join(' · '),
    order.reopenCount > 0,
    true,
  );
  add('Комментарий', order.comment, Boolean(order.comment), true);

  const discountLabel =
    order.discountType === 'PERCENT' ? `Скидка ${formatQty(order.discountValue)}%` : 'Скидка';

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
        {facts.map(({ label, value }) => (
          <div
            key={label}
            className="border-ink-100 flex items-baseline justify-between gap-4 border-b py-2"
          >
            <dt className="text-ink-500 shrink-0">{label}</dt>
            <dd className="text-ink-900 tabular text-right font-medium">{value}</dd>
          </div>
        ))}
        {notes.map(({ label, value }) => (
          <div
            key={label}
            className="border-ink-100 flex items-baseline justify-between gap-6 border-b py-2 sm:col-span-2"
          >
            <dt className="text-ink-500 shrink-0">{label}</dt>
            <dd className="text-ink-900 text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="table-frame">
        <table className="table-grid w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left">Блюдо</th>
              <th className="w-28 px-3 py-2.5 text-right">Цена</th>
              <th className="w-24 px-3 py-2.5 text-right">Кол-во</th>
              <th className="w-32 px-3 py-2.5 text-right">Итого</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      <dl className="flex flex-col gap-1.5 text-sm">
        <Line label="Подытог" value={formatMoney(order.subtotal)} />
        {order.discountAmount > 0 && (
          <Line label={discountLabel} value={`−${formatMoney(order.discountAmount)}`} />
        )}
        {order.serviceAmount > 0 && (
          <Line
            label={`Сервис ${formatQty(order.servicePercent)}%`}
            value={formatMoney(order.serviceAmount)}
          />
        )}
        {order.deliveryFee > 0 && <Line label="Доставка" value={formatMoney(order.deliveryFee)} />}
        <div className="border-ink-200 mt-1 flex items-baseline justify-between gap-4 border-t pt-2.5">
          <dt className="text-ink-900 text-[15px] font-semibold">Итого</dt>
          <dd className="text-ink-900 tabular text-[19px] font-bold">{formatMoney(order.total)}</dd>
        </div>
      </dl>

      <Section title="Оплата">
        {order.payments.length === 0 ? (
          <p className="text-ink-500 text-sm">Оплаты нет</p>
        ) : (
          <dl className="flex flex-col gap-1.5 text-sm">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-baseline justify-between gap-4">
                <dt className={payment.isReversal ? 'text-danger-700' : 'text-ink-800'}>
                  {payment.isReversal ? `Сторно · ${payment.method.name}` : payment.method.name}
                  <span className="text-ink-500 ml-2 text-xs">
                    {[payment.cashier?.fullName, formatDateTime(payment.createdAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </dt>
                <dd
                  className={cn(
                    'tabular font-medium',
                    payment.isReversal ? 'text-danger-700' : 'text-ink-900',
                  )}
                >
                  {formatMoney(payment.amount)}
                </dd>
              </div>
            ))}
            {order.changeAmount > 0 && (
              <>
                <Line label="Получено наличными" value={formatMoney(order.receivedAmount)} />
                <Line label="Сдача" value={formatMoney(order.changeAmount)} />
              </>
            )}
          </dl>
        )}
      </Section>

      <Section title="История печати чеков">
        {order.prints.length === 0 ? (
          <p className="text-ink-500 text-sm">Ещё не печатался</p>
        ) : (
          <ul className="divide-ink-100 flex flex-col divide-y text-sm">
            {order.prints.map((print) => (
              <li key={print.id} className="flex items-center justify-between gap-4 py-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-ink-900 font-medium">
                    {print.printedBy?.fullName ?? '—'}
                  </span>
                  {print.printerName && (
                    <Badge size="sm" tone="neutral">
                      {print.printerName}
                    </Badge>
                  )}
                  <span className="text-ink-500 text-xs">{PRINT_KIND_LABELS[print.kind]}</span>
                </span>
                <span className="text-ink-700 tabular shrink-0">
                  {formatDateTime(print.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ItemRow({ item }: { item: OrderItemView }) {
  const cancelled = item.status === 'CANCELLED';
  const unit = FRACTIONAL_DISH_UNITS.includes(item.unit) ? ` ${DISH_UNIT_LABELS[item.unit]}` : '';
  return (
    <tr className={cn(cancelled && 'bg-danger-50/40')}>
      <td className="px-3 py-2.5">
        <div
          className={cn('font-medium', cancelled ? 'text-ink-500 line-through' : 'text-ink-900')}
        >
          {item.name}
        </div>
        {item.comment && <div className="text-ink-600 mt-0.5 text-xs">«{item.comment}»</div>}
        {/* The date never breaks in the middle: a long name wraps before it. */}
        <div className="text-ink-500 mt-0.5 text-xs">
          Добавил: {item.createdBy?.fullName ?? '—'} ·{' '}
          <span className="whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
        </div>
        {cancelled && (
          <div className="text-danger-700 mt-0.5 text-xs">
            Отменил: {item.cancelledBy?.fullName ?? '—'} ·{' '}
            <span className="whitespace-nowrap">{formatDateTime(item.cancelledAt)}</span>
            {item.cancelReason ? ` · ${item.cancelReason}` : ''}
          </div>
        )}
      </td>
      <td className="text-ink-800 tabular px-3 py-2.5 text-right whitespace-nowrap">
        {formatMoney(item.price)}
      </td>
      <td className="text-ink-800 tabular px-3 py-2.5 text-right whitespace-nowrap">
        {formatQty(item.quantity)}
        {unit}
      </td>
      <td
        className={cn(
          'tabular px-3 py-2.5 text-right font-semibold whitespace-nowrap',
          cancelled ? 'text-ink-400 line-through' : 'text-ink-900',
        )}
      >
        {formatMoney(item.total)}
      </td>
    </tr>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-ink-900 tabular font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-ink-150 border-t pt-4">
      <h3 className="text-ink-900 mb-2.5 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}
