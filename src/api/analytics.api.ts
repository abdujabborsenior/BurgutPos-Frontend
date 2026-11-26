import { download, get } from './http';
import type {
  CancellationsReport,
  CashiersReport,
  CategoriesReport,
  CategoryDishesReport,
  DishesReport,
  DishHistoryReport,
  EmployeeOrdersReport,
  EmployeesReport,
  OrdersReport,
  ShiftsReport,
  SummaryReport,
  TablesReport,
} from './report-types';
import type {
  DashboardRevenue,
  DashboardSummary,
  DashboardWaiters,
  OrderDetail,
  OrderStatus,
  OrderType,
  Paginated,
  TopDish,
} from './types';

export const dashboardApi = {
  summary: (date?: string) => get<DashboardSummary>('/dashboard/summary', { date }),
  revenue: (days: number, date?: string) =>
    get<DashboardRevenue>('/dashboard/revenue', { days, date }),
  topDishes: (page: number, limit = 10, date?: string) =>
    get<Paginated<TopDish>>('/dashboard/top-dishes', { page, limit, date }),
  waiters: (date?: string) => get<DashboardWaiters>('/dashboard/waiters', { date }),
};

/**
 * What a report covers: a period ("YYYY-MM-DD" or local "YYYY-MM-DDTHH:mm";
 * `to` includes its last minute) or one shift — then the dates are ignored.
 */
export interface RangeParams {
  from?: string;
  to?: string;
  shiftId?: number;
}

export interface ShiftsReportParams extends RangeParams {
  /** Which moment of the shift the period applies to. */
  dateField?: 'opened' | 'closed' | 'overlap';
  cashierId?: number;
}

export interface PagedRangeParams extends RangeParams {
  page?: number;
  limit?: number;
}

export const ORDER_REPORT_SORT = [
  'id',
  'number',
  'createdAt',
  'closedAt',
  'waiter',
  'closedBy',
  'shift',
  'items',
  'total',
] as const;
export type OrderReportSort = (typeof ORDER_REPORT_SORT)[number];

export interface OrdersReportParams extends PagedRangeParams {
  dateField?: 'createdAt' | 'closedAt';
  status?: OrderStatus;
  type?: OrderType;
  tableId?: number;
  waiterId?: number;
  methodId?: number;
  search?: string;
  sortBy?: OrderReportSort;
  sortOrder?: 'ASC' | 'DESC';
}

export const DISH_REPORT_SORT = [
  'quantity',
  'revenue',
  'profit',
  'name',
  'pending',
  'cancelled',
] as const;
export type DishReportSort = (typeof DISH_REPORT_SORT)[number];

export interface DishesReportParams extends PagedRangeParams {
  categoryId?: number;
  search?: string;
  sortBy?: DishReportSort;
  sortOrder?: 'ASC' | 'DESC';
}

export const CANCELLATION_SORT = [
  'cancelledAt',
  'orderNumber',
  'name',
  'quantity',
  'price',
  'amount',
] as const;
export type CancellationSort = (typeof CANCELLATION_SORT)[number];

export interface CancellationsReportParams extends PagedRangeParams {
  scope?: 'all' | 'items' | 'orders';
  userId?: number;
  waiterId?: number;
  sortBy?: CancellationSort;
  sortOrder?: 'ASC' | 'DESC';
}

export type ReportKind =
  | 'summary'
  | 'orders'
  | 'tables'
  | 'employees'
  | 'cashiers'
  | 'shifts'
  | 'dishes'
  | 'categories'
  | 'cancellations';

export const reportsApi = {
  summary: (params: RangeParams) => get<SummaryReport>('/reports/summary', params),
  orders: (params: OrdersReportParams) => get<OrdersReport>('/reports/orders', params),
  tables: (params: RangeParams & { hallId?: number }) =>
    get<TablesReport>('/reports/tables', params),
  employees: (params: RangeParams) => get<EmployeesReport>('/reports/employees', params),
  /** Bills of one employee row; `waiter` is the id or `none` («Без официанта»). */
  employeeOrders: (params: RangeParams & { waiter: string; page: number; limit: number }) =>
    get<EmployeeOrdersReport>('/reports/employees/orders', params),
  /** Every line of one dish row; pass the report's `categoryId` so it adds up. */
  dishHistory: (
    params: RangeParams & { dishId: number; categoryId?: number; page: number; limit: number },
  ) => get<DishHistoryReport>('/reports/dishes/history', params),
  cashiers: (params: RangeParams) => get<CashiersReport>('/reports/cashiers', params),
  shifts: (params: ShiftsReportParams) => get<ShiftsReport>('/reports/shifts', params),
  dishes: (params: DishesReportParams) => get<DishesReport>('/reports/dishes', params),
  categories: (params: RangeParams) => get<CategoriesReport>('/reports/categories', params),
  /** Dishes of one category (drill-down) or of every category (printed sheet). */
  categoryDishes: (params: RangeParams & { categoryId?: number }) =>
    get<CategoryDishesReport>('/reports/categories/dishes', params),
  cancellations: (params: CancellationsReportParams) =>
    get<CancellationsReport>('/reports/cancellations', params),
  /** Full order for printing its receipt from a report (no POS access needed). */
  order: (id: number) => get<OrderDetail>(`/reports/orders/${id}`),
  /** Downloads the XLSX version of a report with the same filters. */
  export: (kind: ReportKind, params: object) =>
    download(
      `/reports/${kind}/export`,
      { ...params, page: undefined, limit: undefined },
      `${kind}.xlsx`,
    ),
};
