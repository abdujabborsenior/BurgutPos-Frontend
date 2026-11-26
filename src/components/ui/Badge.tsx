import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'dark';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200/70',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200/70',
  success: 'bg-success-50 text-success-700 ring-success-200/70',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200/70',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200/70',
  dark: 'bg-brand-900 text-white ring-brand-900',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-ink-400',
  brand: 'bg-brand-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  dark: 'bg-white',
};

export function Badge({
  tone = 'neutral',
  dot,
  size = 'md',
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

/** Small numeric counter used on tabs and chips. */
export function CountChip({ value, active, className }: { value: number; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular',
        active ? 'bg-white/18 text-white' : 'bg-brand-50 text-brand-800',
        className,
      )}
    >
      {value}
    </span>
  );
}
