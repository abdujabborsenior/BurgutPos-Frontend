import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CountChip } from './Badge';

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

/**
 * Tabs. `pill` (default) — separate pills for filters (status, halls,
 * "мои заказы"…). `track` — equal segments on one grey track, for a narrow
 * panel where the choice must stay on a single row (receipt preview).
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
  variant = 'pill',
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'track';
}) {
  const track = variant === 'track';
  return (
    <div
      role="tablist"
      className={cn(
        track
          ? 'bg-ink-100 flex items-center gap-1 rounded-xl p-1'
          : 'flex flex-wrap items-center gap-2',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-2 font-semibold whitespace-nowrap transition-colors duration-150 [&_svg]:size-4',
              track
                ? cn(
                    'h-8 min-w-0 flex-1 justify-center rounded-lg px-2 text-[13px]',
                    active
                      ? 'text-ink-900 bg-white shadow-[0_1px_2px_rgb(18_16_72/0.12)]'
                      : 'text-ink-600 hover:text-ink-900',
                  )
                : cn(
                    'rounded-xl border',
                    size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-3.5 text-[13px]',
                    active
                      ? 'border-brand-900 bg-brand-900 text-white shadow-[0_1px_2px_rgb(18_16_72/0.25)]'
                      : 'border-ink-200 text-ink-700 hover:border-ink-300 hover:text-ink-900 bg-white',
                  ),
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <CountChip value={item.count} active={active && !track} />
            )}
          </button>
        );
      })}
    </div>
  );
}
