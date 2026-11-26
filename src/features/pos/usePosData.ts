import { useQuery } from '@tanstack/react-query';
import { qk } from '@/api/keys';
import { dishesApi } from '@/api/menu.api';
import { posApi } from '@/api/pos.api';
import { paymentMethodsApi, settingsApi } from '@/api/settings.api';
import { shiftsApi } from '@/api/shifts.api';
import { usersApi } from '@/api/team.api';
import { Permission } from '@/lib/permissions';

export const useSettings = () =>
  useQuery({ queryKey: qk.settings, queryFn: settingsApi.get, staleTime: 5 * 60_000 });

export const useShiftStatus = () =>
  useQuery({ queryKey: qk.shiftStatus, queryFn: shiftsApi.status, staleTime: 60_000 });

export const useBoard = () =>
  useQuery({ queryKey: qk.board, queryFn: posApi.board, refetchInterval: 60_000 });

export const usePosMenu = () =>
  useQuery({ queryKey: qk.posMenu, queryFn: dishesApi.posMenu, staleTime: 60_000 });

export const usePaymentMethods = () =>
  useQuery({ queryKey: qk.paymentMethodOptions, queryFn: paymentMethodsApi.options, staleTime: 5 * 60_000 });

export const useWaiters = (enabled = true) =>
  useQuery({
    queryKey: qk.userOptions(Permission.OrdersServe),
    queryFn: () => usersApi.options(Permission.OrdersServe),
    staleTime: 5 * 60_000,
    enabled,
  });
