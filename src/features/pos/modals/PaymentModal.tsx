import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Plus, Smartphone, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail, PaymentMethodOption, PaymentMethodType } from '@/api/types';
import { Button, Checkbox, Modal, NumericInput, PageSpinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { usePaymentMethods, useSettings } from '../usePosData';
import { usePrintOrder } from '../usePrintOrder';

const METHOD_ICONS: Record<PaymentMethodType, React.ReactNode> = {
  CASH: <Banknote />,
  CARD: <CreditCard />,
  ONLINE: <Smartphone />,
  OTHER: <Wallet />,
};

interface Line {
  key: string;
  methodId: number;
  amount: number | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function quickAmounts(total: number): number[] {
  const steps = [1000, 5000, 10000, 50000, 100000];
  const result = new Set<number>();
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) result.add(rounded);
  }
  return [...result].sort((a, b) => a - b).slice(0, 4);
}

function PaymentForm({
  order,
  methods,
  onDone,
  onCancel,
}: {
  order: OrderDetail;
  methods: PaymentMethodOption[];
  onDone: (order: OrderDetail, print: boolean) => void;
  onCancel: () => void;
}) {
  const { data: settings } = useSettings();
  const printing = usePrintOrder();
  const defaultMethod = methods.find((method) => method.type === 'CASH') ?? methods[0];
  const [lines, setLines] = useState<Line[]>(() =>
    defaultMethod ? [{ key: crypto.randomUUID(), methodId: defaultMethod.id, amount: order.total }] : [],
  );
  const [print, setPrint] = useState(settings?.autoPrintReceipt ?? true);

  const methodById = useMemo(() => new Map(methods.map((method) => [method.id, method])), [methods]);
  const received = round2(lines.reduce((sum, line) => sum + (line.amount ?? 0), 0));
  const cashReceived = round2(
    lines.filter((line) => methodById.get(line.methodId)?.type === 'CASH').reduce((sum, line) => sum + (line.amount ?? 0), 0),
  );
  const remaining = round2(Math.max(0, order.total - received));
  const change = round2(Math.max(0, received - order.total));
  const nonCashOverpay = change > cashReceived;
  const cashLine = lines.find((line) => methodById.get(line.methodId)?.type === 'CASH');
  const canSubmit = order.total === 0 || (received >= order.total && !nonCashOverpay && lines.every((line) => (line.amount ?? 0) > 0));

  const mutation = useMutation({
    mutationFn: () =>
      ordersApi.pay(
        order.id,
        lines.filter((line) => (line.amount ?? 0) > 0).map((line) => ({ methodId: line.methodId, amount: line.amount ?? 0 })),
      ),
    onSuccess: (paid) => {
      toast.success(`Заказ #${paid.number} оплачен${paid.changeAmount > 0 ? ` · сдача ${formatMoney(paid.changeAmount)}` : ''}`);
      invalidateScopes('board', 'counters', 'orders', 'dashboard', 'shift');
      if (print) void printing.receipt(paid);
      onDone(paid, print);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const toggleMethod = (method: PaymentMethodOption) => {
    const existing = lines.find((line) => line.methodId === method.id);
    if (existing) return;
    setLines((current) => {
      if (current.length === 1 && received === order.total && !current[0].amount) {
        return [{ ...current[0], methodId: method.id }];
      }
      return [...current, { key: crypto.randomUUID(), methodId: method.id, amount: remaining || null }];
    });
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-between rounded-2xl bg-brand-950 px-6 py-5 text-white">
          <div>
            <p className="text-[13px] font-medium text-brand-200">К оплате · заказ #{order.number}</p>
            <p className="mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em] tabular">
              {formatMoney(order.total)}
              <span className="ml-2 text-base font-medium text-brand-300">сум</span>
            </p>
          </div>
          {order.discountAmount > 0 && (
            <p className="text-right text-xs text-brand-200">
              Скидка
              <br />
              <span className="text-sm font-semibold text-white tabular">−{formatMoney(order.discountAmount)}</span>
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-700">Способ оплаты</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {methods.map((method) => {
              const active = lines.some((line) => line.methodId === method.id);
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className={cn(
                    'flex h-12 items-center gap-2.5 rounded-xl border px-3.5 text-left text-sm font-semibold transition-colors [&_svg]:size-[18px]',
                    active
                      ? 'border-brand-800 bg-brand-50 text-brand-900 ring-1 ring-brand-800'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
                  )}
                >
                  <span className={active ? 'text-brand-800' : 'text-ink-400'}>{METHOD_ICONS[method.type]}</span>
                  <span className="truncate">{method.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {lines.map((line) => {
            const method = methodById.get(line.methodId);
            return (
              <div key={line.key} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-semibold text-ink-800">{method?.name}</span>
                <NumericInput
                  value={line.amount}
                  onChange={(amount) => updateLine(line.key, { amount })}
                  min={0}
                  decimals={2}
                  suffix="сум"
                  inputSize="lg"
                  containerClassName="flex-1"
                  align="right"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    aria-label="Убрать способ оплаты"
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    className="rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
          {remaining > 0 && lines.length < methods.length && (
            <button
              type="button"
              onClick={() => {
                const next = methods.find((method) => !lines.some((line) => line.methodId === method.id));
                if (next) toggleMethod(next);
              }}
              className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-900"
            >
              <Plus className="size-4" /> Разделить оплату
            </button>
          )}
        </div>

        {cashLine && order.total > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-700">Быстрая сумма наличными</p>
            <div className="flex flex-wrap gap-2">
              {[order.total - (received - (cashLine.amount ?? 0)), ...quickAmounts(order.total - (received - (cashLine.amount ?? 0)))]
                .filter((value, index, all) => value > 0 && all.indexOf(value) === index)
                .map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateLine(cashLine.key, { amount: round2(value) })}
                    className="h-10 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-800 tabular transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    {index === 0 ? 'Без сдачи' : formatMoney(value)}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ink-150 bg-ink-25 p-4">
          <div>
            <p className="text-xs font-medium text-ink-500">Внесено</p>
            <p className="mt-0.5 text-xl font-semibold text-ink-900 tabular">{formatMoney(received)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-ink-500">{remaining > 0 ? 'Осталось внести' : 'Сдача'}</p>
            <p className={cn('mt-0.5 text-xl font-semibold tabular', remaining > 0 ? 'text-danger-600' : 'text-success-700')}>
              {formatMoney(remaining > 0 ? remaining : change)}
            </p>
          </div>
          {nonCashOverpay && (
            <p className="col-span-2 text-xs font-medium text-danger-600">
              Сдача выдаётся только наличными: безналичная оплата не может превышать сумму к оплате.
            </p>
          )}
        </div>
        <Checkbox checked={print} onChange={setPrint} label="Напечатать чек" />
      </div>
      <div className="-mx-6 mt-6 -mb-5 flex justify-end gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
        <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Отмена
        </Button>
        <Button size="lg" disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Принять оплату
        </Button>
      </div>
    </>
  );
}

export function PaymentModal({
  orderId,
  onClose,
  onPaid,
}: {
  orderId: number | null;
  onClose: () => void;
  onPaid?: (order: OrderDetail) => void;
}) {
  const { data: methods, isLoading: methodsLoading } = usePaymentMethods();
  const { data: order, isLoading } = useQuery({
    queryKey: qk.order(orderId ?? 0),
    queryFn: () => ordersApi.get(orderId as number),
    enabled: orderId !== null,
  });

  return (
    <Modal open={orderId !== null} onClose={onClose} title="Оплата заказа" icon={<Wallet />} size="lg">
      {isLoading || methodsLoading || !order || !methods ? (
        <PageSpinner />
      ) : order.status !== 'OPEN' ? (
        <p className="py-8 text-center text-sm text-ink-600">Заказ уже закрыт.</p>
      ) : methods.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-600">Нет активных способов оплаты. Добавьте их в настройках.</p>
      ) : (
        <PaymentForm
          key={`${order.id}-${order.total}`}
          order={order}
          methods={methods}
          onCancel={onClose}
          onDone={(paid) => {
            onPaid?.(paid);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
