import {
  BarChart3,
  CalendarClock,
  ChefHat,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Permission } from '@/lib/permissions';

export interface NavLeaf {
  label: string;
  to: string;
  permission: Permission | Permission[];
  /**
   * Query keys carried over when moving between the pages of one section —
   * the shift reports keep the picked shift and its filters.
   */
  keepSearch?: string[];
}

/** Section of the sidebar the link belongs to: "/shifts/reports/orders" → "/shifts/reports". */
const sectionOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/**
 * The link's target, keeping the query the current page carries when both
 * pages belong to the same section.
 */
export function withKeptSearch(leaf: NavLeaf, pathname: string, search: string): string {
  if (!leaf.keepSearch?.length || !search || sectionOf(pathname) !== sectionOf(leaf.to)) return leaf.to;
  const current = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of leaf.keepSearch) {
    const value = current.get(key);
    if (value !== null) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${leaf.to}?${query}` : leaf.to;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: ReactNode;
  to?: string;
  permission?: Permission | Permission[];
  children?: NavLeaf[];
}

/** Sidebar structure — mirrors the reference layout. */
export const NAVIGATION: NavGroup[] = [
  {
    key: 'dashboard',
    label: 'Дашборд',
    icon: <LayoutDashboard />,
    to: '/dashboard',
    permission: Permission.DashboardView,
  },
  {
    key: 'menu',
    label: 'Меню',
    icon: <ChefHat />,
    children: [
      { label: 'Блюда', to: '/menu/dishes', permission: Permission.MenuView },
      { label: 'Категории', to: '/menu/categories', permission: Permission.MenuView },
    ],
  },
  {
    key: 'stock',
    label: 'Склад',
    icon: <Package />,
    children: [
      { label: 'Остаток', to: '/inventory/balance', permission: Permission.StockView },
      { label: 'Приход', to: '/inventory/receipts', permission: Permission.StockView },
      { label: 'Ингредиенты', to: '/inventory/ingredients', permission: Permission.StockView },
      { label: 'История', to: '/inventory/history', permission: Permission.StockView },
    ],
  },
  {
    key: 'reports',
    label: 'Отчет',
    icon: <BarChart3 />,
    children: [
      { label: 'Итоговый', to: '/reports/summary', permission: Permission.ReportsView },
      { label: 'По заказам', to: '/reports/orders', permission: Permission.ReportsView },
      { label: 'По столам', to: '/reports/tables', permission: Permission.ReportsView },
      { label: 'По сотрудникам', to: '/reports/employees', permission: Permission.ReportsView },
      { label: 'По кассирам', to: '/reports/cashiers', permission: Permission.ReportsView },
      { label: 'По сменам', to: '/reports/shifts', permission: Permission.ReportsView },
      { label: 'По блюдам', to: '/reports/dishes', permission: Permission.ReportsView },
      { label: 'По категориям', to: '/reports/categories', permission: Permission.ReportsView },
      { label: 'По отменам', to: '/reports/cancellations', permission: Permission.ReportsView },
    ],
  },
  {
    key: 'shifts',
    label: 'Отчёт по сменам',
    icon: <CalendarClock />,
    children: [
      { label: 'Смены', to: '/shifts', permission: Permission.ShiftsView },
      {
        label: 'Итоговый',
        to: '/shifts/reports/summary',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По заказам',
        to: '/shifts/reports/orders',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По столам',
        to: '/shifts/reports/tables',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По сотрудникам',
        to: '/shifts/reports/employees',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По блюдам',
        to: '/shifts/reports/dishes',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По категориям',
        to: '/shifts/reports/categories',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
      {
        label: 'По отменам',
        to: '/shifts/reports/cancellations',
        permission: Permission.ReportsView,
        keepSearch: ['shift', 'from', 'to', 'cashier', 'time'],
      },
    ],
  },
  {
    key: 'team',
    label: 'Команда',
    icon: <Users />,
    children: [
      { label: 'Сотрудники', to: '/team/employees', permission: Permission.TeamView },
      { label: 'Роли', to: '/team/roles', permission: Permission.TeamView },
      { label: 'История входа', to: '/team/login-history', permission: Permission.TeamView },
    ],
  },
  {
    key: 'halls',
    label: 'Столы и залы',
    icon: <MapPin />,
    children: [
      { label: 'Залы', to: '/halls/halls', permission: Permission.HallsManage },
      { label: 'Столы', to: '/halls/tables', permission: Permission.HallsManage },
    ],
  },
  {
    key: 'settings',
    label: 'Настройки',
    icon: <Settings />,
    children: [
      { label: 'Общие', to: '/settings/general', permission: Permission.SettingsManage },
      { label: 'Способ оплаты', to: '/settings/payment-methods', permission: Permission.SettingsManage },
      { label: 'Настройка принтеров', to: '/settings/printers', permission: Permission.SettingsManage },
      { label: 'Чек стола', to: '/settings/order-check', permission: Permission.SettingsManage },
      { label: 'Чек блюда', to: '/settings/dish-check', permission: Permission.SettingsManage },
    ],
  },
];
