import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import { Card, CardHeader, EmptyState, Skeleton, StatCard } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  formatDateKey,
  formatDayMonth,
  formatMoney,
  formatQty,
  plural,
  shiftDateKey,
  todayKey,
} from '@/lib/format';

const PERIODS = [3, 7, 10, 20, 30] as const;

function DayPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const today = todayKey();
  return (
    <div className="border-ink-200 flex items-center gap-1 rounded-xl border bg-white p-0.5">
      <button
        type="button"
        aria-label="Предыдущий день"
        onClick={() => onChange(shiftDateKey(value, -1))}
        className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 rounded-lg p-1.5"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-ink-800 min-w-24 text-center text-[13px] font-semibold">
        {value === today
          ? 'Сегодня'
          : value === shiftDateKey(today, -1)
            ? 'Вчера'
            : formatDateKey(value)}
      </span>
      <button
        type="button"
        aria-label="Следующий день"
        disabled={value >= today}
        onClick={() => onChange(shiftDateKey(value, 1))}
        className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 rounded-lg p-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { date: string; amount: number; orders: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border-ink-150 shadow-pop rounded-xl border bg-white px-3.5 py-2.5">
      <p className="text-ink-500 text-xs font-medium">{formatDateKey(point.date)}</p>
      <p className="text-ink-900 tabular mt-0.5 text-[15px] font-semibold">
        {formatMoney(point.amount)} сум
      </p>
      <p className="text-ink-500 text-xs">
        {point.orders} {plural(point.orders, ['заказ', 'заказа', 'заказов'])}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayKey());
  const [days, setDays] = useState<number>(7);
  const [topPage, setTopPage] = useState(1);
  const isToday = date === todayKey();

  const summary = useQuery({
    queryKey: qk.dashboard('summary', { date }),
    queryFn: () => dashboardApi.summary(date),
    refetchInterval: 60_000,
  });
  const revenue = useQuery({
    queryKey: qk.dashboard('revenue', { days, date }),
    queryFn: () => dashboardApi.revenue(days, date),
    placeholderData: keepPreviousData,
  });
  const top = useQuery({
    queryKey: qk.dashboard('top', { page: topPage, date }),
    queryFn: () => dashboardApi.topDishes(topPage, 10, date),
    placeholderData: keepPreviousData,
  });
  const waiters = useQuery({
    queryKey: qk.dashboard('waiters', { date }),
    queryFn: () => dashboardApi.waiters(date),
  });

  const s = summary.data;
  const topPages = Math.max(1, Math.ceil((top.data?.total ?? 0) / 10));
  const dayLabel = isToday ? 'сегодня' : `за ${formatDateKey(date)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader
            title="Способы оплаты"
            icon={<Wallet />}
            actions={
              <DayPicker
                value={date}
                onChange={(value) => {
                  setDate(value);
                  setTopPage(1);
                }}
              />
            }
          />
          <div className="px-5 pt-3 pb-5">
            {summary.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
            ) : (
              <>
                <ul>
                  {s?.paymentMethods.map((method) => (
                    <li
                      key={method.id}
                      className="border-ink-100 flex items-center justify-between border-b py-2.5 text-sm"
                    >
                      <span className="text-ink-700">{method.name}</span>
                      <span
                        className={cn(
                          'tabular font-semibold',
                          method.amount > 0 ? 'text-ink-900' : 'text-ink-400',
                        )}
                      >
                        {formatMoney(method.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-ink-900 text-[15px] font-semibold">Итого</span>
                  <span className="text-brand-950 tabular text-lg font-bold">
                    {formatMoney(s?.total ?? 0)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-warning-600 flex items-center gap-1.5 text-[13px] font-semibold">
                    <Clock className="size-3.5" /> Ожидает оплаты
                    {s?.pending.count ? (
                      <span className="text-warning-600/80 font-medium">
                        · {s.pending.count}{' '}
                        {plural(s.pending.count, ['заказ', 'заказа', 'заказов'])}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-warning-600 tabular text-[15px] font-semibold">
                    +{formatMoney(s?.pending.total ?? 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label={`Выручка ${dayLabel}`}
            icon={<Banknote />}
            value={formatMoney(s?.total ?? 0)}
            tone="brand"
            loading={summary.isLoading}
            hint="Все поступления по способам оплаты"
          />
          <StatCard
            label="Закрытых заказов"
            icon={<Receipt />}
            value={formatMoney(s?.ordersCount ?? 0)}
            loading={summary.isLoading}
            hint={
              s?.cancelled.count
                ? `Отменено: ${s.cancelled.count} на ${formatMoney(s.cancelled.total)}`
                : 'Без отмен'
            }
          />
          <StatCard
            label="Средний чек"
            icon={<TrendingUp />}
            value={formatMoney(s?.averageCheck ?? 0)}
            loading={summary.isLoading}
          />
          <StatCard
            label="Гостей"
            icon={<Users />}
            value={formatMoney(s?.guests ?? 0)}
            loading={summary.isLoading}
            hint="По заказам за столами и в зале"
          />
        </div>
      </div>

      <Card>
        <CardHeader
          title={`Выручка за ${days} ${plural(days, ['день', 'дня', 'дней'])}`}
          subtitle={revenue.data ? `Всего ${formatMoney(revenue.data.total)} сум` : undefined}
          actions={
            <div className="bg-ink-50 flex items-center gap-1 rounded-xl p-1">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setDays(period)}
                  className={cn(
                    'tabular h-7 min-w-9 rounded-lg px-2 text-[12.5px] font-semibold transition-colors',
                    days === period
                      ? 'bg-brand-900 shadow-card text-white'
                      : 'text-ink-600 hover:text-ink-900 hover:bg-white',
                  )}
                >
                  {period}
                </button>
              ))}
            </div>
          }
        />
        <div className="h-[300px] px-3 pt-4 pb-3">
          {revenue.isLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenue.data?.items ?? []}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e4e6ef" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayMonth}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#7a7f98', fontSize: 12 }}
                  dy={6}
                />
                <YAxis
                  tickFormatter={(value: number) => formatMoney(value)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#7a7f98', fontSize: 12 }}
                  width={92}
                />
                <Tooltip cursor={{ fill: 'rgba(29, 26, 107, 0.045)' }} content={<ChartTooltip />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={days > 20 ? 28 : 64}>
                  {(revenue.data?.items ?? []).map((item) => (
                    <Cell
                      key={item.date}
                      fill={item.date === revenue.data?.to ? '#1d1a6b' : '#a9aaf0'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Топ блюд ${dayLabel}`} icon={<ShoppingBag />} />
        <div className="px-5 pt-3 pb-5">
          {top.isLoading ? (
            <Skeleton className="h-48" />
          ) : !top.data?.items.length ? (
            <EmptyState
              compact
              title="Продаж пока нет"
              description="Здесь появятся самые продаваемые блюда."
            />
          ) : (
            <>
              <div className="table-frame">
                <table className="table-grid w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-12 px-3 py-2.5 text-center">№</th>
                      <th className="px-3 py-2.5 text-left">Название</th>
                      <th className="px-3 py-2.5 text-right">Сумма</th>
                      <th className="w-28 px-3 py-2.5 text-right">Кол-во</th>
                    </tr>
                  </thead>
                  <tbody className={cn(top.isFetching && 'opacity-60')}>
                    {top.data.items.map((item) => (
                      <tr key={item.dishId}>
                        <td className="text-ink-700 tabular px-3 py-2.5 text-center">
                          {item.position}
                        </td>
                        <td className="text-ink-900 px-3 py-2.5 font-medium">{item.name}</td>
                        <td className="text-ink-600 tabular px-3 py-2.5 text-right">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="text-ink-900 tabular px-3 py-2.5 text-right font-semibold">
                          {formatQty(item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {topPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Предыдущая страница"
                    disabled={topPage <= 1}
                    onClick={() => setTopPage((page) => page - 1)}
                    className="border-ink-200 text-ink-600 hover:border-ink-300 flex size-9 items-center justify-center rounded-lg border bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-ink-700 tabular min-w-14 text-center text-sm font-semibold">
                    {topPage} / {topPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Следующая страница"
                    disabled={topPage >= topPages}
                    onClick={() => setTopPage((page) => page + 1)}
                    className="border-ink-200 text-ink-600 hover:border-ink-300 flex size-9 items-center justify-center rounded-lg border bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Официанты"
          icon={<Users />}
          subtitle={
            waiters.data
              ? `Процент обслуживания: ${waiters.data.percent}% · всего ${formatMoney(waiters.data.totalCommission)} сум`
              : undefined
          }
        />
        <div className="px-5 pt-3 pb-5">
          {waiters.isLoading ? (
            <Skeleton className="h-40" />
          ) : !waiters.data?.items.length ? (
            <EmptyState
              compact
              title="Нет официантов"
              description="Назначьте сотрудникам роль с правом «Официант»."
            />
          ) : (
            <div className="table-frame">
              <table className="table-grid w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-12 px-3 py-2.5 text-center">№</th>
                    <th className="px-3 py-2.5 text-left">Название</th>
                    <th className="px-3 py-2.5 text-right">Заказов</th>
                    <th className="px-3 py-2.5 text-right">Продажи</th>
                    <th className="w-36 px-3 py-2.5 text-right">{waiters.data.percent}%</th>
                  </tr>
                </thead>
                <tbody>
                  {waiters.data.items.map((waiter, index) => (
                    <tr key={waiter.userId}>
                      <td className="text-ink-700 tabular px-3 py-2.5 text-center">{index + 1}</td>
                      <td className="text-ink-900 px-3 py-2.5 font-medium">{waiter.fullName}</td>
                      <td className="text-ink-600 tabular px-3 py-2.5 text-right">
                        {waiter.ordersCount}
                      </td>
                      <td className="text-ink-600 tabular px-3 py-2.5 text-right">
                        {formatMoney(waiter.sales)}
                      </td>
                      <td
                        className={cn(
                          'tabular px-3 py-2.5 text-right font-semibold',
                          waiter.commission > 0 ? 'text-brand-900' : 'text-ink-400',
                        )}
                      >
                        {formatMoney(waiter.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
