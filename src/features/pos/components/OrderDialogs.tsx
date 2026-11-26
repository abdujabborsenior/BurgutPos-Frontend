import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { OrderType } from '@/api/types';
import { CancelOrderModal } from '../modals/CancelOrderModal';
import { PaymentModal } from '../modals/PaymentModal';
import { TransferModal, type TransferTarget } from '../modals/TransferModal';
import { Permission } from '@/lib/permissions';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { useOrderActions } from '../useOrderActions';

export interface OrderRef {
  id: number;
  number: number;
  type: OrderType;
  total: number;
  title: string;
  tableId: number | null;
  waiterId: number | null;
}

/** Board-level dialogs (transfer / cancel / pay / print) driven by order refs. */
export function useOrderDialogs() {
  const navigate = useNavigate();
  const { precheck } = useOrderActions();
  const [transfer, setTransfer] = useState<TransferTarget | null>(null);
  const [cancel, setCancel] = useState<OrderRef | null>(null);
  const [payId, setPayId] = useState<number | null>(null);
  const me = useAuthStore((state) => state.user);

  const actionsFor = (order: OrderRef) => {
    // Same ownership rule as the API: waiters act only on their own orders.
    const canModify = hasPermission(me, Permission.OrdersManageAll) || (order.waiterId !== null && order.waiterId === me?.id);
    return {
      onOpen: () => navigate(`/pos/order/${order.id}`),
      // Only a table order is moved from the board; changing the waiter of a
      // takeaway / hall order happens inside the order itself.
      onTransfer:
        canModify && order.type === 'TABLE'
          ? () =>
              setTransfer({
                id: order.id,
                number: order.number,
                type: order.type,
                tableId: order.tableId,
                waiterId: order.waiterId,
                title: order.title,
              })
          : undefined,
      onCancel: canModify ? () => setCancel(order) : undefined,
      onPay: canModify ? () => setPayId(order.id) : undefined,
      onPrint: canModify ? () => precheck.mutate(order.id) : undefined,
      printing: precheck.isPending && precheck.variables === order.id,
    };
  };

  const dialogs = (
    <>
      <TransferModal order={transfer} onClose={() => setTransfer(null)} />
      <CancelOrderModal order={cancel} onClose={() => setCancel(null)} />
      <PaymentModal orderId={payId} onClose={() => setPayId(null)} />
    </>
  );

  return { actionsFor, dialogs };
}
