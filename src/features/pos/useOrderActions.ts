import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail } from '@/api/types';
import { invalidateScopes } from '@/lib/realtime';
import { printPrecheck } from '@/lib/print';
import { useSettings } from './usePosData';

/** Shared order mutations with consistent toasts and cache updates. */
export function useOrderActions() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();

  const store = (order: OrderDetail) => {
    queryClient.setQueryData(qk.order(order.id), order);
    invalidateScopes('board', 'counters', 'orders');
  };

  const precheck = useMutation({
    mutationFn: (orderId: number) => ordersApi.precheck(orderId),
    onSuccess: (order) => {
      store(order);
      printPrecheck(order, settings);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return { precheck, store };
}
