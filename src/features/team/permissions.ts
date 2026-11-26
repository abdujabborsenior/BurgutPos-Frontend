import type { PermissionGroup } from '@/api/types';
import { Permission } from '@/lib/permissions';

const ORDER_PERMISSIONS: Permission[] = [
  Permission.OrdersCreate,
  Permission.OrdersServe,
  Permission.OrdersManageAll,
  Permission.OrdersCancelItems,
  Permission.OrdersCancel,
  Permission.OrdersTransfer,
  Permission.OrdersDiscount,
  Permission.OrdersPay,
  Permission.OrdersReopen,
];

/**
 * Mirrors the server's normalizePermissions(): "manage" implies "view" and any
 * order action implies POS access. Pairs are [granted, implied].
 */
const IMPLIED: readonly (readonly [Permission, Permission])[] = [
  [Permission.MenuManage, Permission.MenuView],
  [Permission.StockManage, Permission.StockView],
  [Permission.ShiftsManage, Permission.ShiftsView],
  [Permission.TeamManage, Permission.TeamView],
  ...ORDER_PERMISSIONS.map((permission) => [permission, Permission.PosAccess] as const),
];

/** Permissions switched on by the selection → the selected permissions that require them. */
export function impliedPermissions(selected: ReadonlySet<Permission>): Map<Permission, Permission[]> {
  const implied = new Map<Permission, Permission[]>();
  for (const [source, target] of IMPLIED) {
    if (selected.has(source)) implied.set(target, [...(implied.get(target) ?? []), source]);
  }
  return implied;
}

/** The selection plus everything it implies — exactly what the server stores. */
export function effectivePermissions(selected: Iterable<Permission>): Set<Permission> {
  const result = new Set(selected);
  for (const permission of impliedPermissions(result).keys()) result.add(permission);
  return result;
}

/** Every permission of the catalog, in catalog (UI) order. */
export function catalogKeys(catalog: readonly PermissionGroup[]): Permission[] {
  return catalog.flatMap((group) => group.permissions.map((permission) => permission.key));
}
