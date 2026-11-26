import { useMutation } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail } from '@/api/types';
import { Button, Checkbox, Modal } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { ReasonPicker } from './ReasonPicker';

export function CancelOrderModal({
  order,
  onClose,
  onCancelled,
}: {
  order: { id: number; number: number; total: number; title: string } | null;
  onClose: () => void;
  onCancelled?: (order: OrderDetail) => void;
}) {
  const [reason, setReason] = useState('');
  const [returnToStock, setReturnToStock] = useState(true);
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 3;

  const close = () => {
    setReason('');
    setReturnToStock(true);
    setTouched(false);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => ordersApi.cancel(order?.id as number, { reason: reason.trim(), returnToStock }),
    onSuccess: (cancelled) => {
      toast.success(`Заказ #${cancelled.number} отменён`);
      invalidateScopes('board', 'counters', 'orders', 'dashboard', 'shift', 'stock');
      onCancelled?.(cancelled);
      close();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Modal
      open={order !== null}
      onClose={close}
      locked={mutation.isPending}
      size="md"
      icon={<Ban />}
      title={`Отмена заказа #${order?.number ?? ''}`}
      description={order ? `${order.title} · ${formatMoney(order.total)} сум. Все позиции будут отменены.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            Не отменять
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (!invalid) mutation.mutate();
            }}
          >
            Отменить заказ
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ReasonPicker value={reason} onChange={setReason} error={touched && invalid ? 'Укажите причину (минимум 3 символа)' : undefined} />
        <Checkbox
          checked={returnToStock}
          onChange={setReturnToStock}
          label="Вернуть позиции на склад"
          description="Снимите отметку, если блюда уже приготовлены и списываются."
        />
      </div>
    </Modal>
  );
}
