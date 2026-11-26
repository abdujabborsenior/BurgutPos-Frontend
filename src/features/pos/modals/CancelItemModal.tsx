import { useMutation } from '@tanstack/react-query';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail, OrderItemView } from '@/api/types';
import { Button, Checkbox, Modal, NumericInput } from '@/components/ui';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS } from '@/lib/labels';
import { formatMoney, formatQty } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { ReasonPicker } from './ReasonPicker';

function CancelItemForm({
  orderId,
  item,
  onDone,
  onCancel,
}: {
  orderId: number;
  item: OrderItemView;
  onDone: (order: OrderDetail) => void;
  onCancel: () => void;
}) {
  const fractional = FRACTIONAL_DISH_UNITS.includes(item.unit);
  const [quantity, setQuantity] = useState<number | null>(fractional ? item.quantity : 1);
  const [reason, setReason] = useState('');
  const [returnToStock, setReturnToStock] = useState(true);
  const [touched, setTouched] = useState(false);
  const qtyInvalid = !quantity || quantity <= 0 || quantity > item.quantity;
  const reasonInvalid = reason.trim().length < 3;

  const mutation = useMutation({
    mutationFn: () => ordersApi.cancelItem(orderId, item.id, { quantity: quantity ?? 0, reason: reason.trim(), returnToStock }),
    onSuccess: (order) => {
      toast.success(`Отменено: ${item.name} × ${formatQty(quantity ?? 0)}`);
      invalidateScopes('board', 'counters', 'orders', 'stock');
      onDone(order);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-ink-150 bg-ink-25 p-4">
          <p className="font-semibold text-ink-900">{item.name}</p>
          <p className="mt-0.5 text-sm text-ink-500 tabular">
            {formatQty(item.quantity)} {DISH_UNIT_LABELS[item.unit]} × {formatMoney(item.price)} = {formatMoney(item.total)}
          </p>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-700">Сколько отменить</p>
          {fractional ? (
            <NumericInput value={quantity} onChange={setQuantity} decimals={3} min={0} max={item.quantity} suffix={DISH_UNIT_LABELS[item.unit]} />
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="lg" className="w-12 px-0" aria-label="Меньше" disabled={(quantity ?? 1) <= 1} onClick={() => setQuantity((q) => Math.max(1, (q ?? 1) - 1))}>
                <Minus className="size-4" />
              </Button>
              <span className="min-w-16 text-center text-2xl font-semibold text-ink-900 tabular">{quantity}</span>
              <Button variant="secondary" size="lg" className="w-12 px-0" aria-label="Больше" disabled={(quantity ?? 1) >= item.quantity} onClick={() => setQuantity((q) => Math.min(item.quantity, (q ?? 1) + 1))}>
                <Plus className="size-4" />
              </Button>
              <span className="text-sm text-ink-500">из {formatQty(item.quantity)}</span>
              {item.quantity > 1 && (
                <button type="button" className="ml-auto text-[13px] font-semibold text-brand-700 hover:text-brand-900" onClick={() => setQuantity(item.quantity)}>
                  Все
                </button>
              )}
            </div>
          )}
        </div>
        <ReasonPicker value={reason} onChange={setReason} error={touched && reasonInvalid ? 'Укажите причину (минимум 3 символа)' : undefined} />
        <Checkbox checked={returnToStock} onChange={setReturnToStock} label="Вернуть на склад" description="Снимите отметку, если блюдо уже приготовлено." />
      </div>
      <div className="-mx-6 mt-6 -mb-5 flex justify-end gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
        <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Отмена
        </Button>
        <Button
          variant="danger"
          loading={mutation.isPending}
          disabled={qtyInvalid}
          onClick={() => {
            setTouched(true);
            if (!reasonInvalid && !qtyInvalid) mutation.mutate();
          }}
        >
          Отменить позицию
        </Button>
      </div>
    </>
  );
}

export function CancelItemModal({
  orderId,
  item,
  onClose,
  onCancelled,
}: {
  orderId: number;
  item: OrderItemView | null;
  onClose: () => void;
  onCancelled?: (order: OrderDetail) => void;
}) {
  return (
    <Modal open={item !== null} onClose={onClose} size="md" icon={<Undo2 />} title="Отмена позиции">
      {item && (
        <CancelItemForm
          key={item.id}
          orderId={orderId}
          item={item}
          onCancel={onClose}
          onDone={(order) => {
            onCancelled?.(order);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
