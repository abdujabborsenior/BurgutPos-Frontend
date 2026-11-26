import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DishUnit, OrderType } from '@/api/types';

export interface CartLine {
  key: string;
  dishId: number;
  name: string;
  price: number;
  unit: DishUnit;
  quantity: number;
  comment: string;
}

interface CartState {
  carts: Record<string, CartLine[]>;
  add: (cartKey: string, dish: Pick<CartLine, 'dishId' | 'name' | 'price' | 'unit'>, quantity?: number) => void;
  setQuantity: (cartKey: string, lineKey: string, quantity: number) => void;
  setComment: (cartKey: string, lineKey: string, comment: string) => void;
  remove: (cartKey: string, lineKey: string) => void;
  clear: (cartKey: string) => void;
  /** Moves a draft cart to another key (new order → created order). */
  rename: (from: string, to: string) => void;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Unsent order lines per order context. Survives a page reload (session storage). */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      add: (cartKey, dish, quantity = 1) =>
        set((state) => {
          const lines = state.carts[cartKey] ?? [];
          const existing = lines.find((line) => line.dishId === dish.dishId && !line.comment);
          const next = existing
            ? lines.map((line) =>
                line.key === existing.key ? { ...line, quantity: round3(line.quantity + quantity) } : line,
              )
            : [...lines, { ...dish, key: crypto.randomUUID(), quantity, comment: '' }];
          return { carts: { ...state.carts, [cartKey]: next } };
        }),
      setQuantity: (cartKey, lineKey, quantity) =>
        set((state) => {
          const lines = state.carts[cartKey] ?? [];
          const next =
            quantity <= 0
              ? lines.filter((line) => line.key !== lineKey)
              : lines.map((line) => (line.key === lineKey ? { ...line, quantity: round3(quantity) } : line));
          return { carts: { ...state.carts, [cartKey]: next } };
        }),
      setComment: (cartKey, lineKey, comment) =>
        set((state) => ({
          carts: {
            ...state.carts,
            [cartKey]: (state.carts[cartKey] ?? []).map((line) =>
              line.key === lineKey ? { ...line, comment } : line,
            ),
          },
        })),
      remove: (cartKey, lineKey) =>
        set((state) => ({
          carts: {
            ...state.carts,
            [cartKey]: (state.carts[cartKey] ?? []).filter((line) => line.key !== lineKey),
          },
        })),
      clear: (cartKey) =>
        set((state) => {
          const { [cartKey]: _removed, ...rest } = state.carts;
          return { carts: rest };
        }),
      rename: (from, to) =>
        set((state) => {
          const { [from]: lines, ...rest } = state.carts;
          return lines ? { carts: { ...rest, [to]: lines } } : state;
        }),
    }),
    { name: 'bp-carts', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export const EMPTY_CART: CartLine[] = [];

export const cartKeyForOrder = (orderId: number) => `order:${orderId}`;
export const cartKeyForNew = (type: OrderType, tableId?: number | null) =>
  type === 'TABLE' ? `new:TABLE:${tableId}` : `new:${type}`;
