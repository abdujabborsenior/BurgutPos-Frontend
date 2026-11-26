import { useMutation } from '@tanstack/react-query';
import { Percent } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { ordersApi } from '@/api/pos.api';
import type { DiscountType, OrderDetail } from '@/api/types';
import { Button, Modal, NumericInput, Segmented } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Mirrors the server calculation for the live preview. */
function preview(order: OrderDetail, type: DiscountType, value: number) {
  const discount =
    type === 'PERCENT' ? round2((order.subtotal * Math.min(value, 100)) / 100) : round2(Math.min(value, order.subtotal));
  const base = round2(order.subtotal - discount);
  const service = round2((base * order.servicePercent) / 100);
  return { discount, total: round2(base + service + order.deliveryFee) };
}

function DiscountForm({ order, onDone, onCancel }: { order: OrderDetail; onDone: (order: OrderDetail) => void; onCancel: () => void }) {
  const [type, setType] = useState<DiscountType>(order.discountType ?? 'PERCENT');
  const [value, setValue] = useState<number | null>(order.discountType ? order.discountValue : null);
  const invalid = value === null || value < 0 || (type === 'PERCENT' ? value > 100 : value > order.subtotal);
  const result = preview(order, type, value ?? 0);

  const mutation = useMutation({
    mutationFn: (input: { type: DiscountType | null; value: number }) => ordersApi.discount(order.id, input.type, input.value),
    onSuccess: (updated, input) => {
      toast.success(input.type ? 'Скидка применена' : 'Скидка убрана');
      invalidateScopes('board', 'orders');
      onDone(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <div className="flex flex-col gap-5">
        <Segmented
          value={type}
          onChange={(next) => {
            setType(next);
            setValue(null);
          }}
          items={[
            { value: 'PERCENT', label: 'Процент' },
            { value: 'AMOUNT', label: 'Сумма' },
          ]}
        />
        <NumericInput
          label={type === 'PERCENT' ? 'Размер скидки, %' : 'Сумма скидки'}
          value={value}
          onChange={setValue}
          decimals={2}
          min={0}
          max={type === 'PERCENT' ? 100 : order.subtotal}
          suffix={type === 'PERCENT' ? '%' : 'сум'}
          inputSize="lg"
          autoFocus
        />
        {type === 'PERCENT' && (
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 30, 50, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => setValue(percent)}
                className={cn(
                  'h-9 rounded-lg border px-3 text-sm font-semibold tabular transition-colors',
                  value === percent ? 'border-brand-800 bg-brand-50 text-brand-900' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
                )}
              >
                {percent}%
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-ink-150 bg-ink-25 p-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Сумма позиций</p>
            <p className="mt-0.5 font-semibold text-ink-900 tabular">{formatMoney(order.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Скидка</p>
            <p className="mt-0.5 font-semibold text-danger-600 tabular">−{formatMoney(invalid ? 0 : result.discount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Итого</p>
            <p className="mt-0.5 text-base font-semibold text-brand-900 tabular">{formatMoney(invalid ? order.total : result.total)}</p>
          </div>
        </div>
      </div>
      <div className="-mx-6 mt-6 -mb-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
        {order.discountType ? (
          <Button variant="danger-soft" disabled={mutation.isPending} onClick={() => mutation.mutate({ type: null, value: 0 })}>
            Убрать скидку
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button disabled={invalid} loading={mutation.isPending} onClick={() => mutation.mutate({ type, value: value ?? 0 })}>
            Применить
          </Button>
        </div>
      </div>
    </>
  );
}

export function DiscountModal({ order, onClose, onApplied }: { order: OrderDetail | null; onClose: () => void; onApplied?: (order: OrderDetail) => void }) {
  return (
    <Modal open={order !== null} onClose={onClose} size="md" icon={<Percent />} title="Скидка на заказ">
      {order && (
        <DiscountForm
          key={order.id}
          order={order}
          onCancel={onClose}
          onDone={(updated) => {
            onApplied?.(updated);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
