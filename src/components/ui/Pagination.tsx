import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { Select } from './Select';

const PAGE_SIZES = [10, 20, 50, 100];

function pages(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) result.push('gap');
  for (let page = start; page <= end; page += 1) result.push(page);
  if (end < total - 1) result.push('gap');
  result.push(total);
  return result;
}

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  className,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const button =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-[13px] font-semibold tabular transition-colors duration-150';
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2 text-[13px] text-ink-600">
        <span>
          Всего: <span className="font-semibold text-ink-900 tabular">{formatMoney(total)}</span>
        </span>
        {onLimitChange && (
          <>
            <span className="text-ink-300">·</span>
            <span>На странице:</span>
            <Select
              size="sm"
              value={limit}
              onChange={onLimitChange}
              options={PAGE_SIZES.map((size) => ({ value: size, label: String(size) }))}
              buttonClassName="w-[76px]"
            />
          </>
        )}
      </div>
      {totalPages > 1 && (
        <nav aria-label="Страницы" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Предыдущая страница"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={cn(button, 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 disabled:opacity-40')}
          >
            <ChevronLeft className="size-4" />
          </button>
          {pages(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-ink-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  button,
                  item === page
                    ? 'border-brand-900 bg-brand-900 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-900',
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Следующая страница"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={cn(button, 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 disabled:opacity-40')}
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
