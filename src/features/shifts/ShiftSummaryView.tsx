import {
  ArrowDownUp,
  Banknote,
  Calculator,
  Clock,
  CreditCard,
  LayoutGrid,
  ReceiptText,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ShiftDetail } from '@/api/types';
import { Badge, Card, CardHeader, DataTable, EmptyState, StatCard, type Column } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatMoney, formatQty, formatShortDateTime, plural } from '@/lib/format';
import { CASH_OPERATION_LABELS, ORDER_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '@/lib/labels';
import { DIFFERENCE_LABELS, DIFFERENCE_TEXT, differenceKind, formatSignedMoney } from './cash';

type CashOperation = ShiftDetail['cashOperations'][number];

const MINUS = '−';

function Amount({ value }: { value: number }) {
  return (
    <>
      {formatMoney(value)}
      <span className="ml-1.5 text-base font-normal text-ink-400">сум</span>
    </>
  );
}

/** Row with an amount and a thin bar showing its share of the total. */
function ShareRow({ label, meta, amount, total }: { label: string; meta: string; amount: number; total: number }) {
  const share = total > 0 ? Math.min(100, Math.max(0, (amount / total) * 100)) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-ink-800">
          {label}
          <span className="ml-2 text-xs font-normal text-ink-400">{meta}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-ink-900 tabular">{formatMoney(amount)}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100" title={`${Math.round(share)}%`}>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      <span className="text-[15px] font-semibold text-ink-900 tabular">{formatCurrency(value)}</span>
    </div>
  );
}

function CashRow({
  label,
  value,
  valueClassName,
  strong,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2', strong && 'mt-1 border-t border-ink-100 pt-3')}>
      <dt className={cn('text-sm', strong ? 'font-semibold text-ink-900' : 'text-ink-600')}>{label}</dt>
      <dd
        className={cn(
          'text-sm tabular',
          strong ? 'text-[15px] font-semibold text-ink-900' : 'font-medium text-ink-800',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const operationColumns: Column<CashOperation>[] = [
  {
    key: 'time',
    header: 'Время',
    cell: (row) => <span className="text-ink-700 tabular">{formatShortDateTime(row.createdAt)}</span>,
  },
  {
    key: 'type',
    header: 'Тип',
    cell: (row) => (
      <Badge tone={row.type === 'IN' ? 'success' : 'warning'} dot>
        {CASH_OPERATION_LABELS[row.type]}
      </Badge>
    ),
  },
  {
    key: 'amount',
    header: 'Сумма',
    cell: (row) => (
      <span className="font-semibold whitespace-nowrap text-ink-900 tabular">
        {row.type === 'IN' ? '+' : MINUS}
        {formatMoney(row.amount)}
      </span>
    ),
  },
  {
    key: 'comment',
    header: 'Комментарий',
    cell: (row) => <span className="mx-auto block max-w-xs text-[13px] whitespace-normal text-ink-700">{row.comment}</span>,
  },
  {
    key: 'user',
    header: 'Сотрудник',
    cell: (row) => row.createdBy?.fullName ?? <span className="text-ink-400">—</span>,
  },
];

/**
 * Shift report: KPIs, payments by method, orders by type, cash drawer
 * reconciliation and cash operations. Lays itself out by its own width, so it
 * fits both a full page and a side drawer.
 */
export function ShiftSummaryView({ shift }: { shift: ShiftDetail }) {
  const { summary, cash } = shift;
  const closed = shift.status === 'CLOSED';
  const typesTotal = summary.byType.reduce((sum, row) => sum + row.total, 0);
  const extras = [
    { label: 'Скидки', value: summary.discounts, sign: MINUS },
    { label: 'Обслуживание', value: summary.service, sign: '+' },
    { label: 'Доставка', value: summary.deliveryFees, sign: '+' },
  ].filter((item) => item.value > 0);
  const difference = cash.difference;

  return (
    <div className="@container">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-3 @5xl:grid-cols-5">
          <StatCard
            className="col-span-2 @2xl:col-span-1"
            label="Выручка"
            icon={<Wallet />}
            tone="brand"
            value={<Amount value={summary.revenue} />}
          />
          <StatCard
            label="Заказов"
            icon={<ReceiptText />}
            value={formatQty(summary.ordersCount)}
            hint={
              summary.cancelledOrders.count > 0
                ? `Отменено: ${summary.cancelledOrders.count} на ${formatCurrency(summary.cancelledOrders.total)}`
                : 'Оплаченные заказы'
            }
          />
          <StatCard label="Средний чек" icon={<Calculator />} value={<Amount value={summary.averageCheck} />} />
          <StatCard label="Гостей" icon={<Users />} value={formatQty(summary.guests)} hint="В оплаченных заказах" />
          <StatCard
            label="Открытые заказы"
            icon={<Clock />}
            tone={summary.openOrders.count > 0 ? 'warning' : 'default'}
            value={formatQty(summary.openOrders.count)}
            hint={
              summary.openOrders.count > 0
                ? `на сумму ${formatCurrency(summary.openOrders.total)}`
                : 'Незакрытых заказов нет'
            }
          />
        </div>

        <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader title="Способы оплаты" icon={<CreditCard />} />
            <div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
              {summary.payments.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-400">Оплат пока не было</p>
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {summary.payments.map((payment) => (
                    <ShareRow
                      key={payment.methodId}
                      label={payment.name}
                      meta={PAYMENT_TYPE_LABELS[payment.type]}
                      amount={payment.amount}
                      total={summary.revenue}
                    />
                  ))}
                </ul>
              )}
              <TotalRow label="Итого" value={summary.revenue} />
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Типы заказов" icon={<LayoutGrid />} />
            <div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
              {summary.byType.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-400">Оплаченных заказов пока нет</p>
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {summary.byType.map((row) => (
                    <ShareRow
                      key={row.type}
                      label={ORDER_TYPE_LABELS[row.type]}
                      meta={`${row.count} ${plural(row.count, ['заказ', 'заказа', 'заказов'])}`}
                      amount={row.total}
                      total={typesTotal}
                    />
                  ))}
                </ul>
              )}
              {extras.length > 0 && (
                <dl className="flex flex-col gap-1 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[13px]">
                  {extras.map((item) => (
                    <div key={item.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-600">{item.label}</dt>
                      <dd className="font-medium text-ink-800 tabular">
                        {item.sign}
                        {formatMoney(item.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <TotalRow label="Итого" value={typesTotal} />
            </div>
          </Card>

          <Card className="flex flex-col @2xl:col-span-2 @5xl:col-span-1">
            <CardHeader
              title="Касса"
              icon={<Banknote />}
              subtitle={closed ? 'Сверка наличных при закрытии' : 'Наличные в кассе на текущий момент'}
            />
            <dl className="flex flex-col px-5 pt-2 pb-4">
              <CashRow label="Начало смены" value={formatMoney(cash.opening)} />
              <CashRow label="Наличные оплаты" value={formatSignedMoney(cash.payments)} />
              <CashRow
                label="Внесения"
                value={formatSignedMoney(cash.in)}
                valueClassName={cash.in > 0 ? 'text-success-700' : undefined}
              />
              <CashRow
                label="Изъятия"
                value={formatSignedMoney(-cash.out)}
                valueClassName={cash.out > 0 ? 'text-warning-700' : undefined}
              />
              <CashRow label="Ожидается в кассе" value={formatCurrency(cash.expected)} strong />
              {closed && (
                <>
                  <CashRow label="Фактически" value={formatCurrency(cash.counted)} />
                  <CashRow
                    label="Расхождение"
                    value={
                      difference === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span className={cn('font-semibold', DIFFERENCE_TEXT[differenceKind(difference)])}>
                          {difference === 0
                            ? DIFFERENCE_LABELS.exact
                            : `${DIFFERENCE_LABELS[differenceKind(difference)]} ${formatSignedMoney(difference)}`}
                        </span>
                      )
                    }
                  />
                </>
              )}
            </dl>
            {(shift.openComment || shift.closeComment) && (
              <div className="mx-5 mb-5 flex flex-col gap-1.5 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[13px]">
                {shift.openComment && (
                  <p className="break-words">
                    <span className="font-medium text-ink-700">При открытии: </span>
                    <span className="text-ink-600">{shift.openComment}</span>
                  </p>
                )}
                {shift.closeComment && (
                  <p className="break-words">
                    <span className="font-medium text-ink-700">При закрытии: </span>
                    <span className="text-ink-600">{shift.closeComment}</span>
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Кассовые операции"
            icon={<ArrowDownUp />}
            subtitle={
              shift.cashOperations.length
                ? `${shift.cashOperations.length} ${plural(shift.cashOperations.length, ['операция', 'операции', 'операций'])} за смену`
                : 'Внесения и изъятия наличных'
            }
          />
          <div className="px-5 pt-4 pb-5">
            <DataTable
              columns={operationColumns}
              rows={shift.cashOperations}
              rowKey={(row) => row.id}
              numberedFrom={0}
              empty={
                <EmptyState
                  compact
                  icon={<ArrowDownUp />}
                  title="Операций не было"
                  description="Внесения и изъятия наличных за смену появятся здесь."
                />
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
