import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { PackageMinus } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { stockApi } from '@/api/stock.api';
import type { IngredientView } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { BalanceShift, FillMaxHint } from './StockParts';
import { formatQtyUnit, MAX_COMMENT, MAX_STOCK_QTY, requiredNumber, roundTo, unitLabel } from './stock.utils';

function makeSchema(ingredient: IngredientView | null) {
  return z
    .object({
      quantity: requiredNumber('Укажите количество', (value) =>
        value.min(0.001, 'Количество должно быть больше нуля').max(MAX_STOCK_QTY, 'Слишком большое количество'),
      ),
      reason: z
        .string()
        .trim()
        .min(1, 'Укажите причину списания')
        .max(MAX_COMMENT, `Не более ${MAX_COMMENT} символов`),
    })
    .superRefine((values, ctx) => {
      if (ingredient && values.quantity > ingredient.quantity) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message:
            ingredient.quantity > 0
              ? `Нельзя списать больше остатка: ${formatQtyUnit(ingredient.quantity, ingredient.unit)}`
              : 'Нет остатка для списания',
        });
      }
    });
}

type Schema = ReturnType<typeof makeSchema>;
type FormInput = z.input<Schema>;
type FormOutput = z.output<Schema>;

/** Списание ингредиента (порча, истёк срок) с обязательной причиной. */
export function IngredientWriteOffModal({
  open,
  ingredient,
  onClose,
}: {
  open: boolean;
  ingredient: IngredientView | null;
  onClose: () => void;
}) {
  const schema = useMemo(() => makeSchema(ingredient), [ingredient]);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: null, reason: '' },
  });

  useEffect(() => {
    if (open) form.reset({ quantity: null, reason: '' });
  }, [open, form]);

  const quantity = useWatch({ control: form.control, name: 'quantity' });

  const mutation = useMutation({
    mutationFn: ({ target, values }: { target: IngredientView; values: FormOutput }) =>
      stockApi.writeOffIngredient(target.id, { quantity: values.quantity, reason: values.reason }),
    onSuccess: (_result, { target, values }) => {
      toast.success(`«${target.name}»: списано ${formatQtyUnit(values.quantity, target.unit)}`);
      invalidateScopes('stock');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const available = Math.max(ingredient?.quantity ?? 0, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      size="sm"
      icon={<PackageMinus />}
      title="Списание"
      description={ingredient ? `«${ingredient.name}» — порча, истёк срок годности и другие потери.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="ingredient-write-off-form" variant="danger" loading={mutation.isPending}>
            Списать
          </Button>
        </>
      }
    >
      {ingredient && (
        <form
          id="ingredient-write-off-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate({ target: ingredient, values }))}
          noValidate
        >
          <BalanceShift
            label="Остаток"
            current={ingredient.quantity}
            next={quantity === null ? null : roundTo(ingredient.quantity - quantity, 3)}
            unit={ingredient.unit}
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
                decimals={3}
                min={0}
                max={available > 0 ? available : undefined}
                suffix={unitLabel(ingredient.unit)}
                error={fieldState.error?.message}
                hint={
                  <FillMaxHint
                    label="Доступно"
                    value={available}
                    unit={ingredient.unit}
                    onFill={() => form.setValue('quantity', available, { shouldValidate: true, shouldDirty: true })}
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
            placeholder="Например: истёк срок годности"
            error={form.formState.errors.reason?.message}
            {...form.register('reason')}
          />
        </form>
      )}
    </Modal>
  );
}
