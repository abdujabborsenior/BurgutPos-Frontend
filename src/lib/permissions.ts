/** Mirrors the API permission keys (server is the source of truth). */
export const Permission = {
  DashboardView: 'dashboard.view',
  PosAccess: 'pos.access',
  OrdersCreate: 'orders.create',
  OrdersServe: 'orders.serve',
  OrdersManageAll: 'orders.manage_all',
  OrdersCancelItems: 'orders.cancel_items',
  OrdersCancel: 'orders.cancel',
  OrdersTransfer: 'orders.transfer',
  OrdersDiscount: 'orders.discount',
  OrdersPay: 'orders.pay',
  OrdersReopen: 'orders.reopen',
  ShiftsView: 'shifts.view',
  ShiftsManage: 'shifts.manage',
  MenuView: 'menu.view',
  MenuManage: 'menu.manage',
  StockView: 'stock.view',
  StockManage: 'stock.manage',
  ReportsView: 'reports.view',
  TeamView: 'team.view',
  TeamManage: 'team.manage',
  HallsManage: 'halls.manage',
  SettingsManage: 'settings.manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
