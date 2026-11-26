import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { stockApi, type DishStockView } from '@/api/stock.api';
import type { BalanceRow } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { BalanceShift, QtyDelta } from './StockParts';
import {
  commentSchema,
  formatQtyUnit,
  isFractionalDishUnit,
  MAX_COMMENT,
  MAX_STOCK_QTY,
  requiredNumber,
  roundTo,
  unitLabel,
} from './stock.utils';

function makeSchema(fractional: boolean) {
  const stock = (message: string) =>
    requiredNumber(message, (value) => {
      const bounded = value.min(0, 'Остаток не может быть отрицательным').max(MAX_STOCK_QTY, 'Слишком большое количество');
      return fractional ? bounded : bounded.int('Укажите целое количество');
    });
  return z.object({
    saleQty: stock('Укажите остаток в продаже'),
    warehouseQty: stock('Укажите остаток на складе'),
    comment: commentSchema,
  });
}

type Schema = ReturnType<typeof makeSchema>;
type FormInput = z.input<Schema>;
type FormOutput = z.output<Schema>;

/** Инвентаризация: sets the counted on-sale and warehouse stock of a dish. */
export function DishAdjustModal({
  open,
  dish,
  onClose,
  onDone,
}: {
  open: boolean;
  dish: BalanceRow | null;
  onClose: () => void;
  onDone: (view: DishStockView) => void;
}) {
  const fractional = dish ? isFractionalDishUnit(dish.unit) : false;
  const schema = useMemo(() => makeSchema(fractional), [fractional]);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { saleQty: null, warehouseQty: null, comment: '' },
  });

  useEffect(() => {
    if (open && dish) {
      form.reset({ saleQty: Math.max(dish.saleQty, 0), warehouseQty: Math.max(dish.warehouseQty, 0), comment: '' });
    }
  }, [open, dish, form]);

  const [saleQty, warehouseQty] = useWatch({ control: form.control, name: ['saleQty', 'warehouseQty'] });

  const mutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormOutput }) =>
      stockApi.adjustDish(id, {
        saleQty: values.saleQty,
        warehouseQty: values.warehouseQty,
        comment: values.comment || undefined,
      }),
    onSuccess: (view) => {
      toast.success(`Остаток «${view.name}» обновлён`);
      onDone(view);
      invalidateScopes('stock', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const decimals = fractional ? 3 : 0;
  const unit = dish?.unit ?? 'PCS';
  const currentTotal = dish ? roundTo(dish.saleQty + dish.warehouseQty, 3) : 0;
  const nextTotal = saleQty === null || warehouseQty === null ? null : roundTo(saleQty + warehouseQty, 3);
  const unchanged = Boolean(dish) && saleQty === dish?.saleQty && warehouseQty === dish?.warehouseQty;

  const currentHint = (current: number, next: number | null) => (
    <>
      Сейчас: <span className="font-medium text-ink-700">{formatQtyUnit(current, unit)}</span>
      {next !== null && next !== current && (
        <>
          {' · '}
          <QtyDelta value={roundTo(next - current, 3)} />
        </>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      icon={<ClipboardCheck />}
      title="Инвентаризация"
      description={dish ? `«${dish.name}» — укажите фактический остаток. Расхождение запишется в историю.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="dish-adjust-form" loading={mutation.isPending} disabled={unchanged}>
            Сохранить
          </Button>
        </>
      }
    >
      {dish && (
        <form
          id="dish-adjust-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate({ id: dish.id, values }))}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="saleQty"
              render={({ field, fieldState }) => (
                <NumericInput
                  label="В продаже"
                  autoFocus
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  decimals={decimals}
                  min={0}
                  max={MAX_STOCK_QTY}
                  suffix={unitLabel(unit)}
                  error={fieldState.error?.message}
                  hint={currentHint(dish.saleQty, field.value)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="warehouseQty"
              render={({ field, fieldState }) => (
                <NumericInput
                  label="На складе"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  decimals={decimals}
                  min={0}
                  max={MAX_STOCK_QTY}
                  suffix={unitLabel(unit)}
                  error={fieldState.error?.message}
                  hint={currentHint(dish.warehouseQty, field.value)}
                />
              )}
            />
          </div>
          <BalanceShift label="Всего" current={currentTotal} next={nextTotal} unit={unit} />
          {!dish.trackStock && (
            <p className="text-xs text-ink-500">
              Учёт остатка для позиции выключен: продажи не списывают остаток «В продаже».
            </p>
          )}
          <Textarea
            label="Комментарий"
            rows={2}
            maxLength={MAX_COMMENT}
            placeholder="Например: плановая инвентаризация"
            error={form.formState.errors.comment?.message}
            {...form.register('comment')}
          />
        </form>
      )}
    </Modal>
  );
}
