import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { PackageMinus } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { stockApi, type DishStockView } from '@/api/stock.api';
import type { BalanceRow, StockLocation } from '@/api/types';
import { Button, Field, Modal, NumericInput, Segmented, Textarea } from '@/components/ui';
import { formatQty } from '@/lib/format';
import { LOCATION_LABELS } from '@/lib/labels';
import { invalidateScopes } from '@/lib/realtime';
import { BalanceShift, FillMaxHint } from './StockParts';
import {
  formatQtyUnit,
  isFractionalDishUnit,
  MAX_COMMENT,
  MAX_STOCK_QTY,
  requiredNumber,
  roundTo,
  unitLabel,
} from './stock.utils';

const stockAt = (dish: BalanceRow, location: StockLocation) => (location === 'SALE' ? dish.saleQty : dish.warehouseQty);

/** Untracked dishes have no meaningful on-sale stock: only the warehouse can be written off. */
const locationsOf = (dish: BalanceRow): StockLocation[] => (dish.trackStock ? ['SALE', 'WAREHOUSE'] : ['WAREHOUSE']);

function defaultLocation(dish: BalanceRow): StockLocation {
  if (dish.trackStock && dish.saleQty > 0) return 'SALE';
  return dish.warehouseQty > 0 || !dish.trackStock ? 'WAREHOUSE' : 'SALE';
}

function makeSchema(dish: BalanceRow | null) {
  const fractional = dish ? isFractionalDishUnit(dish.unit) : false;
  return z
    .object({
      location: z.enum(['SALE', 'WAREHOUSE']),
      quantity: requiredNumber('Укажите количество', (value) => {
        const bounded = value.min(0.001, 'Количество должно быть больше нуля').max(MAX_STOCK_QTY, 'Слишком большое количество');
        return fractional ? bounded : bounded.int('Укажите целое количество');
      }),
      reason: z
        .string()
        .trim()
        .min(1, 'Укажите причину списания')
        .max(MAX_COMMENT, `Не более ${MAX_COMMENT} символов`),
    })
    .superRefine((values, ctx) => {
      if (!dish) return;
      const max = stockAt(dish, values.location);
      if (values.quantity > max) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: max > 0 ? `Нельзя списать больше остатка: ${formatQtyUnit(max, dish.unit)}` : 'В этом месте нет остатка',
        });
      }
    });
}

type Schema = ReturnType<typeof makeSchema>;
type FormInput = z.input<Schema>;
type FormOutput = z.output<Schema>;

/** Списание: breakage, spoilage, expiry — reduces stock with a mandatory reason. */
export function DishWriteOffModal({
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
    defaultValues: { location: 'WAREHOUSE', quantity: null, reason: '' },
  });

  useEffect(() => {
    if (open && dish) form.reset({ location: defaultLocation(dish), quantity: null, reason: '' });
  }, [open, dish, form]);

  const [location, quantity] = useWatch({ control: form.control, name: ['location', 'quantity'] });

  const mutation = useMutation({
    mutationFn: ({ target, values }: { target: BalanceRow; values: FormOutput }) =>
      stockApi.writeOffDish(target.id, { location: values.location, quantity: values.quantity, reason: values.reason }),
    onSuccess: (view, { target, values }) => {
      toast.success(`«${view.name}»: списано ${formatQtyUnit(values.quantity, target.unit)}`);
      onDone(view);
      invalidateScopes('stock', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const unit = dish?.unit ?? 'PCS';
  const max = dish ? stockAt(dish, location) : 0;
  const locations = dish ? locationsOf(dish) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      icon={<PackageMinus />}
      title="Списание"
      description={dish ? `«${dish.name}» — бой, порча, истёк срок годности и другие потери.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="dish-write-off-form" variant="danger" loading={mutation.isPending}>
            Списать
          </Button>
        </>
      }
    >
      {dish && (
        <form
          id="dish-write-off-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate({ target: dish, values }))}
          noValidate
        >
          {locations.length > 1 ? (
            <Controller
              control={form.control}
              name="location"
              render={({ field }) => (
                <Field label="Откуда списать">
                  <Segmented
                    value={field.value}
                    onChange={field.onChange}
                    items={locations.map((item) => ({
                      value: item,
                      label: `${LOCATION_LABELS[item]} · ${formatQty(stockAt(dish, item))} ${unitLabel(unit)}`,
                    }))}
                  />
                </Field>
              )}
            />
          ) : (
            <p className="text-xs text-ink-500">
              Позиция продаётся без учёта остатка, поэтому списание возможно только со склада.
            </p>
          )}
          <BalanceShift
            label={LOCATION_LABELS[location]}
            current={max}
            next={quantity === null ? null : roundTo(max - quantity, 3)}
            unit={unit}
          />
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
            label="Причина"
            required
            rows={2}
            maxLength={MAX_COMMENT}
            placeholder="Например: бой при разгрузке"
            error={form.formState.errors.reason?.message}
            {...form.register('reason')}
          />
        </form>
      )}
    </Modal>
  );
}
