import { get, patch, post } from './http';
import type {
  BoardHall,
  Counters,
  DiscountType,
  ListParams,
  OrderDetail,
  OrderLineInput,
  OrderListItem,
  OrderMutationResult,
  OrderStatus,
  OrderType,
  Paginated,
} from './types';

export interface OrderListParams extends ListParams {
  status?: OrderStatus;
  type?: OrderType;
  waiterId?: number;
  mine?: boolean;
  from?: string;
  to?: string;
}

export interface CreateOrderInput {
  type: OrderType;
  tableId?: number;
  waiterId?: number;
  guests?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  comment?: string;
  items: OrderLineInput[];
}

export interface UpdateOrderInput {
  guests?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryFee?: number;
  comment?: string | null;
}

export const posApi = {
  board: () => get<BoardHall[]>('/pos/board'),
  counters: () => get<Counters>('/pos/counters'),
};

export const ordersApi = {
  list: (params: OrderListParams) => get<Paginated<OrderListItem> & { sum: number }>('/orders', params),
  get: (id: number) => get<OrderDetail>(`/orders/${id}`),
  create: (input: CreateOrderInput) => post<OrderMutationResult>('/orders', input),
  addItems: (id: number, items: OrderLineInput[]) =>
    post<OrderMutationResult>(`/orders/${id}/items`, { items }),
  cancelItem: (id: number, itemId: number, input: { quantity: number; reason: string; returnToStock: boolean }) =>
    post<OrderDetail>(`/orders/${id}/items/${itemId}/cancel`, input),
  update: (id: number, input: UpdateOrderInput) => patch<OrderDetail>(`/orders/${id}`, input),
  changeWaiter: (id: number, waiterId: number) => post<OrderDetail>(`/orders/${id}/waiter`, { waiterId }),
  move: (id: number, tableId: number) => post<OrderDetail>(`/orders/${id}/move`, { tableId }),
  merge: (id: number, targetOrderId: number) =>
    post<OrderDetail>(`/orders/${id}/merge`, { targetOrderId }),
  discount: (id: number, type: DiscountType | null, value: number) =>
    post<OrderDetail>(`/orders/${id}/discount`, { type, value }),
  precheck: (id: number) => post<OrderDetail>(`/orders/${id}/precheck`),
  /** The browser printed the receipt of a paid order — log it in its print history. */
  receiptPrinted: (id: number) => post<OrderDetail>(`/orders/${id}/receipt-print`),
  pay: (id: number, payments: { methodId: number; amount: number }[]) =>
    post<OrderDetail>(`/orders/${id}/pay`, { payments }),
  cancel: (id: number, input: { reason: string; returnToStock: boolean }) =>
    post<OrderDetail>(`/orders/${id}/cancel`, input),
  /** Returns a paid order to work; its payments are reversed in the open shift. */
  reopen: (id: number, reason: string) => post<OrderDetail>(`/orders/${id}/reopen`, { reason }),
};
