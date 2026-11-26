import type { OrderStatus } from '@/api/types';
import type { BadgeTone } from '@/components/ui';

/** How an order status reads everywhere in reports: the list and the order window. */
export const ORDER_STATUS_VIEW: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Ожидает оплаты', tone: 'warning' },
  PAID: { label: 'Оплачен', tone: 'success' },
  CANCELLED: { label: 'Отменён', tone: 'danger' },
  MERGED: { label: 'Объединён', tone: 'neutral' },
};
