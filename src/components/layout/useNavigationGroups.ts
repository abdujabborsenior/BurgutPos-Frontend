import { useMemo } from 'react';
import type { Permission } from '@/lib/permissions';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { NAVIGATION, type NavGroup } from './navigation';

function allowed(user: ReturnType<typeof useAuthStore.getState>['user'], permission?: Permission | Permission[]) {
  if (!permission) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((item) => hasPermission(user, item));
}

/** Navigation filtered by the current user's permissions. */
export function useNavigationGroups(): NavGroup[] {
  const user = useAuthStore((state) => state.user);
  return useMemo(
    () =>
      NAVIGATION.map((group) => ({
        ...group,
        children: group.children?.filter((child) => allowed(user, child.permission)),
      })).filter((group) => (group.children ? group.children.length > 0 : allowed(user, group.permission))),
    [user],
  );
}
