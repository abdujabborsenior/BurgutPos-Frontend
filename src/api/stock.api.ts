import { del, get, patch, post } from './http';
import type {
  ArchiveStatus,
  BalanceRow,
  IngredientOption,
  IngredientUnit,
  IngredientView,
  ListParams,
  MovementView,
  Paginated,
  ReceiptView,
  StockAdjustMode,
  StockItemType,
  StockLocation,
  StockMovementType,
} from './types';

export interface BalanceParams extends ListParams {
  categoryId?: number;
  tracked?: boolean;
}

export interface DishStockView {
  id: number;
  name: string;
  unit: string;
  trackStock: boolean;
  saleQty: number;
  warehouseQty: number;
  totalQty: number;
}

export interface ReceiptListParams extends ListParams {
  archived?: boolean;
  itemType?: StockItemType;
  dishId?: number;
  ingredientId?: number;
  from?: string;
  to?: string;
}

export interface ReceiptLineInput {
  itemType: StockItemType;
  dishId?: number;
  ingredientId?: number;
  location?: StockLocation;
  quantity: number;
  purchasePrice: number;
  salePrice?: number | null;
  comment?: string;
}

export interface MovementListParams extends ListParams {
  itemType?: StockItemType;
  dishId?: number;
  ingredientId?: number;
  type?: StockMovementType;
  location?: StockLocation;
  userId?: number;
  orderId?: number;
  from?: string;
  to?: string;
}

export interface IngredientListParams extends ListParams {
  status?: ArchiveStatus;
  lowStock?: boolean;
}

export interface IngredientInput {
  name: string;
  unit: IngredientUnit;
  quantity?: number;
  minQuantity?: number;
  costPrice?: number;
}

export const stockApi = {
  balance: (params: BalanceParams) => get<Paginated<BalanceRow>>('/stock/balance', params),
  setTracking: (dishId: number, trackStock: boolean) =>
    patch<DishStockView>(`/stock/dishes/${dishId}/tracking`, { trackStock }),
  transfer: (dishId: number, input: { from: StockLocation; quantity: number; comment?: string }) =>
    post<DishStockView>(`/stock/dishes/${dishId}/transfer`, input),
  writeOffDish: (dishId: number, input: { location: StockLocation; quantity: number; reason: string }) =>
    post<DishStockView>(`/stock/dishes/${dishId}/write-off`, input),
  /** A quantity left out is not touched; `mode` defaults to «Заменить» on the server. */
  adjustDish: (
    dishId: number,
    input: {
      mode?: StockAdjustMode;
      saleQty?: number;
      warehouseQty?: number;
      comment?: string;
    },
  ) => post<DishStockView>(`/stock/dishes/${dishId}/adjust`, input),
  writeOffIngredient: (id: number, input: { quantity: number; reason: string }) =>
    post<void>(`/stock/ingredients/${id}/write-off`, input),
  adjustIngredient: (id: number, input: { quantity: number; comment?: string }) =>
    post<void>(`/stock/ingredients/${id}/adjust`, input),
  receipts: (params: ReceiptListParams) =>
    get<Paginated<ReceiptView> & { summary: { count: number; totalSum: number } }>(
      '/stock/receipts',
      params,
    ),
  createReceipts: (items: ReceiptLineInput[], comment?: string) =>
    post<{ created: number; ids: number[] }>('/stock/receipts', { items, comment }),
  archiveReceipt: (id: number, reason?: string) =>
    post<ReceiptView>(`/stock/receipts/${id}/archive`, { reason }),
  movements: (params: MovementListParams) => get<Paginated<MovementView>>('/stock/movements', params),
};

export const ingredientsApi = {
  list: (params: IngredientListParams) =>
    get<Paginated<IngredientView> & { counts: { active: number; archived: number; lowStock: number } }>(
      '/ingredients',
      params,
    ),
  options: () => get<IngredientOption[]>('/ingredients/options'),
  create: (input: IngredientInput) => post<IngredientView>('/ingredients', input),
  update: (id: number, input: Partial<Omit<IngredientInput, 'quantity'>>) =>
    patch<IngredientView>(`/ingredients/${id}`, input),
  archive: (id: number) => post<void>(`/ingredients/${id}/archive`),
  restore: (id: number) => post<void>(`/ingredients/${id}/restore`),
  remove: (id: number) => del(`/ingredients/${id}`),
};
