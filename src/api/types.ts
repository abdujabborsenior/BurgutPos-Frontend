import type { Permission } from '@/lib/permissions';
import type { ReceiptLayout } from '@/lib/receipt/layout';

// ─────────────────────────────── Common ───────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StatusCounts {
  active: number;
  archived: number;
}

export interface UserRef {
  id: number;
  fullName: string;
}

export type ArchiveStatus = 'active' | 'archived' | 'all';
export type SortOrder = 'ASC' | 'DESC';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: string[];
  code?: string;
}

// ─────────────────────────────── Enums ───────────────────────────────

export type OrderType = 'TABLE' | 'TAKEAWAY' | 'DELIVERY' | 'HALL';
export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED' | 'MERGED';
export type OrderItemStatus = 'ACTIVE' | 'CANCELLED';
export type DiscountType = 'PERCENT' | 'AMOUNT';
export type DishUnit = 'PCS' | 'PORTION' | 'KG' | 'L';
export type IngredientUnit = 'KG' | 'G' | 'L' | 'ML' | 'PCS';
export type PaymentMethodType = 'CASH' | 'CARD' | 'ONLINE' | 'OTHER';
export type StockItemType = 'DISH' | 'INGREDIENT';
export type StockLocation = 'SALE' | 'WAREHOUSE';
/** «Заменить» / «Добавить» / «Убрать» in the stock windows. */
export type StockAdjustMode = 'set' | 'add' | 'remove';
export type StockMovementType =
  'RECEIPT' | 'RECEIPT_CANCEL' | 'SALE' | 'SALE_RETURN' | 'TRANSFER' | 'WRITE_OFF' | 'ADJUSTMENT';
export type ShiftStatus = 'OPEN' | 'CLOSED';

/** A line of the login log. */
export type LoginEventType = 'IN' | 'OUT';
export type CashOperationType = 'IN' | 'OUT';

// ─────────────────────────────── Auth & team ───────────────────────────────

export interface Profile {
  id: number;
  fullName: string;
  login: string;
  isSuperadmin: boolean;
  role: { id: number; name: string } | null;
  permissions: Permission[];
}

export interface AuthResponse {
  accessToken: string;
  user: Profile;
}

export interface UserView {
  id: number;
  fullName: string;
  login: string;
  phone: string | null;
  /** `permissionsCount` is what the role grants, implied permissions included. */
  role: { id: number; name: string; permissionsCount: number } | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy?: UserRef | null;
  updatedAt: string;
}

/** What the login log shows: who signed in or out, when and from what. */
export interface LoginEventView {
  id: number;
  type: LoginEventType;
  createdAt: string;
  user: { id: number; fullName: string; login: string } | null;
  /** "Android · Chrome"; "—" when the device could not be told. */
  device: string;
  userAgent: string | null;
  ip: string | null;
}

export interface UserOption {
  id: number;
  fullName: string;
  roleName: string | null;
}

export interface RoleView {
  id: number;
  name: string;
  description: string | null;
  permissions: Permission[];
  usersCount: number;
  createdAt: string;
  createdBy: UserRef | null;
  updatedAt: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: { key: Permission; label: string; description: string }[];
}

export interface PresenceUser {
  id: number;
  fullName: string;
  roleName: string | null;
  connectedAt: string;
  /** Address of the device the person is working at (null behind an unknown proxy). */
  ip: string | null;
  devices: number;
}

// ─────────────────────────────── Halls & tables ───────────────────────────────

export interface HallView {
  id: number;
  name: string;
  /** Service charge of the hall; null means "as in the settings". */
  servicePercent: number | null;
  sortOrder: number;
  isActive: boolean;
  tablesCount: number;
  openOrdersCount: number;
  createdAt: string;
  createdBy: UserRef | null;
}

export interface TableView {
  id: number;
  name: string;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
  hall: { id: number; name: string; isActive: boolean };
  createdAt: string;
  createdBy: UserRef | null;
}

export interface Option {
  id: number;
  name: string;
}

export interface TableOption {
  id: number;
  name: string;
  hallId: number;
  hallName: string;
}

// ─────────────────────────────── Settings & catalogs ───────────────────────────────

/** How a printer is reached from the venue's print server. */
export type PrinterConnection = 'LAN' | 'USB';

export interface PrinterView {
  id: number;
  name: string;
  description: string | null;
  connection: PrinterConnection;
  /** Address of a network printer; null for a USB one. */
  host: string | null;
  port: number | null;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  dishesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodView {
  id: number;
  name: string;
  type: PaymentMethodType;
  sortOrder: number;
  isActive: boolean;
  paymentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodOption {
  id: number;
  name: string;
  type: PaymentMethodType;
}

export interface Settings {
  restaurantName: string;
  address: string | null;
  phone: string | null;
  /** Logo printed on the guest bill. */
  logoUrl: string | null;
  /** What the guest bill and the kitchen ticket show, and how. */
  orderCheck: ReceiptLayout;
  dishCheck: ReceiptLayout;
  receiptHeader: string | null;
  receiptFooter: string | null;
  serviceChargePercent: number;
  serviceChargeOrderTypes: OrderType[];
  waiterCommissionPercent: number;
  allowNegativeStock: boolean;
  autoPrintKitchenTicket: boolean;
  autoPrintReceipt: boolean;
  updatedAt: string;
}

/** Printed documents the designer configures. */
export type {
  ReceiptKind,
  ReceiptLayout,
  ReceiptLineSpec,
  ReceiptLineStyle,
} from '@/lib/receipt/layout';

// ─────────────────────────────── Menu ───────────────────────────────

export interface CategoryView {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  dishesCount: number;
  createdAt: string;
  createdBy: UserRef | null;
}

export interface DishView {
  id: number;
  name: string;
  category: { id: number; name: string; isActive: boolean };
  printer: { id: number; name: string } | null;
  price: number;
  costPrice: number;
  unit: DishUnit;
  sortOrder: number;
  isAvailable: boolean;
  trackStock: boolean;
  saleQty: number;
  warehouseQty: number;
  imageUrl: string | null;
  isActive: boolean;
  ingredientsCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef | null;
}

export interface RecipeLine {
  ingredientId: number;
  name: string;
  unit: IngredientUnit;
  isActive: boolean;
  quantity: number;
  costPrice: number;
}

export interface DishDetail extends DishView {
  ingredients: RecipeLine[];
  recipeCost: number;
}

export interface PosDish {
  id: number;
  name: string;
  price: number;
  unit: DishUnit;
  imageUrl: string | null;
  isAvailable: boolean;
  trackStock: boolean;
  saleQty: number;
}

export interface PosMenuCategory {
  id: number;
  name: string;
  dishes: PosDish[];
}

// ─────────────────────────────── Stock ───────────────────────────────

export interface IngredientView {
  id: number;
  name: string;
  unit: IngredientUnit;
  quantity: number;
  minQuantity: number;
  costPrice: number;
  isLow: boolean;
  isActive: boolean;
  dishesCount: number;
  createdAt: string;
  createdBy: UserRef | null;
}

export interface IngredientOption {
  id: number;
  name: string;
  unit: IngredientUnit;
  costPrice: number;
}

export interface BalanceRow {
  id: number;
  name: string;
  unit: DishUnit;
  category: { id: number; name: string };
  trackStock: boolean;
  isAvailable: boolean;
  saleQty: number;
  warehouseQty: number;
  totalQty: number;
}

export interface StockItemRef {
  id: number;
  name: string;
  unit: DishUnit | IngredientUnit;
}

export interface ReceiptView {
  id: number;
  itemType: StockItemType;
  item: StockItemRef | null;
  location: StockLocation | null;
  quantity: number;
  purchasePrice: number;
  salePrice: number | null;
  total: number;
  comment: string | null;
  createdAt: string;
  createdBy: UserRef | null;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: UserRef | null;
  archiveReason: string | null;
}

export interface MovementView {
  id: string;
  createdAt: string;
  itemType: StockItemType;
  item: StockItemRef | null;
  type: StockMovementType;
  location: StockLocation | null;
  quantity: number;
  balanceAfter: number;
  orderId: number | null;
  /** Daily number of that order (#412). */
  orderNumber: number | null;
  receiptId: number | null;
  comment: string | null;
  createdBy: UserRef | null;
}

// ─────────────────────────────── Shifts ───────────────────────────────

export interface ShiftStatusView {
  id: number;
  openedAt: string;
  openedBy: UserRef | null;
}

export interface MethodAmount {
  methodId: number;
  name: string;
  type: PaymentMethodType;
  amount: number;
}

export interface ShiftDetail {
  id: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: UserRef | null;
  closedBy: UserRef | null;
  openComment: string | null;
  closeComment: string | null;
  summary: {
    ordersCount: number;
    revenue: number;
    averageCheck: number;
    guests: number;
    discounts: number;
    service: number;
    deliveryFees: number;
    openOrders: { count: number; total: number };
    cancelledOrders: { count: number; total: number };
    payments: MethodAmount[];
    byType: { type: OrderType; count: number; total: number }[];
  };
  cash: {
    opening: number;
    payments: number;
    in: number;
    out: number;
    expected: number;
    counted: number | null;
    difference: number | null;
  };
  cashOperations: {
    id: number;
    type: CashOperationType;
    amount: number;
    comment: string;
    createdAt: string;
    createdBy: UserRef | null;
  }[];
}

export interface ShiftListRow {
  id: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: UserRef | null;
  closedBy: UserRef | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  revenue: number;
  ordersCount: number;
}

// ─────────────────────────────── Orders ───────────────────────────────

export interface BoardOrder {
  id: number;
  /** Daily order number shown to people (#412). */
  number: number;
  createdAt: string;
  total: number;
  guests: number | null;
  itemsCount: number;
  precheckAt: string | null;
  /** How many times the bill was printed for this order. */
  precheckCount: number;
  waiter: UserRef | null;
}

export interface BoardTable {
  id: number;
  name: string;
  seats: number | null;
  order: BoardOrder | null;
}

export interface BoardHall {
  id: number;
  name: string;
  tables: BoardTable[];
}

export type Counters = Record<OrderType, number>;

export interface OrderListItem {
  id: number;
  /** Daily order number shown to people (#412); restarts every business day. */
  number: number;
  /** Business day (YYYY-MM-DD) the number belongs to. */
  businessDate: string;
  shiftId: number;
  type: OrderType;
  status: OrderStatus;
  table: { id: number; name: string; hall: { id: number; name: string } | null } | null;
  waiter: UserRef | null;
  createdBy: UserRef | null;
  closedBy: UserRef | null;
  guests: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  comment: string | null;
  subtotal: number;
  discountAmount: number;
  serviceAmount: number;
  deliveryFee: number;
  total: number;
  itemsCount: number;
  precheckAt: string | null;
  /** How many times the bill was printed for this order. */
  precheckCount: number;
  /** How many times the paid order was returned to work. */
  reopenCount: number;
  createdAt: string;
  closedAt: string | null;
}

export interface OrderItemView {
  id: number;
  dishId: number;
  name: string;
  categoryName: string | null;
  printerId: number | null;
  printerName: string | null;
  unit: DishUnit;
  price: number;
  quantity: number;
  total: number;
  comment: string | null;
  status: OrderItemStatus;
  createdAt: string;
  createdBy: UserRef | null;
  cancelledAt: string | null;
  cancelledBy: UserRef | null;
  cancelReason: string | null;
  stockReturned: boolean | null;
}

export interface PaymentView {
  id: number;
  method: PaymentMethodOption;
  /** Negative for a storno row written when the paid order was returned to work. */
  amount: number;
  isReversal: boolean;
  createdAt: string;
  cashier: UserRef | null;
}

/** PRECHECK — the bill before payment, RECEIPT — the receipt after it. */
export type OrderPrintKind = 'PRECHECK' | 'RECEIPT';

/** One line of the order's print history ("История печати чеков"). */
export interface OrderPrintView {
  id: number;
  kind: OrderPrintKind;
  /** Copied when printed, so it survives renaming the printer. */
  printerName: string | null;
  printedBy: UserRef | null;
  createdAt: string;
}

export interface OrderDetail extends OrderListItem {
  discountType: DiscountType | null;
  discountValue: number;
  servicePercent: number;
  paidAmount: number;
  receivedAmount: number;
  changeAmount: number;
  cancelledAt: string | null;
  cancelledBy: UserRef | null;
  cancelReason: string | null;
  mergedIntoId: number | null;
  reopenedAt: string | null;
  reopenedBy: UserRef | null;
  reopenReason: string | null;
  updatedAt: string;
  items: OrderItemView[];
  payments: PaymentView[];
  prints: OrderPrintView[];
}

export interface OrderMutationResult {
  order: OrderDetail;
  addedItemIds: number[];
}

export interface OrderLineInput {
  dishId: number;
  quantity: number;
  comment?: string;
}

// ─────────────────────────────── Dashboard ───────────────────────────────

export interface DashboardSummary {
  date: string;
  paymentMethods: { id: number; name: string; type: PaymentMethodType; amount: number }[];
  total: number;
  pending: { count: number; total: number };
  ordersCount: number;
  averageCheck: number;
  guests: number;
  cancelled: { count: number; total: number };
}

export interface DashboardRevenue {
  from: string;
  to: string;
  days: number;
  total: number;
  items: { date: string; amount: number; orders: number }[];
}

export interface TopDish {
  position: number;
  dishId: number;
  name: string;
  quantity: number;
  amount: number;
}

export interface DashboardWaiters {
  date: string;
  percent: number;
  totalCommission: number;
  items: {
    userId: number;
    fullName: string;
    ordersCount: number;
    sales: number;
    revenue: number;
    commission: number;
  }[];
}
