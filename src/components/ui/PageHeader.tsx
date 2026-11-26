import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Page title card (layout from the reference: title + subtitle left, actions right). */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-150/80 bg-white px-6 py-5 shadow-card',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-[-0.01em] text-ink-900">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Card that hosts a toolbar + table. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-ink-150/80 bg-white p-4 shadow-card sm:p-5', className)}>
      {children}
    </section>
  );
}

export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mb-4 flex flex-wrap items-center gap-2.5', className)}>{children}</div>;
}
