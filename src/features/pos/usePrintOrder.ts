import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail } from '@/api/types';
import { printPrecheck, printReceipt } from '@/lib/print';
import { invalidateScopes } from '@/lib/realtime';
import { useSettings } from './usePosData';

/**
 * The one way to print an order, so every printed paper lands in the order's
 * print history ("История печати чеков"). The browser prints; the server only
 * learns about it:
 *  • `bill` — an open order's bill, through the precheck command (which also
 *    counts the prints shown on the POS tile);
 *  • `receipt` — a paid order's receipt, printed first and then logged. A
 *    failed log never takes the paper back: it is reported and that's all.
 */
export function usePrintOrder() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();

  const bill = async (orderId: number): Promise<OrderDetail> => {
    const order = await ordersApi.precheck(orderId);
    queryClient.setQueryData(qk.order(order.id), order);
    invalidateScopes('board');
    printPrecheck(order, settings);
    return order;
  };

  const receipt = async (order: OrderDetail, printedBy?: string | null): Promise<void> => {
    printReceipt(order, settings, printedBy);
    try {
      const logged = await ordersApi.receiptPrinted(order.id);
      queryClient.setQueryData(qk.order(logged.id), logged);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Чек напечатан, но не записан в историю печати'));
    }
  };

  return { bill, receipt };
}
