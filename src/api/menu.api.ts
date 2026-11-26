import { del, get, http, patch, post } from './http';
import type {
  ArchiveStatus,
  CategoryView,
  DishDetail,
  DishUnit,
  DishView,
  ListParams,
  Option,
  Paginated,
  PosMenuCategory,
  StatusCounts,
} from './types';

export interface CategoryListParams extends ListParams {
  status?: ArchiveStatus;
}

export interface DishListParams extends ListParams {
  status?: ArchiveStatus;
  categoryId?: number;
  printerId?: number;
  isAvailable?: boolean;
}

export interface DishInput {
  name: string;
  categoryId: number;
  printerId?: number | null;
  price: number;
  unit?: DishUnit;
  sortOrder?: number;
  isAvailable?: boolean;
  trackStock?: boolean;
  ingredients?: { ingredientId: number; quantity: number }[];
}

export const categoriesApi = {
  list: (params: CategoryListParams) =>
    get<Paginated<CategoryView> & { counts: StatusCounts }>('/dish-categories', params),
  options: () => get<Option[]>('/dish-categories/options'),
  create: (input: { name: string; sortOrder?: number }) => post<CategoryView>('/dish-categories', input),
  update: (id: number, input: { name?: string; sortOrder?: number }) =>
    patch<CategoryView>(`/dish-categories/${id}`, input),
  archive: (id: number) => post<void>(`/dish-categories/${id}/archive`),
  restore: (id: number) => post<void>(`/dish-categories/${id}/restore`),
  remove: (id: number) => del(`/dish-categories/${id}`),
};

export interface DishOption {
  id: number;
  name: string;
  unit: DishUnit;
  price: number;
  costPrice: number;
  categoryId: number;
  categoryName: string;
  trackStock: boolean;
  saleQty: number;
  warehouseQty: number;
}

export const dishesApi = {
  options: () => get<DishOption[]>('/dishes/options'),
  list: (params: DishListParams) => get<Paginated<DishView> & { counts: StatusCounts }>('/dishes', params),
  get: (id: number) => get<DishDetail>(`/dishes/${id}`),
  posMenu: () => get<PosMenuCategory[]>('/dishes/pos-menu'),
  create: (input: DishInput) => post<DishDetail>('/dishes', input),
  update: (id: number, input: Partial<DishInput>) => patch<DishDetail>(`/dishes/${id}`, input),
  setAvailability: (id: number, isAvailable: boolean) =>
    patch<DishDetail>(`/dishes/${id}/availability`, { isAvailable }),
  archive: (id: number) => post<void>(`/dishes/${id}/archive`),
  restore: (id: number) => post<void>(`/dishes/${id}/restore`),
  remove: (id: number) => del(`/dishes/${id}`),
  uploadImage: async (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await http.post<DishDetail>(`/dishes/${id}/image`, form, { timeout: 60_000 });
    return data;
  },
  removeImage: (id: number) => del<DishDetail>(`/dishes/${id}/image`),
};
