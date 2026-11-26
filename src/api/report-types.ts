import type {
  DishUnit,
  OrderStatus,
  OrderType,
  Paginated,
  PaymentMethodType,
  ShiftStatus,
} from './types';

/** Which shift a shift-scoped report covers. */
export interface ReportShift {
  id: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
}

/**
 * What the report covers, echoed back: local wall-clock minutes
 * ("2026-11-11T00:00" … "T23:59") and, in shift mode, the shift itself.
 */
export interface ReportRange {
  from: string;
  to: string;
  shift: ReportShift | null;
}

/** Rates shown in column titles ("Без 10%", "Доля 6%"). */
export interface ReportRates {
  service: number;
  waiter: number;
}

export interface MethodAmount {
  methodId: number;
  name: string;
  type: PaymentMethodType;
  amount: number;
}

/** Money columns of the cash reports. */
export interface KindAmounts {
  cash: number;
  card: number;
  transfer: number;
  other: number;
}

// ─────────────────────────────── Summary ───────────────────────────────

export interface SummaryReport extends ReportRange {
  percent: ReportRates;
  paymentMethods: (MethodAmount & { ordersCount: number })[];
  totals: {
    collected: number;
    pending: { count: number; amount: number };
    ordersCount: number;
    revenue: number;
    subtotal: number;
    discounts: number;
    service: number;
    deliveryFees: number;
    guests: number;
    waiterBase: number;
    waiterCommission: number;
    itemsQuantity: number;
    itemsCost: number;
    averageCheck: number;
    netSales: number;
    grossProfit: number;
    cancelledOrders: { count: number; amount: number };
    cancelledItems: { count: number; quantity: number; amount: number };
  };
  byType: { type: OrderType; count: number; amount: number }[];
  topDishes: { dishId: number; name: string; unit: DishUnit; quantity: number; revenue: number }[];
  waiters: { userId: number | null; fullName: string | null; ordersCount: number; share: number }[];
}

// ─────────────────────────────── Orders ───────────────────────────────

export interface OrderReportRow {
  position: number;
  id: number;
  number: number;
  businessDate: string;
  type: OrderType;
  status: OrderStatus;
  table: { name: string; hallName: string | null } | null;
  createdAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  shiftId: number;
  waiter: { id: number; fullName: string } | null;
  closedBy: string | null;
  cancelledBy: string | null;
  customerName: string | null;
  customerPhone: string | null;
  guests: number | null;
  itemsCount: number;
  subtotal: number;
  discountAmount: number;
  serviceAmount: number;
  deliveryFee: number;
  total: number;
  reopenCount: number;
  payments: MethodAmount[];
}

export interface OrdersReport extends ReportRange, Paginated<OrderReportRow> {
  dateField: 'createdAt' | 'closedAt';
  totals: {
    count: number;
    paidCount: number;
    openCount: number;
    cancelledCount: number;
    revenue: number;
    pending: number;
    cancelledAmount: number;
    itemsCount: number;
  };
  paymentMethods: MethodAmount[];
}

// ─────────────────────────────── Tables ───────────────────────────────

export interface TableReportRow {
  tableId: number;
  tableName: string;
  hallId: number;
  hallName: string;
  ordersCount: number;
  revenue: number;
  guests: number;
  averageCheck: number;
  averageMinutes: number;
  pendingCount: number;
  pending: number;
  share: number;
}

export interface TablesReport extends ReportRange {
  items: TableReportRow[];
  totals: {
    tablesCount: number;
    ordersCount: number;
    revenue: number;
    guests: number;
    averageCheck: number;
    pendingCount: number;
    pending: number;
  };
}

// ────────────────────────────── Employees ──────────────────────────────

export interface WaiterFigures {
  ordersCount: number;
  revenue: number;
  /** Revenue without the service charge. */
  net: number;
  /** Dine-in sales without the service charge — the base of the share. */
  base: number;
  /** Service charge collected. */
  service: number;
  /** Waiter's share. */
  share: number;
}

export interface EmployeeReportRow extends WaiterFigures {
  userId: number | null;
  fullName: string | null;
  roleName: string | null;
  pending: WaiterFigures;
}

export interface EmployeesReport extends ReportRange {
  percent: ReportRates;
  items: EmployeeReportRow[];
  totals: WaiterFigures & { pending: WaiterFigures };
}

/** Where an order was served: its table (with the hall) or just its type. */
export interface ReportTablePlace {
  name: string;
  hallName: string | null;
}

export interface EmployeeBillLine {
  id: number;
  name: string;
  unit: DishUnit;
  quantity: number;
  price: number;
  total: number;
}

/** One bill behind a row of «По сотрудникам» (opened by clicking the row). */
export interface EmployeeBill {
  id: number;
  number: number;
  type: OrderType;
  status: OrderStatus;
  table: ReportTablePlace | null;
  guests: number | null;
  /** When it counts in the report: paid at closing, pending at opening. */
  at: string;
  subtotal: number;
  discountAmount: number;
  servicePercent: number;
  serviceAmount: number;
  deliveryFee: number;
  total: number;
  lines: EmployeeBillLine[];
}

export interface EmployeeOrdersReport extends ReportRange, Paginated<EmployeeBill> {
  totals: { ordersCount: number; revenue: number; pendingCount: number; pending: number };
}

// ────────────────────────────── Cashiers ──────────────────────────────

export interface CashierReportRow extends KindAmounts {
  cashierId: number;
  fullName: string;
  paymentsCount: number;
  revenue: number;
}

export interface CashiersReport extends ReportRange {
  items: CashierReportRow[];
  totals: KindAmounts & { paymentsCount: number; revenue: number };
}

// ─────────────────────────────── Shifts ───────────────────────────────

export interface ShiftReportRow extends KindAmounts {
  id: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  openingCash: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  paymentsCount: number;
  ordersCount: number;
  revenue: number;
  pendingCount: number;
  pending: number;
}

export interface ShiftsReport extends ReportRange {
  items: ShiftReportRow[];
  totals: KindAmounts & {
    paymentsCount: number;
    ordersCount: number;
    revenue: number;
    pending: number;
    pendingCount: number;
  };
}

// ─────────────────────────────── Dishes ───────────────────────────────

export interface DishReportRow {
  position: number;
  dishId: number;
  name: string;
  categoryName: string | null;
  unit: DishUnit;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  averagePrice: number;
  share: number;
  pendingQuantity: number;
  pendingRevenue: number;
  cancelledQuantity: number;
  cancelledAmount: number;
}

export interface DishesReport extends ReportRange, Paginated<DishReportRow> {
  totals: {
    dishesCount: number;
    soldDishes: number;
    pendingDishes: number;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    pendingQuantity: number;
    pendingRevenue: number;
    cancelledQuantity: number;
    cancelledAmount: number;
  };
}

/** One line of a dish behind its row in «По блюдам» (opened by clicking the row). */
export interface DishHistoryLine {
  id: number;
  kind: 'paid' | 'pending' | 'cancelled';
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  orderId: number;
  orderNumber: number;
  orderType: OrderType;
  table: ReportTablePlace | null;
  addedBy: string | null;
  waiter: string | null;
  unit: DishUnit;
  quantity: number;
  total: number;
}

export interface DishHistoryReport extends ReportRange, Paginated<DishHistoryLine> {
  totals: {
    quantity: number;
    revenue: number;
    pendingQuantity: number;
    pendingRevenue: number;
    cancelledQuantity: number;
    cancelledAmount: number;
  };
}

// ───────────────────────────── Categories ─────────────────────────────

export interface CategoryReportRow {
  categoryId: number | null;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  pendingQuantity: number;
  pendingRevenue: number;
  dishesCount: number;
  share: number;
}

export interface CategoriesReport extends ReportRange {
  items: CategoryReportRow[];
  totals: {
    categoriesCount: number;
    quantity: number;
    revenue: number;
    cost: number;
    pendingQuantity: number;
    pendingRevenue: number;
  };
}

export interface CategoryDishesGroup {
  categoryId: number | null;
  name: string;
  quantity: number;
  revenue: number;
  pendingQuantity: number;
  pendingRevenue: number;
  dishes: {
    dishId: number;
    name: string;
    unit: DishUnit;
    quantity: number;
    revenue: number;
    pendingQuantity: number;
    pendingRevenue: number;
  }[];
}

export interface CategoryDishesReport extends ReportRange {
  categories: CategoryDishesGroup[];
  totals: { quantity: number; revenue: number; pendingRevenue: number };
}

// ──────────────────────────── Cancellations ────────────────────────────

export interface CancellationRow {
  position: number;
  id: number;
  cancelledAt: string;
  name: string;
  quantity: number;
  unit: DishUnit;
  price: number;
  amount: number;
  reason: string | null;
  stockReturned: boolean | null;
  orderId: number;
  orderNumber: number;
  orderDate: string;
  orderType: OrderType;
  orderCancelled: boolean;
  tableName: string | null;
  cancelledBy: string | null;
  waiter: string | null;
}

export interface CancellationsReport extends ReportRange, Paginated<CancellationRow> {
  totals: { lines: number; quantity: number; amount: number; orders: number };
}
