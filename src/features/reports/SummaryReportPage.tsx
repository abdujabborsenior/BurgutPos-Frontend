import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import { Panel } from '@/components/ui';
import { useSettings } from '@/features/pos/usePosData';
import { cn } from '@/lib/cn';
import { formatMoney, formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS, ORDER_TYPE_LABELS } from '@/lib/labels';
import { printSummaryReport } from '@/lib/print';
import { AmountCard, RankedList } from './components/AmountCard';
import { ReportError } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount } from './components/report-utils';
import { useReportScope } from './scope/useReportScope';

/** Итоговый отчёт: money by payment method and order type, best sellers, waiters' share. */
export default function SummaryReportPage() {
  const scope = useReportScope();
  const { data: settings } = useSettings();
  const params = scope.params;
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('summary', params),
    queryFn: () => reportsApi.summary(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Итоговый отчёт"
        kind="summary"
        exportParams={params}
        facts={
          totals &&
          `${countOf(totals.ordersCount, ['заказ оплачен', 'заказа оплачено', 'заказов оплачено'])} · средний чек ${formatMoney(totals.averageCheck)} · гостей ${formatCount(totals.guests)}`
        }
        onPrint={() => data && printSummaryReport(data, settings)}
        printDisabled={!data}
      />
      {scope.card()}

      {!scope.ready ? (
        scope.hint
      ) : query.isError && !data ? (
        <Panel>
          <ReportError error={query.error} onRetry={() => void query.refetch()} />
        </Panel>
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity duration-150', query.isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AmountCard
              title="Способы оплаты"
              loading={loading}
              rows={data?.paymentMethods.map((method) => ({
                key: method.methodId,
                label: method.name,
                value: method.amount,
              }))}
              total={totals?.collected}
              pending={totals?.pending.amount}
            />
            <AmountCard
              title="Типы заказов"
              loading={loading}
              rows={
                data && [
                  ...data.byType.map((row) => ({
                    key: row.type,
                    label: ORDER_TYPE_LABELS[row.type],
                    note: row.count ? `· ${formatCount(row.count)}` : undefined,
                    value: row.amount,
                  })),
                  {
                    key: 'cancelled',
                    label: 'Отменено',
                    note: data.totals.cancelledOrders.count
                      ? `· ${formatCount(data.totals.cancelledOrders.count)}`
                      : undefined,
                    value: data.totals.cancelledOrders.amount,
                    tone: 'danger' as const,
                  },
                ]
              }
            />
          </div>

          <RankedList
            title="Топ блюд"
            loading={loading}
            rows={data?.topDishes}
            rowKey={(dish) => dish.dishId}
            name={(dish) => dish.name}
            empty="За период ничего не продано"
            columns={[
              {
                header: 'Выручка',
                className: 'text-ink-500',
                cell: (dish) => formatMoney(dish.revenue),
              },
              {
                header: 'Кол-во',
                className: 'w-28 font-semibold text-ink-900',
                cell: (dish) =>
                  FRACTIONAL_DISH_UNITS.includes(dish.unit)
                    ? `${formatQty(dish.quantity)} ${DISH_UNIT_LABELS[dish.unit]}`
                    : formatQty(dish.quantity),
              },
            ]}
          />

          <RankedList
            title="Официанты"
            loading={loading}
            rows={data?.waiters}
            rowKey={(waiter) => waiter.userId ?? 'none'}
            name={(waiter) => waiter.fullName ?? 'Без официанта'}
            empty="Нет оплаченных заказов"
            columns={[
              {
                header: 'Заказов',
                className: 'text-ink-500',
                cell: (waiter) => formatCount(waiter.ordersCount),
              },
              {
                header: data ? `${formatMoney(data.percent.waiter)}%` : 'Доля',
                className: 'w-32 font-semibold text-brand-700',
                cell: (waiter) => formatMoney(waiter.share),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
