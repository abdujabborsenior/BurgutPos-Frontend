import { ChartColumn } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { formatCompactMoney, formatCount } from './report-utils';

export interface RevenuePoint {
  /** Axis label: "05.11", "14:00". */
  label: string;
  /** Tooltip heading: "05.11.2026, чт", "14:00 – 15:00". */
  title: string;
  amount: number;
  count: number;
}

/**
 * One brand series on recessive ink chrome. Hex values mirror the theme tokens
 * because SVG presentation attributes cannot read CSS variables.
 */
const CHART = {
  bar: '#3330a8', // brand-700
  barActive: '#4443c6', // brand-600
  grid: '#e4e6ef', // ink-150
  tick: '#7a7f98', // ink-500
  cursor: '#f4f5fa', // ink-50
} as const;

const HEIGHT = 280;
const TICK = { fill: CHART.tick, fontSize: 12 };
/** Above this the Y axis switches to compact ticks (250 тыс., 1,5 млн) — one style per axis. */
const COMPACT_FROM = 10_000;

function RevenueTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as RevenuePoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="min-w-48 rounded-xl border border-ink-150 bg-white px-3.5 py-3 shadow-raised">
      <p className="text-xs font-medium text-ink-500">{point.title}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: CHART.bar }} />
          <dt className="text-[13px] text-ink-600">Выручка</dt>
          <dd className="ml-auto pl-4 text-sm font-semibold text-ink-900 tabular">{formatMoney(point.amount)}</dd>
        </div>
        <div className="flex items-center gap-2 pl-5">
          <dt className="text-[13px] text-ink-600">Заказов</dt>
          <dd className="ml-auto pl-4 text-sm font-semibold text-ink-900 tabular">{formatCount(point.count)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Revenue bar chart in a card, with loading, empty and "previous data" states. */
export function RevenueChart({
  title,
  subtitle,
  points,
  loading,
  stale,
  emptyText = 'Нет оплаченных заказов за период',
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  points: RevenuePoint[];
  loading?: boolean;
  /** Showing the previous filter's data while the new one loads. */
  stale?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const max = points.reduce((highest, point) => Math.max(highest, point.amount), 0);
  const hasData = points.some((point) => point.amount > 0 || point.count > 0);

  return (
    // min-w-0: as a grid item the card must be allowed to shrink, or the chart never narrows.
    <Card className={cn('min-w-0', className)}>
      <CardHeader title={title} subtitle={subtitle} />
      <div className={cn('px-3 pt-4 pb-3 transition-opacity duration-150', stale && !loading && 'opacity-60')}>
        {loading ? (
          <Skeleton className="mx-2 h-[280px]" />
        ) : hasData ? (
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis
                dataKey="label"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={8}
                interval="preserveStartEnd"
              />
              <YAxis
                width="auto"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={4}
                allowDecimals={false}
                tickFormatter={max >= COMPACT_FROM ? formatCompactMoney : formatMoney}
              />
              <Tooltip content={RevenueTooltip} cursor={{ fill: CHART.cursor }} isAnimationActive={false} />
              <Bar
                dataKey="amount"
                name="Выручка"
                fill={CHART.bar}
                activeBar={{ fill: CHART.barActive }}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center">
            <EmptyState compact icon={<ChartColumn />} title={emptyText} />
          </div>
        )}
      </div>
    </Card>
  );
}
