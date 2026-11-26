import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ImagePlus, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { categoriesApi, dishesApi, type DishInput } from '@/api/menu.api';
import { printersApi } from '@/api/settings.api';
import { ingredientsApi } from '@/api/stock.api';
import type { DishDetail, DishUnit } from '@/api/types';
import { Button, Combobox, Input, Modal, NumericInput, PageSpinner, Select, Switch } from '@/components/ui';
import { DISH_UNIT_OPTIONS, INGREDIENT_UNIT_LABELS } from '@/lib/labels';
import { formatMoney, formatPercent } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';

const MAX_IMAGE = 5 * 1024 * 1024;

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(150, 'Не более 150 символов'),
  categoryId: z.number({ error: 'Выберите категорию' }).int().positive('Выберите категорию'),
  printerId: z.number().int().positive().nullable(),
  price: z.number({ error: 'Укажите цену' }).min(0, 'Цена не может быть отрицательной').max(1_000_000_000, 'Слишком большая цена'),
  unit: z.enum(['PCS', 'PORTION', 'KG', 'L']),
  sortOrder: z.number().int().min(0).max(100000).nullable(),
  isAvailable: z.boolean(),
  trackStock: z.boolean(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.number({ error: 'Выберите ингредиент' }).int().positive('Выберите ингредиент'),
        quantity: z.number({ error: 'Укажите количество' }).positive('Больше нуля').max(100000),
      }),
    )
    .max(100)
    .refine((lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length, 'Ингредиент указан дважды'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  categoryId: 0,
  printerId: null,
  price: 0,
  unit: 'PCS',
  sortOrder: null,
  isAvailable: true,
  trackStock: false,
  ingredients: [],
};

function ImagePicker({
  current,
  file,
  removed,
  onFile,
  onRemove,
}: {
  current: string | null;
  file: File | null;
  removed: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const shown = preview ?? (removed ? null : current);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-ink-700">Фото</span>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-dashed border-ink-300 bg-ink-25">
        {shown ? (
          <>
            <img src={shown} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить фото"
              className="absolute top-2 right-2 rounded-lg bg-white/95 p-1.5 text-ink-600 shadow-card hover:text-danger-600"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-brand-800"
          >
            <ImagePlus className="size-7" />
            <span className="text-[13px] font-medium">Загрузить фото</span>
            <span className="text-[11px] text-ink-400">JPG, PNG или WebP, до 5 МБ</span>
          </button>
        )}
      </div>
      {shown && (
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          Заменить фото
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          if (!picked) return;
          if (picked.size > MAX_IMAGE) {
            toast.error('Размер изображения — не более 5 МБ');
            return;
          }
          onFile(picked);
        }}
      />
    </div>
  );
}

export function DishFormModal({ open, dishId, onClose }: { open: boolean; dishId: number | null; onClose: () => void }) {
  const editing = dishId !== null;
  const detail = useQuery({ queryKey: qk.dish(dishId ?? 0), queryFn: () => dishesApi.get(dishId as number), enabled: open && editing });
  const [pending, setPending] = useState(false);
  const loading = editing && (detail.isLoading || !detail.data);

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={pending}
      size="xl"
      icon={<UtensilsCrossed />}
      title={editing ? 'Редактирование блюда' : 'Новое блюдо'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="dish-form" loading={pending} disabled={loading}>
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      {loading ? (
        <PageSpinner />
      ) : (
        <DishForm key={dishId ?? 'new'} dish={editing ? (detail.data ?? null) : null} onPending={setPending} onDone={onClose} />
      )}
    </Modal>
  );
}

function DishForm({ dish, onPending, onDone }: { dish: DishDetail | null; onPending: (pending: boolean) => void; onDone: () => void }) {
  const editing = dish !== null;
  const categories = useQuery({ queryKey: qk.categoryOptions, queryFn: categoriesApi.options });
  const printers = useQuery({ queryKey: qk.printerOptions, queryFn: printersApi.options });
  const ingredients = useQuery({ queryKey: qk.ingredientOptions, queryFn: ingredientsApi.options });
  const [file, setFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: dish
      ? {
          name: dish.name,
          categoryId: dish.category.id,
          printerId: dish.printer?.id ?? null,
          price: dish.price,
          unit: dish.unit,
          sortOrder: dish.sortOrder,
          isAvailable: dish.isAvailable,
          trackStock: dish.trackStock,
          ingredients: dish.ingredients.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity })),
        }
      : EMPTY,
  });
  const recipe = useFieldArray({ control: form.control, name: 'ingredients' });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const input: DishInput = {
        name: values.name,
        categoryId: values.categoryId,
        printerId: values.printerId,
        price: values.price,
        unit: values.unit,
        sortOrder: values.sortOrder ?? undefined,
        isAvailable: values.isAvailable,
        trackStock: values.trackStock,
        ingredients: values.ingredients,
      };
      const saved = dish ? await dishesApi.update(dish.id, input) : await dishesApi.create(input);
      try {
        if (file) await dishesApi.uploadImage(saved.id, file);
        else if (imageRemoved && saved.imageUrl) await dishesApi.removeImage(saved.id);
      } catch (error) {
        toast.error(`Блюдо сохранено, но фото не загружено: ${getErrorMessage(error)}`);
      }
      return saved;
    },
    onMutate: () => onPending(true),
    onSettled: () => onPending(false),
    onSuccess: () => {
      toast.success(editing ? 'Блюдо сохранено' : 'Блюдо создано');
      invalidateScopes('menu', 'stock');
      onDone();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const ingredientMap = useMemo(() => new Map((ingredients.data ?? []).map((item) => [item.id, item])), [ingredients.data]);
  const watchedLines = useWatch({ control: form.control, name: 'ingredients' });
  const watchedPrice = useWatch({ control: form.control, name: 'price' });
  const recipeCost = (watchedLines ?? []).reduce(
    (sum, line) => sum + (line.quantity || 0) * (ingredientMap.get(line.ingredientId)?.costPrice ?? 0),
    0,
  );
  const margin = recipeCost > 0 && watchedPrice > 0 ? ((watchedPrice - recipeCost) / recipeCost) * 100 : null;
  const { errors } = form.formState;

  return (
    <form id="dish-form" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-6 md:grid-cols-[220px_1fr]">
      <ImagePicker
        current={dish?.imageUrl ?? null}
        file={file}
        removed={imageRemoved}
        onFile={(picked) => {
          setFile(picked);
          setImageRemoved(false);
        }}
        onRemove={() => {
          setFile(null);
          setImageRemoved(true);
        }}
      />
      <div className="flex flex-col gap-4">
        <Input label="Название" required autoFocus error={errors.name?.message} {...form.register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <Select
                label="Категория"
                required
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? 0)}
                placeholder="Выберите категорию"
                error={errors.categoryId?.message}
                options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
              />
            )}
          />
          <Controller
            control={form.control}
            name="printerId"
            render={({ field }) => (
              <Select
                label="Принтер (станция)"
                value={field.value}
                onChange={field.onChange}
                options={[{ value: null, label: 'Без принтера' }, ...(printers.data ?? []).map((printer) => ({ value: printer.id, label: printer.name }))]}
              />
            )}
          />
          <Controller
            control={form.control}
            name="price"
            render={({ field }) => (
              <NumericInput label="Цена" required value={field.value} onChange={(value) => field.onChange(value ?? 0)} decimals={2} min={0} suffix="сум" error={errors.price?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="unit"
            render={({ field }) => (
              <Select<DishUnit>
                label="Единица продажи"
                value={field.value}
                onChange={field.onChange}
                options={DISH_UNIT_OPTIONS}
                hint={field.value === 'KG' || field.value === 'L' ? 'Можно продавать дробное количество' : undefined}
              />
            )}
          />
          <Controller
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <NumericInput label="Порядок" value={field.value} onChange={field.onChange} min={0} max={100000} hint="Пусто — в конец категории" />
            )}
          />
        </div>
        <div className="grid gap-3 rounded-2xl border border-ink-150 p-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="isAvailable"
            render={({ field }) => (
              <Switch label="В наличии" description="Если выключено — блюдо нельзя заказать" checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={form.control}
            name="trackStock"
            render={({ field }) => (
              <Switch label="Учитывать остаток" description="Продажа уменьшает остаток «в продаже»" checked={field.value} onChange={field.onChange} />
            )}
          />
        </div>

        <div className="rounded-2xl border border-ink-150">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Техкарта</p>
              <p className="text-xs text-ink-500">Ингредиенты списываются со склада при каждой продаже</p>
            </div>
            <Button
              variant="brand-soft"
              size="sm"
              leftIcon={<Plus className="size-3.5" />}
              onClick={() => recipe.append({ ingredientId: 0, quantity: 0 })}
              disabled={recipe.fields.length >= 100}
            >
              Ингредиент
            </Button>
          </div>
          {recipe.fields.length === 0 ? (
            <p className="px-4 py-5 text-center text-[13px] text-ink-500">Техкарта не заполнена</p>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {recipe.fields.map((field, index) => {
                const lineErrors = errors.ingredients?.[index];
                const ingredient = ingredientMap.get(watchedLines?.[index]?.ingredientId ?? 0);
                return (
                  <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_150px_96px_36px] items-start gap-2">
                    <Controller
                      control={form.control}
                      name={`ingredients.${index}.ingredientId`}
                      render={({ field: control }) => (
                        <Combobox
                          value={control.value || null}
                          onChange={(value) => control.onChange(value ?? 0)}
                          placeholder="Ингредиент"
                          error={lineErrors?.ingredientId?.message}
                          options={(ingredients.data ?? []).map((item) => ({
                            value: item.id,
                            label: item.name,
                            hint: INGREDIENT_UNIT_LABELS[item.unit],
                          }))}
                        />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name={`ingredients.${index}.quantity`}
                      render={({ field: control }) => (
                        <NumericInput
                          value={control.value || null}
                          onChange={(value) => control.onChange(value ?? 0)}
                          decimals={4}
                          min={0}
                          suffix={ingredient ? INGREDIENT_UNIT_LABELS[ingredient.unit] : undefined}
                          error={lineErrors?.quantity?.message}
                        />
                      )}
                    />
                    <span className="pt-2.5 text-right text-[13px] text-ink-600 tabular">
                      {formatMoney((watchedLines?.[index]?.quantity ?? 0) * (ingredient?.costPrice ?? 0))}
                    </span>
                    <button
                      type="button"
                      aria-label="Убрать ингредиент"
                      onClick={() => recipe.remove(index)}
                      className="mt-1 rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
              {errors.ingredients?.root?.message || errors.ingredients?.message ? (
                <p className="text-xs font-medium text-danger-600">{errors.ingredients?.root?.message ?? errors.ingredients?.message}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap justify-end gap-x-5 gap-y-1 border-t border-ink-100 pt-2.5 text-[13px]">
                <span className="text-ink-500">
                  Себестоимость: <span className="font-semibold text-ink-900 tabular">{formatMoney(recipeCost)}</span>
                </span>
                {margin !== null && (
                  <span className="text-ink-500">
                    Наценка:{' '}
                    <span className={margin < 0 ? 'font-semibold text-danger-600' : 'font-semibold text-success-700'}>{formatPercent(Math.round(margin))}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
