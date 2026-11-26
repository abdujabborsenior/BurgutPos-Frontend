import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { ingredientsApi } from '@/api/stock.api';
import type { IngredientView } from '@/api/types';
import { Button, Input, Modal, NumericInput, Select } from '@/components/ui';
import { INGREDIENT_UNIT_OPTIONS } from '@/lib/labels';
import { invalidateScopes } from '@/lib/realtime';
import { MAX_PRICE, MAX_STOCK_QTY, unitLabel } from './stock.utils';

const UNITS = ['KG', 'G', 'L', 'ML', 'PCS'] as const;

const quantity = (negative: string) =>
  z.number().min(0, negative).max(MAX_STOCK_QTY, 'Слишком большое количество').nullable();

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название ингредиента').max(100, 'Не более 100 символов'),
  unit: z
    .enum(UNITS)
    .nullable()
    .pipe(z.enum(UNITS, { error: 'Выберите единицу измерения' })),
  quantity: quantity('Остаток не может быть отрицательным'),
  minQuantity: quantity('Минимальный остаток не может быть отрицательным'),
  costPrice: z.number().min(0, 'Цена не может быть отрицательной').max(MAX_PRICE, 'Слишком большая цена').nullable(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function IngredientFormModal({
  open,
  ingredient,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  ingredient: IngredientView | null;
  onClose: () => void;
}) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', unit: null, quantity: null, minQuantity: null, costPrice: null },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: ingredient?.name ?? '',
      unit: ingredient?.unit ?? null,
      quantity: null,
      minQuantity: ingredient ? ingredient.minQuantity : null,
      costPrice: ingredient ? ingredient.costPrice : null,
    });
  }, [open, ingredient, form]);

  const unit = useWatch({ control: form.control, name: 'unit' });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      if (ingredient) {
        return ingredientsApi.update(ingredient.id, {
          name: values.name,
          unit: values.unit,
          minQuantity: values.minQuantity ?? 0,
          costPrice: values.costPrice ?? 0,
        });
      }
      return ingredientsApi.create({
        name: values.name,
        unit: values.unit,
        quantity: values.quantity ?? undefined,
        minQuantity: values.minQuantity ?? undefined,
        costPrice: values.costPrice ?? undefined,
      });
    },
    onSuccess: (saved) => {
      toast.success(ingredient ? `Ингредиент «${saved.name}» сохранён` : `Ингредиент «${saved.name}» создан`);
      invalidateScopes('stock', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const { errors } = form.formState;
  const suffix = unitLabel(unit);

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      icon={<Package />}
      title={ingredient ? 'Редактирование ингредиента' : 'Новый ингредиент'}
      description="Ингредиенты списываются по техкартам блюд при каждой продаже."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="ingredient-form" loading={mutation.isPending}>
            {ingredient ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="ingredient-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input
          containerClassName="sm:col-span-2"
          label="Название"
          required
          autoFocus
          maxLength={100}
          placeholder="Например: Мука пшеничная"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="unit"
          render={({ field, fieldState }) => (
            <Select
              className={ingredient ? 'sm:col-span-2' : undefined}
              label="Единица измерения"
              required
              placeholder="Выберите единицу"
              value={field.value}
              onChange={field.onChange}
              options={INGREDIENT_UNIT_OPTIONS}
              error={fieldState.error?.message}
              hint={ingredient ? 'Единицу нельзя изменить, если ингредиент уже участвует в техкартах или движениях' : undefined}
            />
          )}
        />
        {!ingredient && (
          <Controller
            control={form.control}
            name="quantity"
            render={({ field, fieldState }) => (
              <NumericInput
                label="Начальный остаток"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                decimals={3}
                min={0}
                max={MAX_STOCK_QTY}
                suffix={suffix}
                placeholder="0"
                error={fieldState.error?.message}
              />
            )}
          />
        )}
        <Controller
          control={form.control}
          name="minQuantity"
          render={({ field, fieldState }) => (
            <NumericInput
              label="Минимальный остаток"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              decimals={3}
              min={0}
              max={MAX_STOCK_QTY}
              suffix={suffix}
              placeholder="0"
              error={fieldState.error?.message}
              hint="На этом уровне и ниже ингредиент отмечается как заканчивающийся"
            />
          )}
        />
        <Controller
          control={form.control}
          name="costPrice"
          render={({ field, fieldState }) => (
            <NumericInput
              label="Цена за единицу"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              decimals={2}
              min={0}
              max={MAX_PRICE}
              suffix="сум"
              placeholder="0"
              error={fieldState.error?.message}
              hint="Обновляется автоматически при каждом приходе"
            />
          )}
        />
      </form>
    </Modal>
  );
}
