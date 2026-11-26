import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { getErrorMessage } from '@/api/http';
import type { StockMovementType } from '@/api/types';
import { Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatQty } from '@/lib/format';
import { MOVEMENT_TYPE_LABELS } from '@/lib/labels';
import { formatSignedQty, MOVEMENT_TONES, roundTo, unitLabel, type StockUnit } from './stock.utils';

/** Table body replacement when a list request fails: shows the server message. */
export function LoadError({ error }: { error: unknown }) {
  return (
    <EmptyState compact title="Не удалось загрузить данные" description={getErrorMessage(error)} />
  );
}

export function MovementTypeBadge({ type, size }: { type: StockMovementType; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={MOVEMENT_TONES[type]} size={size}>
      {MOVEMENT_TYPE_LABELS[type]}
    </Badge>
  );
}

/**
 * Stock figure. Negative stock is always red; zero is red only where it
 * blocks sales (`alert`), otherwise it is muted.
 */
export function StockQty({
  value,
  alert = true,
  className,
}: {
  value: number;
  alert?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'tabular',
        value < 0 || (value === 0 && alert)
          ? 'text-danger-600 font-medium'
          : value === 0
            ? 'text-ink-500'
            : 'text-ink-800',
        className,
      )}
    >
      {formatQty(value)}
    </span>
  );
}

/**
 * Stock of a dish sold without quantity control. Inside a `StockCellButton`
 * pass `title={null}` so the button's own hint shows over the sign too.
 */
export function UnlimitedMark({
  className,
  title = 'Без учёта остатка',
}: {
  className?: string;
  title?: string | null;
}) {
  return (
    <span
      className={cn('text-ink-800 text-lg leading-none font-semibold', className)}
      title={title ?? undefined}
      aria-label="Без учёта остатка"
    >
      ∞
    </span>
  );
}

/**
 * A stock figure that opens its editor. The whole cell is the target and
 * lights up on hover; a row click elsewhere keeps its own meaning, since
 * DataTable ignores clicks that land on a button.
 */
export function StockCellButton({
  hint,
  disabled,
  onClick,
  children,
}: {
  hint: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? undefined : hint}
      onClick={onClick}
      className="enabled:hover:bg-ink-100 inline-flex min-h-8 w-full min-w-16 items-center justify-center rounded-md px-2 py-1 transition-colors disabled:cursor-default"
    >
      {children}
    </button>
  );
}

/** Signed change: green when stock grows, red when it shrinks. */
export function QtyDelta({
  value,
  unit,
  zeroLabel = '0',
  className,
}: {
  value: number;
  unit?: StockUnit | null;
  zeroLabel?: string;
  className?: string;
}) {
  if (value === 0) return <span className={cn('text-ink-400', className)}>{zeroLabel}</span>;
  const label = unitLabel(unit);
  return (
    <span
      className={cn(
        'tabular font-semibold whitespace-nowrap',
        value > 0 ? 'text-success-700' : 'text-danger-600',
        className,
      )}
    >
      {formatSignedQty(value)}
      {label && `\u00a0${label}`}
    </span>
  );
}

/** "Было → станет" tile used by the stock operation dialogs. */
export function BalanceShift({
  label,
  current,
  next,
  unit,
  className,
}: {
  label: ReactNode;
  current: number;
  /** null while the quantity is not entered yet. */
  next: number | null;
  unit: StockUnit;
  className?: string;
}) {
  const changed = next !== null && next !== current;
  return (
    <div className={cn('border-ink-150 bg-ink-25 rounded-xl border px-4 py-3', className)}>
      <div className="text-ink-500 text-xs font-medium">{label}</div>
      <div className="tabular mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span
          className={cn(
            changed ? 'text-ink-500' : 'text-ink-900 font-semibold',
            current < 0 && 'text-danger-600',
          )}
        >
          {formatQty(current)}
        </span>
        {changed && (
          <>
            <ArrowRight className="text-ink-400 size-3.5" aria-hidden />
            <span className={cn('font-semibold', next < 0 ? 'text-danger-600' : 'text-ink-900')}>
              {formatQty(next)}
            </span>
          </>
        )}
        <span className="text-ink-400 text-xs">{unitLabel(unit)}</span>
        {changed && <QtyDelta value={roundTo(next - current, 3)} className="ml-auto text-xs" />}
      </div>
    </div>
  );
}

/** Inline "fill with the maximum" action placed inside a field hint. */
export function FillMaxHint({
  label,
  value,
  unit,
  onFill,
}: {
  label: string;
  value: number;
  unit: StockUnit;
  onFill?: () => void;
}) {
  return (
    <>
      {label}: <span className="text-ink-700 tabular font-medium">{formatQty(value)}</span>{' '}
      {unitLabel(unit)}
      {onFill && value > 0 && (
        <>
          {' · '}
          <button
            type="button"
            onClick={onFill}
            className="text-brand-700 hover:text-brand-900 font-semibold hover:underline"
          >
            Всё
          </button>
        </>
      )}
    </>
  );
}
