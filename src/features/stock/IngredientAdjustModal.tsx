import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { stockApi } from '@/api/stock.api';
import type { IngredientView } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { BalanceShift } from './StockParts';
import { commentSchema, formatQtyUnit, MAX_COMMENT, MAX_STOCK_QTY, requiredNumber, unitLabel } from './stock.utils';

const schema = z.object({
  quantity: requiredNumber('Укажите фактический остаток', (value) =>
    value.min(0, 'Остаток не может быть отрицательным').max(MAX_STOCK_QTY, 'Слишком большое количество'),
  ),
  comment: commentSchema,
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Инвентаризация ингредиента: sets the counted quantity, the difference goes to the history. */
export function IngredientAdjustModal({
  open,
  ingredient,
  onClose,
}: {
  open: boolean;
  ingredient: IngredientView | null;
  onClose: () => void;
}) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: null, comment: '' },
  });

  useEffect(() => {
    if (open && ingredient) form.reset({ quantity: Math.max(ingredient.quantity, 0), comment: '' });
  }, [open, ingredient, form]);

  const quantity = useWatch({ control: form.control, name: 'quantity' });

  const mutation = useMutation({
    mutationFn: ({ target, values }: { target: IngredientView; values: FormOutput }) =>
      stockApi.adjustIngredient(target.id, { quantity: values.quantity, comment: values.comment || undefined }),
    onSuccess: (_result, { target, values }) => {
      toast.success(`Остаток «${target.name}»: ${formatQtyUnit(values.quantity, target.unit)}`);
      invalidateScopes('stock');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const unchanged = ingredient !== null && quantity === ingredient.quantity;

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      size="sm"
      icon={<ClipboardCheck />}
      title="Инвентаризация"
      description={
        ingredient ? `«${ingredient.name}» — укажите фактический остаток. Расхождение запишется в историю.` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="ingredient-adjust-form" loading={mutation.isPending} disabled={unchanged}>
            Сохранить
          </Button>
        </>
      }
    >
      {ingredient && (
        <form
          id="ingredient-adjust-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate({ target: ingredient, values }))}
          noValidate
        >
          <BalanceShift label="Остаток" current={ingredient.quantity} next={quantity} unit={ingredient.unit} />
          <Controller
            control={form.control}
            name="quantity"
            render={({ field, fieldState }) => (
              <NumericInput
                label="Фактический остаток"
                required
                autoFocus
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                decimals={3}
                min={0}
                max={MAX_STOCK_QTY}
                suffix={unitLabel(ingredient.unit)}
                error={fieldState.error?.message}
              />
            )}
          />
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
