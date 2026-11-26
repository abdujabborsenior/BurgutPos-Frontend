import { ArrowLeftRight, Ban, Eye, Lock, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney, formatShortDateTime } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';

export interface OrderCardActions {
  onOpen: () => void;
  onTransfer?: () => void;
  onCancel?: () => void;
  onPay?: () => void;
  onPrint?: () => void;
  printing?: boolean;
}

/** Green is eaten here (стол / зал), orange leaves the venue (с собой / доставка). */
export type OrderTone = 'occupied' | 'togo';

/** The tile is read at arm's length: the glyphs are bigger and darker than
 *  elsewhere in the app, and only the two decisive actions are coloured. */
const ACTION = '[&_svg]:size-[18px]';
const NEUTRAL = `${ACTION} text-ink-800 hover:bg-ink-100 hover:text-ink-950`;

const TONES: Record<OrderTone, { bar: string; ring: string }> = {
  occupied: { bar: 'bg-occupied-500', ring: 'ring-occupied-500' },
  togo: { bar: 'bg-togo-500', ring: 'ring-togo-500' },
};

/**
 * Open order tile. The coloured header and footer frame the two things read
 * from across the room — which table and whose order — while the white middle
 * keeps the numbers and the actions legible.
 */
export function OrderCard({
  title,
  number,
  createdAt,
  total,
  footer,
  tone = 'occupied',
  printCount = 0,
  extra,
  actions,
}: {
  title: string;
  /** Daily order number (#412). */
  number: number;
  createdAt: string;
  total: number;
  footer: ReactNode;
  tone?: OrderTone;
  /** How many times the bill was printed — shown on the printer button. */
  printCount?: number;
  extra?: ReactNode;
  actions: OrderCardActions;
}) {
  const canTransfer = useCan(Permission.OrdersTransfer);
  const canCancel = useCan(Permission.OrdersCancel);
  const canPay = useCan(Permission.OrdersPay);
  const colors = TONES[tone];

  return (
    <div
      className={cn(
        'group flex min-h-[156px] flex-col overflow-hidden rounded-2xl bg-white shadow-raised ring-1 transition-transform duration-150 hover:-translate-y-0.5',
        colors.ring,
      )}
    >
      <button
        type="button"
        onClick={actions.onOpen}
        className={cn('flex h-9 shrink-0 items-center justify-center px-3 text-white', colors.bar)}
      >
        <span className="truncate text-[15px] font-bold tracking-[0.01em] uppercase">{title}</span>
      </button>
      <button
        type="button"
        onClick={actions.onOpen}
        className="flex flex-1 flex-col items-center justify-center px-2 pt-1.5 pb-0.5"
      >
        <span className="text-xs text-ink-500 tabular">
          #{number} · {formatShortDateTime(createdAt)}
        </span>
        <span className="mt-0.5 text-[21px] leading-tight font-bold text-ink-900 tabular">{formatMoney(total)}</span>
        {extra}
      </button>
      <div className="flex shrink-0 items-center justify-center gap-0.5 pb-1.5">
        <IconButton label="Открыть заказ" icon={<Eye />} size="sm" className={NEUTRAL} onClick={actions.onOpen} />
        {actions.onTransfer && canTransfer && (
          <IconButton label="Перенести" icon={<ArrowLeftRight />} size="sm" className={NEUTRAL} onClick={actions.onTransfer} />
        )}
        {actions.onCancel && canCancel && (
          <IconButton
            label="Отменить заказ"
            icon={<Ban />}
            size="sm"
            variant="danger"
            className={ACTION}
            onClick={actions.onCancel}
          />
        )}
        {actions.onPay && canPay && (
          <IconButton
            label="Закрыть и оплатить"
            icon={<Lock />}
            size="sm"
            variant="brand"
            className={ACTION}
            onClick={actions.onPay}
          />
        )}
        {actions.onPrint && (
          <IconButton
            label={printCount > 0 ? `Печать счёта · уже напечатан: ${printCount}` : 'Печать счёта'}
            icon={<Printer />}
            size="sm"
            className={NEUTRAL}
            badge={printCount || undefined}
            loading={actions.printing}
            onClick={actions.onPrint}
          />
        )}
      </div>
      <div className={cn('shrink-0 truncate px-3 py-1 text-center text-[13px] font-semibold text-white', colors.bar)}>
        {footer}
      </div>
    </div>
  );
}

/** Free table: the name and one word, so a glance across the hall is enough. */
export function FreeTableCard({ name, onClick, disabled }: { name: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[156px] flex-col items-center justify-center rounded-2xl border border-ink-150 bg-white px-3 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      <span className="line-clamp-2 text-center text-[19px] leading-tight font-bold tracking-[-0.01em] text-ink-900 uppercase">
        {name}
      </span>
      <span className="mt-1.5 text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Свободен</span>
    </button>
  );
}

/**
 * First tile of a channel board: a new order is started where the eye already
 * is — among the orders themselves, not in a corner of the page.
 */
export function NewOrderCard({
  title,
  icon,
  onClick,
  disabled,
  hint,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className="flex min-h-[156px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-white px-3 py-4 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-ink-200 disabled:hover:bg-white"
    >
      <span className="text-[15px] font-semibold text-ink-900">{title}</span>
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 [&_svg]:size-6">
        {icon}
      </span>
      <span className="text-[13px] font-medium text-ink-600">Создать заказ</span>
    </button>
  );
}
