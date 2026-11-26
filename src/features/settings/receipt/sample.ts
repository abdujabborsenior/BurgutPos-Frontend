import type { OrderDetail, OrderItemView, OrderType } from '@/api/types';

/** A fixed moment, so the preview never flickers while editing. */
export const SAMPLE_AT = new Date('2026-11-12T19:45:00+05:00');

const item = (
  id: number,
  name: string,
  quantity: number,
  price: number,
  comment: string | null = null,
): OrderItemView => ({
  id,
  dishId: id,
  name,
  categoryName: null,
  printerId: null,
  printerName: 'КУХНЯ',
  unit: 'PCS',
  price,
  quantity,
  total: price * quantity,
  comment,
  status: 'ACTIVE',
  createdAt: SAMPLE_AT.toISOString(),
  createdBy: { id: 1, fullName: 'Озода' },
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  stockReturned: null,
});

/** The bill sample: the very lines of the reference «Чек стола». */
const ITEMS: OrderItemView[] = [
  item(1, 'Палов', 2, 30_000),
  item(2, 'Чой', 1, 8_000),
  item(3, 'Ош 3кг', 1, 1_170_000),
  item(4, 'Istanbul Lazzat 15.000 сўмлик', 1, 150_000),
];

/**
 * The order the previews are drawn from: the same shape the printer gets, so
 * what the editor shows is what the paper will say. The bill prints the table
 * as «ЗАЛ • 5»; the kitchen ticket heads with the table name, so it passes a
 * fuller one.
 */
export function sampleOrder(type: OrderType, paid = true, tableName = '5'): OrderDetail {
  const subtotal = ITEMS.reduce((sum, line) => sum + line.total, 0);
  const servicePercent = type === 'TABLE' ? 10 : 0;
  const serviceAmount = Math.round((subtotal * servicePercent) / 100);
  const total = subtotal + serviceAmount;
  return {
    id: 1,
    number: 412,
    businessDate: '2026-11-12',
    shiftId: 31,
    type,
    status: paid ? 'PAID' : 'OPEN',
    table: type === 'TABLE' ? { id: 5, name: tableName, hall: { id: 1, name: 'ЗАЛ' } } : null,
    waiter: { id: 2, fullName: 'Алишер' },
    createdBy: { id: 1, fullName: 'Озода' },
    closedBy: paid ? { id: 1, fullName: 'Озода' } : null,
    guests: type === 'TABLE' ? 4 : null,
    customerName: null,
    customerPhone: null,
    deliveryAddress: null,
    comment: null,
    subtotal,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    servicePercent,
    serviceAmount,
    deliveryFee: 0,
    total,
    itemsCount: ITEMS.length,
    precheckAt: null,
    reopenCount: 0,
    createdAt: SAMPLE_AT.toISOString(),
    closedAt: paid ? SAMPLE_AT.toISOString() : null,
    paidAmount: paid ? total : 0,
    receivedAmount: paid ? total : 0,
    changeAmount: 0,
    precheckCount: 0,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    mergedIntoId: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    updatedAt: SAMPLE_AT.toISOString(),
    items: ITEMS,
    payments: paid
      ? [
          {
            id: 1,
            method: { id: 1, name: 'Наличные', type: 'CASH' },
            amount: total,
            isReversal: false,
            createdAt: SAMPLE_AT.toISOString(),
            cashier: { id: 1, fullName: 'Озода' },
          },
        ]
      : [],
    prints: [],
  };
}

/** Kitchen sample: the same dishes, one with a note for the cook. */
export const SAMPLE_ITEMS: OrderItemView[] = ITEMS.map((line) =>
  line.id === 2 ? { ...line, comment: 'без сахара' } : line,
);
