import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { stockApi, type DishStockView } from '@/api/stock.api';
import type { BalanceRow, StockLocation } from '@/api/types';
import { Button, Field, Modal, NumericInput, Segmented, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { BalanceShift, FillMaxHint } from './StockParts';
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

const DIRECTIONS: { value: StockLocation; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Со склада в продажу' },
  { value: 'SALE', label: 'Из продажи на склад' },
];

const available = (dish: BalanceRow, from: StockLocation) => (from === 'SALE' ? dish.saleQty : dish.warehouseQty);

function makeSchema(dish: BalanceRow | null) {
  const fractional = dish ? isFractionalDishUnit(dish.unit) : false;
  return z
    .object({
      from: z.enum(['WAREHOUSE', 'SALE']),
      quantity: requiredNumber('Укажите количество', (value) => {
        const bounded = value.min(0.001, 'Количество должно быть больше нуля').max(MAX_STOCK_QTY, 'Слишком большое количество');
        return fractional ? bounded : bounded.int('Укажите целое количество');
      }),
      comment: commentSchema,
    })
    .superRefine((values, ctx) => {
      if (!dish) return;
      const max = available(dish, values.from);
      if (values.quantity > max) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: max > 0 ? `Доступно не более ${formatQtyUnit(max, dish.unit)}` : 'В этом месте нет остатка',
        });
      }
    });
}

type Schema = ReturnType<typeof makeSchema>;
type FormInput = z.input<Schema>;
type FormOutput = z.output<Schema>;

/** Moves dish stock between the warehouse and the sale point. */
export function DishTransferModal({
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
  const schema = useMemo(() => makeSchema(dish), [dish]);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { from: 'WAREHOUSE', quantity: null, comment: '' },
  });

  useEffect(() => {
    if (open && dish) {
      form.reset({ from: dish.warehouseQty > 0 || dish.saleQty <= 0 ? 'WAREHOUSE' : 'SALE', quantity: null, comment: '' });
    }
  }, [open, dish, form]);

  const [from, quantity] = useWatch({ control: form.control, name: ['from', 'quantity'] });

  const mutation = useMutation({
    mutationFn: ({ target, values }: { target: BalanceRow; values: FormOutput }) =>
      stockApi.transfer(target.id, { from: values.from, quantity: values.quantity, comment: values.comment || undefined }),
    onSuccess: (view, { target, values }) => {
      const direction = values.from === 'WAREHOUSE' ? 'со склада в продажу' : 'из продажи на склад';
      toast.success(`«${view.name}»: ${formatQtyUnit(values.quantity, target.unit)} перемещено ${direction}`);
      onDone(view);
      invalidateScopes('stock', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const unit = dish?.unit ?? 'PCS';
  const max = dish ? available(dish, from) : 0;
  const moved = quantity ?? 0;
  const shift = (location: StockLocation) => {
    if (!dish) return null;
    const current = available(dish, location);
    if (quantity === null) return null;
    return roundTo(location === from ? current - moved : current + moved, 3);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      icon={<ArrowLeftRight />}
      title="Перемещение"
      description={dish ? `«${dish.name}» — между складом и точкой продажи.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="dish-transfer-form" loading={mutation.isPending}>
            Переместить
          </Button>
        </>
      }
    >
      {dish && (
        <form
          id="dish-transfer-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate({ target: dish, values }))}
          noValidate
        >
          <Controller
            control={form.control}
            name="from"
            render={({ field }) => (
              <Field label="Направление">
                <Segmented items={DIRECTIONS} value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <BalanceShift label="На складе" current={dish.warehouseQty} next={shift('WAREHOUSE')} unit={unit} />
            <BalanceShift label="В продаже" current={dish.saleQty} next={shift('SALE')} unit={unit} />
          </div>
          <Controller
            control={form.control}
            name="quantity"
            render={({ field, fieldState }) => (
              <NumericInput
                label="Количество"
                required
                autoFocus
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                decimals={isFractionalDishUnit(unit) ? 3 : 0}
                min={0}
                max={max > 0 ? max : undefined}
                suffix={unitLabel(unit)}
                error={fieldState.error?.message}
                hint={
                  <FillMaxHint
                    label="Доступно"
                    value={Math.max(max, 0)}
                    unit={unit}
                    onFill={() => form.setValue('quantity', max, { shouldValidate: true, shouldDirty: true })}
                  />
                }
              />
            )}
          />
          <Textarea
            label="Комментарий"
            rows={2}
            maxLength={MAX_COMMENT}
            placeholder="Необязательно"
            error={form.formState.errors.comment?.message}
            {...form.register('comment')}
          />
        </form>
      )}
    </Modal>
  );
}
