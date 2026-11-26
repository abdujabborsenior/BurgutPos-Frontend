import { useQuery } from '@tanstack/react-query';
import { hallsApi, tablesApi } from '@/api/halls.api';
import { qk } from '@/api/keys';
import { categoriesApi } from '@/api/menu.api';
import { paymentMethodsApi } from '@/api/settings.api';
import { usersApi } from '@/api/team.api';
import type { Option, PaymentMethodOption, UserOption } from '@/api/types';
import type { SelectOption } from '@/components/ui';
import type { Permission } from '@/lib/permissions';

/** Reference lists change rarely; realtime invalidation refreshes them when they do. */
const REFERENCE_STALE_TIME = 5 * 60_000;

const toUserOptions = (users: UserOption[]): SelectOption<number>[] =>
  users.map((user) => ({ value: user.id, label: user.fullName, hint: user.roleName ?? undefined }));

const toOptions = (items: Option[]): SelectOption<number>[] =>
  items.map((item) => ({ value: item.id, label: item.name }));

/** Active employees, optionally only those whose role grants `permission`. */
export function useUserOptions(permission?: Permission) {
  return useQuery({
    queryKey: qk.userOptions(permission),
    queryFn: () => usersApi.options(permission),
    select: toUserOptions,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useHallOptions() {
  return useQuery({
    queryKey: qk.hallOptions,
    queryFn: () => hallsApi.options(),
    select: toOptions,
    staleTime: REFERENCE_STALE_TIME,
  });
}

/** Raw table options: callers filter them by hall. */
export function useTableOptions() {
  return useQuery({
    queryKey: qk.tableOptions,
    queryFn: () => tablesApi.options(),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useCategoryOptions() {
  return useQuery({
    queryKey: qk.categoryOptions,
    queryFn: () => categoriesApi.options(),
    select: toOptions,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function usePaymentMethodOptions() {
  return useQuery({
    queryKey: qk.paymentMethodOptions,
    queryFn: () => paymentMethodsApi.options(),
    select: (methods: PaymentMethodOption[]): SelectOption<number>[] =>
      methods.map((method) => ({ value: method.id, label: method.name })),
    staleTime: REFERENCE_STALE_TIME,
  });
}
