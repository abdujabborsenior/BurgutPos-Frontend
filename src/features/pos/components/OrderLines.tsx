import { ChevronDown, MessageSquare, Minus, Plus, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import type { OrderItemView } from '@/api/types';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS } from '@/lib/labels';
import { formatMoney, formatQty, formatTime } from '@/lib/format';
import type { CartLine } from '@/stores/cart.store';

export function SentLines({
  items,
  canCancel,
  onCancel,
}: {
  items: OrderItemView[];
  canCancel: boolean;
  onCancel: (item: OrderItemView) => void;
}) {
  const [showCancelled, setShowCancelled] = useState(false);
  const active = items.filter((item) => item.status === 'ACTIVE');
  const cancelled = items.filter((item) => item.status === 'CANCELLED');
  return (
    <div>
      {active.map((item) => (
        <div key={item.id} className="group flex items-start gap-3 border-b border-ink-100 py-2.5 last:border-0">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug font-medium text-ink-900">{item.name}</p>
            <p className="mt-0.5 text-xs text-ink-500 tabular">
              {formatQty(item.quantity)} {DISH_UNIT_LABELS[item.unit]} × {formatMoney(item.price)}
              <span className="text-ink-300"> · </span>
              {formatTime(item.createdAt)}
              {item.createdBy ? ` · ${item.createdBy.fullName}` : ''}
            </p>
            {item.comment && <p className="mt-0.5 text-xs text-brand-700 italic">{item.comment}</p>}
          </div>
          <span className="pt-0.5 text-[14px] font-semibold text-ink-900 tabular">{formatMoney(item.total)}</span>
          {canCancel && (
            <IconButton label="Отменить позицию" icon={<Undo2 />} size="xs" variant="danger" onClick={() => onCancel(item)} />
          )}
        </div>
      ))}
      {cancelled.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowCancelled((value) => !value)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800"
          >
            Отменено ({cancelled.length})
            <ChevronDown className={cn('size-3.5 transition-transform', showCancelled && 'rotate-180')} />
          </button>
          {showCancelled && (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {cancelled.map((item) => (
                <li key={item.id} className="rounded-lg bg-danger-50/60 px-2.5 py-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-500 line-through">
                      {item.name} × {formatQty(item.quantity)}
                    </span>
                    <span className="text-ink-500 line-through tabular">{formatMoney(item.total)}</span>
                  </div>
                  <p className="mt-0.5 text-danger-700">
                    {item.cancelReason}
                    {item.cancelledBy ? ` · ${item.cancelledBy.fullName}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ line, onChange, onEdit }: { line: CartLine; onChange: (quantity: number) => void; onEdit: () => void }) {
  const fractional = FRACTIONAL_DISH_UNITS.includes(line.unit);
  const button =
    'flex size-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-900';
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Меньше" className={button} onClick={() => onChange(fractional ? 0 : line.quantity - 1)}>
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        title="Изменить количество"
        className="h-8 min-w-11 rounded-lg px-1.5 text-center text-[14px] font-bold text-ink-900 tabular hover:bg-white"
      >
        {formatQty(line.quantity)}
        {fractional && <span className="ml-0.5 text-[10px] font-medium text-ink-500">{DISH_UNIT_LABELS[line.unit]}</span>}
      </button>
      <button
        type="button"
        aria-label="Больше"
        className={button}
        onClick={() => (fractional ? onEdit() : onChange(line.quantity + 1))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function CartLines({
  lines,
  onQuantity,
  onEditQuantity,
  onComment,
  onRemove,
}: {
  lines: CartLine[];
  onQuantity: (line: CartLine, quantity: number) => void;
  onEditQuantity: (line: CartLine) => void;
  onComment: (line: CartLine, comment: string) => void;
  onRemove: (line: CartLine) => void;
}) {
  const [commenting, setCommenting] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => (
        <div key={line.key} className="rounded-xl bg-brand-50/70 p-2.5 ring-1 ring-brand-100">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold text-ink-900">{line.name}</p>
            <Stepper line={line} onChange={(quantity) => onQuantity(line, quantity)} onEdit={() => onEditQuantity(line)} />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {commenting === line.key ? (
              <input
                autoFocus
                maxLength={255}
                defaultValue={line.comment}
                placeholder="Комментарий для кухни"
                onBlur={(event) => {
                  onComment(line, event.target.value.trim());
                  setCommenting(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                  if (event.key === 'Escape') setCommenting(null);
                }}
                className="h-7 min-w-0 flex-1 rounded-lg border border-brand-200 bg-white px-2 text-xs text-ink-900 focus:border-brand-500 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setCommenting(line.key)}
                className={cn(
                  'inline-flex min-w-0 flex-1 items-center gap-1 text-left text-xs',
                  line.comment ? 'font-medium text-brand-700 italic' : 'text-ink-500 hover:text-brand-700',
                )}
              >
                <MessageSquare className="size-3 shrink-0" />
                <span className="truncate">{line.comment || 'Комментарий'}</span>
              </button>
            )}
            <span className="text-[13px] font-semibold text-ink-900 tabular">{formatMoney(line.price * line.quantity)}</span>
            <button
              type="button"
              aria-label="Убрать из корзины"
              onClick={() => onRemove(line)}
              className="rounded-md p-1 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TotalsBlock({
  rows,
  total,
  totalLabel = 'К оплате',
}: {
  rows: { label: string; value: string; tone?: 'danger' | 'muted' }[];
  total: number;
  totalLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between text-[13px]">
          <span className="text-ink-500">{row.label}</span>
          <span className={cn('font-medium tabular', row.tone === 'danger' ? 'text-danger-600' : 'text-ink-800')}>{row.value}</span>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-ink-200 pt-2.5">
        <span className="text-sm font-semibold text-ink-700">{totalLabel}</span>
        <span className="text-[26px] leading-none font-bold tracking-[-0.02em] text-brand-950 tabular">{formatMoney(total)}</span>
      </div>
    </div>
  );
}
