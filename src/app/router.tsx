import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/components/feedback/StatusPages';
import { AppLayout } from '@/components/layout/AppLayout';
import { NAVIGATION } from '@/components/layout/navigation';
import { Logo } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/ui';
import LoginPage from '@/features/auth/LoginPage';
import { ReportModeProvider } from '@/features/reports/scope/ReportScope';
import { Permission } from '@/lib/permissions';
import { hasPermission, useAuthStore } from '@/stores/auth.store';

const page = (loader: () => Promise<{ default: React.ComponentType }>) => lazy(loader);

const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'));
const TablesBoardPage = page(() => import('@/features/pos/TablesBoardPage'));
const ChannelOrdersPage = page(() => import('@/features/pos/ChannelOrdersPage'));
const OrderScreen = page(() => import('@/features/pos/OrderScreen'));
const DishesPage = page(() => import('@/features/menu/DishesPage'));
const CategoriesPage = page(() => import('@/features/menu/CategoriesPage'));
const BalancePage = page(() => import('@/features/stock/BalancePage'));
const ReceiptsPage = page(() => import('@/features/stock/ReceiptsPage'));
const IngredientsPage = page(() => import('@/features/stock/IngredientsPage'));
const HistoryPage = page(() => import('@/features/stock/HistoryPage'));
const SummaryReportPage = page(() => import('@/features/reports/SummaryReportPage'));
const OrdersReportPage = page(() => import('@/features/reports/OrdersReportPage'));
const TablesReportPage = page(() => import('@/features/reports/TablesReportPage'));
const EmployeesReportPage = page(() => import('@/features/reports/EmployeesReportPage'));
const CashiersReportPage = page(() => import('@/features/reports/CashiersReportPage'));
const ShiftsReportPage = page(() => import('@/features/reports/ShiftsReportPage'));
const DishesReportPage = page(() => import('@/features/reports/DishesReportPage'));
const CategoriesReportPage = page(() => import('@/features/reports/CategoriesReportPage'));
const CancellationsReportPage = page(() => import('@/features/reports/CancellationsReportPage'));
const ShiftsPage = page(() => import('@/features/shifts/ShiftsPage'));
const EmployeesPage = page(() => import('@/features/team/EmployeesPage'));
const RolesPage = page(() => import('@/features/team/RolesPage'));
const LoginHistoryPage = page(() => import('@/features/team/LoginHistoryPage'));
const HallsPage = page(() => import('@/features/halls/HallsPage'));
const TablesAdminPage = page(() => import('@/features/halls/TablesAdminPage'));
const GeneralSettingsPage = page(() => import('@/features/settings/GeneralSettingsPage'));
const PaymentMethodsPage = page(() => import('@/features/settings/PaymentMethodsPage'));
const PrintersPage = page(() => import('@/features/settings/PrintersPage'));
const OrderCheckPage = page(() => import('@/features/settings/OrderCheckPage'));
const DishCheckPage = page(() => import('@/features/settings/DishCheckPage'));

export function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink-50">
      <Logo />
      <Spinner size={24} className="text-brand-700" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  if (status === 'checking') return <SplashScreen />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

function Guard({ permission, mode = 'all', children }: { permission: Permission | Permission[]; mode?: 'all' | 'any'; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const list = Array.isArray(permission) ? permission : [permission];
  const ok = mode === 'all' ? list.every((p) => hasPermission(user, p)) : list.some((p) => hasPermission(user, p));
  return ok ? <>{children}</> : <ForbiddenPage />;
}

/** Sends the user to the first area their role can open. */
function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  if (hasPermission(user, Permission.PosAccess)) return <Navigate to="/pos/tables" replace />;
  if (hasPermission(user, Permission.DashboardView)) return <Navigate to="/dashboard" replace />;
  for (const group of NAVIGATION) {
    const target = group.children?.find((child) =>
      (Array.isArray(child.permission) ? child.permission : [child.permission]).some((p) => hasPermission(user, p)),
    );
    if (target) return <Navigate to={target.to} replace />;
  }
  return <ForbiddenPage />;
}

const guarded = (permission: Permission | Permission[], element: ReactNode, mode: 'all' | 'any' = 'all') => (
  <Guard permission={permission} mode={mode}>
    {element}
  </Guard>
);

/** Every report of the "Отчёт по сменам" section, in sidebar order. */
const SHIFT_REPORTS = [
  { path: 'summary', element: <SummaryReportPage /> },
  { path: 'orders', element: <OrdersReportPage /> },
  { path: 'tables', element: <TablesReportPage /> },
  { path: 'employees', element: <EmployeesReportPage /> },
  { path: 'dishes', element: <DishesReportPage /> },
  { path: 'categories', element: <CategoriesReportPage /> },
  { path: 'cancellations', element: <CancellationsReportPage /> },
];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dashboard', element: guarded(Permission.DashboardView, <DashboardPage />) },
      { path: 'pos', element: <Navigate to="/pos/tables" replace /> },
      { path: 'pos/tables', element: guarded(Permission.PosAccess, <TablesBoardPage />) },
      { path: 'pos/takeaway', element: guarded(Permission.PosAccess, <ChannelOrdersPage key="TAKEAWAY" />) },
      { path: 'pos/delivery', element: guarded(Permission.PosAccess, <ChannelOrdersPage key="DELIVERY" />) },
      { path: 'pos/hall', element: guarded(Permission.PosAccess, <ChannelOrdersPage key="HALL" />) },
      { path: 'pos/order/new', element: guarded(Permission.OrdersCreate, <OrderScreen key="new" />) },
      { path: 'pos/order/:orderId', element: guarded(Permission.PosAccess, <OrderScreen />) },
      { path: 'menu/dishes', element: guarded(Permission.MenuView, <DishesPage />) },
      { path: 'menu/categories', element: guarded(Permission.MenuView, <CategoriesPage />) },
      { path: 'inventory/balance', element: guarded(Permission.StockView, <BalancePage />) },
      { path: 'inventory/receipts', element: guarded(Permission.StockView, <ReceiptsPage />) },
      { path: 'inventory/ingredients', element: guarded(Permission.StockView, <IngredientsPage />) },
      { path: 'inventory/history', element: guarded(Permission.StockView, <HistoryPage />) },
      { path: 'reports', element: <Navigate to="/reports/summary" replace /> },
      { path: 'reports/summary', element: guarded(Permission.ReportsView, <SummaryReportPage />) },
      { path: 'reports/orders', element: guarded(Permission.ReportsView, <OrdersReportPage />) },
      { path: 'reports/tables', element: guarded(Permission.ReportsView, <TablesReportPage />) },
      { path: 'reports/employees', element: guarded(Permission.ReportsView, <EmployeesReportPage />) },
      { path: 'reports/cashiers', element: guarded(Permission.ReportsView, <CashiersReportPage />) },
      { path: 'reports/shifts', element: guarded(Permission.ReportsView, <ShiftsReportPage />) },
      { path: 'reports/dishes', element: guarded(Permission.ReportsView, <DishesReportPage />) },
      { path: 'reports/categories', element: guarded(Permission.ReportsView, <CategoriesReportPage />) },
      { path: 'reports/cancellations', element: guarded(Permission.ReportsView, <CancellationsReportPage />) },
      { path: 'shifts', element: guarded(Permission.ShiftsView, <ShiftsPage />) },
      // Kept so older links and bookmarks still land somewhere sensible.
      { path: 'shifts/current', element: <Navigate to="/shifts" replace /> },
      { path: 'shifts/history', element: <Navigate to="/shifts" replace /> },
      { path: 'shifts/reports', element: <Navigate to="/shifts/reports/summary" replace /> },
      ...SHIFT_REPORTS.map(({ path, element }) => ({
        path: `shifts/reports/${path}`,
        element: guarded(Permission.ReportsView, <ReportModeProvider mode="shift">{element}</ReportModeProvider>),
      })),
      { path: 'team/employees', element: guarded(Permission.TeamView, <EmployeesPage />) },
      { path: 'team/roles', element: guarded(Permission.TeamView, <RolesPage />) },
      { path: 'team/login-history', element: guarded(Permission.TeamView, <LoginHistoryPage />) },
      { path: 'halls/halls', element: guarded(Permission.HallsManage, <HallsPage />) },
      { path: 'halls/tables', element: guarded(Permission.HallsManage, <TablesAdminPage />) },
      { path: 'settings/general', element: guarded(Permission.SettingsManage, <GeneralSettingsPage />) },
      { path: 'settings/payment-methods', element: guarded(Permission.SettingsManage, <PaymentMethodsPage />) },
      { path: 'settings/printers', element: guarded(Permission.SettingsManage, <PrintersPage />) },
      { path: 'settings/order-check', element: guarded(Permission.SettingsManage, <OrderCheckPage />) },
      { path: 'settings/dish-check', element: guarded(Permission.SettingsManage, <DishCheckPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
