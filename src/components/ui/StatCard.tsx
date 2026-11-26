import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

/** KPI tile: small label with icon, large semibold numeral, optional footnote. */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'default',
  loading,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-ink-150/80 bg-white p-5 shadow-card', className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-600 [&_svg]:size-4 [&_svg]:text-ink-500">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-32" />
      ) : (
        <div
          className={cn(
            'mt-2 text-[28px] leading-tight font-semibold tracking-[-0.02em] tabular',
            tone === 'default' && 'text-ink-900',
            tone === 'brand' && 'text-brand-900',
            tone === 'success' && 'text-success-700',
            tone === 'warning' && 'text-warning-700',
            tone === 'danger' && 'text-danger-700',
          )}
        >
          {value}
        </div>
      )}
      {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}
