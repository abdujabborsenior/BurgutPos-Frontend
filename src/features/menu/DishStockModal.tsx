import { useMutation } from '@tanstack/react-query';
import { Equal, Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { stockApi } from '@/api/stock.api';
import type { DishView, StockAdjustMode } from '@/api/types';
import { Button, IconButton, Modal, NumericInput, Segmented, Switch } from '@/components/ui';
import { formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS } from '@/lib/labels';
import { invalidateScopes } from '@/lib/realtime';

/**
 * «Изменить остаток» — то, что открывается щелчком по остатку в списке блюд.
 * Здесь два разных решения: считать ли остаток этого блюда вообще и, если
 * считать, сколько его сейчас в продаже. Склад не трогаем: его количество
 * меняется приходом и перемещением, а не этим окном.
 *
 * «Добавить» и «Убрать» уходят на сервер дельтой, а не готовым числом: пока
 * окно открыто, блюдо продолжают продавать, и посчитанная в браузере сумма
 * отменила бы эти продажи.
 */
const MODES: { value: StockAdjustMode; label: string; icon: ReactNode }[] = [
  { value: 'set', label: 'Заменить', icon: <Equal /> },
  { value: 'add', label: 'Добавить', icon: <Plus /> },
  { value: 'remove', label: 'Убрать', icon: <Minus /> },
];

const STEP_LABELS: Record<StockAdjustMode, string> = {
  set: 'Новый остаток',
  add: 'Сколько добавить',
  remove: 'Сколько убрать',
};

/** All this window needs of a dish — so the menu list and the stock balance both open it. */
export type StockDish = Pick<DishView, 'id' | 'name' | 'unit' | 'trackStock' | 'saleQty'>;

export function DishStockModal({ dish, onClose }: { dish: StockDish | null; onClose: () => void }) {
  const [track, setTrack] = useState(false);
  const [mode, setMode] = useState<StockAdjustMode>('set');
  const [qty, setQty] = useState<number | null>(0);
  const [openedFor, setOpenedFor] = useState<number | null>(null);

  // Another dish (or the same one opened again): start from what it is now.
  const dishId = dish?.id ?? null;
  if (dishId !== openedFor) {
    setOpenedFor(dishId);
    if (dish) {
      setTrack(dish.trackStock);
      setMode('set');
      setQty(dish.saleQty);
    }
  }

  const unit = dish ? DISH_UNIT_LABELS[dish.unit] : '';
  const decimals = dish && (dish.unit === 'PCS' || dish.unit === 'PORTION') ? 0 : 3;
  const value = qty ?? 0;
  const current = dish?.saleQty ?? 0;

  /** «Заменить» starts from the current quantity; a delta starts from nothing. */
  const changeMode = (next: StockAdjustMode) => {
    setMode(next);
    setQty(next === 'set' ? current : null);
  };

  // What the dish will hold if this window is saved — the number the cashier checks.
  const result = mode === 'set' ? value : mode === 'add' ? current + value : current - value;
  const tooMuch = mode === 'remove' && value > current;

  const trackChanged = Boolean(dish) && track !== dish?.trackStock;
  const qtyChanged = track && value > 0 && (mode !== 'set' || value !== current);
  const dirty = trackChanged || qtyChanged;

  const save = useMutation({
    mutationFn: async () => {
      if (!dish) return;
      // Tracking first: adjusting the quantity of an untracked dish means nothing.
      if (track !== dish.trackStock) await stockApi.setTracking(dish.id, track);
      if (track && qtyChanged) {
        await stockApi.adjustDish(dish.id, {
          mode,
          saleQty: value,
          comment: 'Изменение остатка из списка блюд',
        });
      }
    },
    onSuccess: () => {
      toast.success('Остаток обновлён');
      invalidateScopes('menu', 'stock');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const step = (delta: number) => setQty(Math.max(0, Number((value + delta).toFixed(decimals))));

  return (
    <Modal
      open={Boolean(dish)}
      onClose={onClose}
      locked={save.isPending}
      size="sm"
      title="Изменить остаток"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!dirty || tooMuch}
          >
            Сохранить
          </Button>
        </>
      }
    >
      {dish && (
        <div className="flex flex-col gap-4">
          <div className="bg-ink-50 rounded-xl px-4 py-3">
            <p className="text-ink-900 text-sm font-semibold">{dish.name}</p>
            <p className="text-ink-600 mt-0.5 text-[13px]">
              Текущее количество:{' '}
              <span className="tabular text-ink-900 font-semibold">
                {dish.trackStock ? `${formatQty(current)} ${unit}` : 'не учитывается'}
              </span>
            </p>
          </div>

          <Switch
            label="Учитывать остаток"
            description="Продажа уменьшает остаток «в продаже». Выключено — блюдо всегда доступно."
            checked={track}
            onChange={setTrack}
            disabled={save.isPending}
          />

          {track && (
            <div className="flex flex-col gap-3">
              <Segmented
                items={MODES}
                value={mode}
                onChange={changeMode}
                className="[&>button]:flex-1"
              />

              <div className="flex items-end gap-2">
                <IconButton
                  label="Меньше"
                  icon={<Minus />}
                  variant="outline"
                  onClick={() => step(-1)}
                  disabled={save.isPending || value <= 0}
                  className="mb-px"
                />
                <NumericInput
                  label={STEP_LABELS[mode]}
                  value={qty}
                  onChange={setQty}
                  min={0}
                  max={mode === 'remove' ? current : undefined}
                  decimals={decimals}
                  suffix={unit}
                  align="center"
                  containerClassName="flex-1"
                  error={tooMuch ? `В продаже только ${formatQty(current)} ${unit}` : undefined}
                  disabled={save.isPending}
                />
                <IconButton
                  label="Больше"
                  icon={<Plus />}
                  variant="outline"
                  onClick={() => step(1)}
                  disabled={save.isPending || (mode === 'remove' && value >= current)}
                  className="mb-px"
                />
              </div>

              {!tooMuch && mode !== 'set' && value > 0 && (
                <p className="text-ink-600 text-[13px]">
                  Станет:{' '}
                  <span className="tabular text-ink-900 font-semibold">
                    {formatQty(result)} {unit}
                  </span>
                </p>
              )}

              <p className="text-ink-500 text-[13px]">
                Количество на складе меняется приходом и перемещением
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
