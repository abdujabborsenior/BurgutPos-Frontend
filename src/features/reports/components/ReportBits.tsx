import { Info, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { getErrorMessage } from '@/api/http';
import type { MethodAmount } from '@/api/report-types';
import { Button, EmptyState, type Column } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { formatSignedMoney } from './report-utils';

const KPI_COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
} as const;

/** Row of KPI tiles; dims while it still shows the previous filter's numbers. */
export function KpiGrid({
  stale,
  columns = 4,
  children,
}: {
  stale?: boolean;
  columns?: keyof typeof KPI_COLUMNS;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 transition-opacity duration-150',
        KPI_COLUMNS[columns],
        stale && 'opacity-60',
      )}
    >
      {children}
    </div>
  );
}

/**
 * "+1 388 300" — money (or a count) of orders still waiting for payment.
 * Amber is reserved for exactly this meaning across every report.
 */
export function Pending({
  value,
  label,
  format = formatMoney,
  className,
}: {
  value: number | null | undefined;
  label?: string;
  format?: (value: number) => string;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span className={cn('text-warning-600 tabular', className)}>
      +{format(value)}
      {label ? ` · ${label}` : ''}
    </span>
  );
}

/** "−35 000" — what was cancelled. Red is reserved for losses. */
export function Lost({
  value,
  format = formatMoney,
  className,
}: {
  value: number | null | undefined;
  format?: (value: number) => string;
  className?: string;
}) {
  if (!value) return null;
  return <span className={cn('text-danger-600 tabular', className)}>{`−${format(value)}`}</span>;
}

/**
 * Table cell: the paid figure with what is still waiting for payment (+) and
 * what was cancelled (−) underneath, as in the reference.
 */
export function StackedValue({
  value,
  pending,
  lost,
  format = formatMoney,
  strong,
  tone,
}: {
  value: number;
  pending?: number;
  lost?: number;
  format?: (value: number) => string;
  strong?: boolean;
  tone?: 'brand';
}) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className={cn('tabular', strong && 'font-semibold', tone === 'brand' ? 'text-brand-700' : 'text-ink-900')}>
        {format(value)}
      </span>
      {Boolean(pending) && <Pending value={pending} format={format} className="text-[11.5px]" />}
      {Boolean(lost) && <Lost value={lost} format={format} className="text-[11.5px]" />}
    </div>
  );
}

/** "Наличные 181 500" chips of the money an order holds, one per method. */
export function MethodChips({ payments }: { payments: MethodAmount[] }) {
  if (!payments.length) return <Dash />;
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {payments.map((payment) => (
        <span
          key={payment.methodId}
          className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-ink-700"
        >
          {payment.name} <span className="font-semibold text-ink-900 tabular">{formatMoney(payment.amount)}</span>
        </span>
      ))}
    </div>
  );
}

/** Unknown / not applicable value. */
export function Dash() {
  return <span className="text-ink-400">—</span>;
}

/** Optional amount (discount, service, a payment method): zero reads as "none". */
export function MoneyOrDash({ value }: { value: number | null | undefined }) {
  if (!value) return <Dash />;
  return <span className="tabular">{formatMoney(value)}</span>;
}

/** Money that can go below zero (profit): negative values are flagged. */
export function ProfitValue({ value }: { value: number }) {
  return <span className={cn('tabular', value < 0 && 'text-danger-700')}>{formatMoney(value)}</span>;
}

/** Cash difference: shortage in danger, surplus in success, exact match neutral. */
export function SignedMoney({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <Dash />;
  return (
    <span
      className={cn(
        'tabular',
        value < 0 ? 'text-danger-700' : value > 0 ? 'text-success-700' : 'text-ink-700',
      )}
    >
      {formatSignedMoney(value)}
    </span>
  );
}

/** Share column: percentage plus a thin proportional bar. */
export function ShareBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="mx-auto flex w-36 items-center gap-2.5">
      <span className="w-14 shrink-0 text-right text-[13px] text-ink-700 tabular">{formatPercent(value)}</span>
      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
        <span
          className={cn('block h-full rounded-full bg-brand-600', width > 0 && 'min-w-0.5')}
          style={{ width: `${width}%` }}
        />
      </span>
    </div>
  );
}

/**
 * Daily order number ("417") — opens the order when the viewer has POS
 * access, plain text otherwise.
 */
export function OrderLink({ id, number }: { id: number; number: number }) {
  const canOpen = useCan(Permission.PosAccess);
  if (!canOpen) return <span className="font-semibold text-ink-900 tabular">{number}</span>;
  return (
    <Link
      to={`/pos/order/${id}`}
      title={`Открыть заказ #${number}`}
      className="font-semibold text-brand-700 tabular transition-colors hover:text-brand-950 hover:underline"
    >
      {number}
    </Link>
  );
}

/** Explanatory footnote under a report block. */
export function ReportNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 px-1 text-xs text-ink-500">
      <Info className="mt-px size-3.5 shrink-0 text-ink-400" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ReportEmpty({
  title = 'Нет записей',
  description = 'За выбранный период данных нет — выберите другой период',
}: {
  title?: string;
  description?: string;
}) {
  return <EmptyState compact title={title} description={description} />;
}

export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="Не удалось загрузить отчёт"
      description={getErrorMessage(error)}
      action={
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="size-4" />} onClick={onRetry}>
          Повторить
        </Button>
      }
    />
  );
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/**
 * Totals row for DataTable's `footer`. The label spans the leading columns
 * (and the "№" column) up to the first column that has a total; the rest are
 * aligned exactly like their body cells.
 */
export function TotalsRow<T>({
  columns,
  values,
  numbered = false,
  label = 'Итого',
}: {
  columns: Column<T>[];
  values: Partial<Record<string, ReactNode>>;
  numbered?: boolean;
  label?: ReactNode;
}) {
  const firstTotal = columns.findIndex((column) => values[column.key] !== undefined);
  const lead = Math.max(1, firstTotal === -1 ? columns.length : firstTotal);
  return (
    <tr>
      <td colSpan={lead + (numbered ? 1 : 0)} className="px-4 py-3.5 text-left whitespace-nowrap text-ink-900">
        {label}
      </td>
      {columns.slice(lead).map((column) => (
        <td
          key={column.key}
          className={cn('px-4 py-3.5 whitespace-nowrap text-ink-900 tabular', ALIGN[column.align ?? 'center'])}
        >
          {values[column.key]}
        </td>
      ))}
    </tr>
  );
}
