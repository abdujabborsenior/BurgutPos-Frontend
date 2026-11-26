import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail } from '@/api/types';
import { usePrompt } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';

/**
 * "Вернуть в работу": a paid order becomes open again. The money it holds is
 * reversed (storno) in the current shift — the cashier sees exactly that, and
 * a reason is mandatory because the drawer changes.
 */
export function useReopenOrder() {
  const prompt = usePrompt();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => ordersApi.reopen(id, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(qk.order(order.id), order);
      toast.success(`Заказ #${order.number} возвращён в работу`);
      invalidateScopes('board', 'counters', 'orders', 'dashboard', 'shift');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось вернуть заказ в работу')),
  });

  const reopen = async (order: { id: number; number: number; total: number }): Promise<OrderDetail | null> => {
    const reason = await prompt({
      title: `Восстановить заказ #${order.number}?`,
      description: `Оплата ${formatMoney(order.total)} сум будет сторнирована в текущей смене, а заказ снова станет открытым: его можно изменить, оплатить заново или отменить с возвратом денег гостю.`,
      confirmText: 'Восстановить',
      tone: 'danger',
      reason: { label: 'Причина', placeholder: 'Например: ошиблись способом оплаты', required: true, minLength: 3 },
    });
    if (reason === null) return null;
    try {
      return await mutation.mutateAsync({ id: order.id, reason: reason.trim() });
    } catch {
      return null; // already reported by onError
    }
  };

  return { reopen, pendingId: mutation.isPending ? mutation.variables?.id : undefined };
}
