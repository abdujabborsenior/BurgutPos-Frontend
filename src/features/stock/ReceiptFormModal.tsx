import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Info, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { dishesApi, type DishOption } from '@/api/menu.api';
import { ingredientsApi, stockApi, type ReceiptLineInput } from '@/api/stock.api';
import type { DishUnit, IngredientOption, StockItemType, StockLocation } from '@/api/types';
import {
  Button,
  Combobox,
  IconButton,
  Modal,
  NumericInput,
  Segmented,
  Select,
  Textarea,
  useConfirm,
  type SelectOption,
} from '@/components/ui';
import { formatMoney, plural } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import {
  commentSchema,
  isFractionalDishUnit,
  MAX_COMMENT,
  MAX_PRICE,
  MAX_RECEIPT_LINES,
  MAX_STOCK_QTY,
  qtyDecimals,
  RECEIPT_LOCATION_LABELS,
  requiredNumber,
  roundTo,
  unitLabel,
} from './stock.utils';

const UNITS = ['PCS', 'PORTION', 'KG', 'L', 'G', 'ML'] as const;

const lineSchema = z
  .object({
    itemType: z.enum(['DISH', 'INGREDIENT']),
    /** Dish or ingredient id, depending on itemType. */
    itemId: requiredNumber('Выберите позицию'),
    unit: z.enum(UNITS).nullable(),
    location: z.enum(['WAREHOUSE', 'SALE']),
    quantity: requiredNumber('Укажите количество', (value) =>
      value.min(0.001, 'Количество должно быть больше нуля').max(MAX_STOCK_QTY, 'Слишком большое количество'),
    ),
    purchasePrice: requiredNumber('Укажите цену закупки', (value) =>
      value.min(0, 'Цена не может быть отрицательной').max(MAX_PRICE, 'Слишком большая цена'),
    ),
    salePrice: z.number().min(0, 'Цена не может быть отрицательной').max(MAX_PRICE, 'Слишком большая цена').nullable(),
  })
  .superRefine((line, ctx) => {
    const piecewise = line.itemType === 'DISH' && line.unit !== null && !isFractionalDishUnit(line.unit as DishUnit);
    if (piecewise && !Number.isInteger(line.quantity)) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Позиция учитывается поштучно — укажите целое количество' });
    }
  });

const schema = z.object({
  items: z
    .array(lineSchema)
    .min(1, 'Добавьте хотя бы одну позицию')
    .max(MAX_RECEIPT_LINES, `Не более ${MAX_RECEIPT_LINES} позиций за раз`),
  comment: commentSchema,
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type LineInput = FormInput['items'][number];
type LineOutput = FormOutput['items'][number];

const TYPE_ITEMS: { value: StockItemType; label: string }[] = [
  { value: 'DISH', label: 'Товар' },
  { value: 'INGREDIENT', label: 'Ингредиент' },
];

const LOCATION_OPTIONS: SelectOption<StockLocation>[] = [
  { value: 'WAREHOUSE', label: RECEIPT_LOCATION_LABELS.WAREHOUSE },
  { value: 'SALE', label: RECEIPT_LOCATION_LABELS.SALE },
];

const emptyLine = (itemType: StockItemType = 'DISH', location: StockLocation = 'WAREHOUSE'): LineInput => ({
  itemType,
  itemId: null,
  unit: null,
  location,
  quantity: null,
  purchasePrice: null,
  salePrice: null,
});

const lineTotal = (quantity: number | null, price: number | null): number | null =>
  quantity === null || price === null ? null : roundTo(quantity * price, 2);

function toPayload(line: LineOutput): ReceiptLineInput {
  if (line.itemType === 'INGREDIENT') {
    return { itemType: 'INGREDIENT', ingredientId: line.itemId, quantity: line.quantity, purchasePrice: line.purchasePrice };
  }
  return {
    itemType: 'DISH',
    dishId: line.itemId,
    location: line.location,
    quantity: line.quantity,
    purchasePrice: line.purchasePrice,
    ...(line.salePrice !== null ? { salePrice: line.salePrice } : {}),
  };
}

interface Catalog {
  loading: boolean;
  dishOptions: SelectOption<number>[];
  dishById: Map<number, DishOption>;
  ingredientOptions: SelectOption<number>[];
  ingredientById: Map<number, IngredientOption>;
}

/** Приход: several dishes/goods and ingredients in one document. */
export function ReceiptFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const confirm = useConfirm();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { items: [emptyLine()], comment: '' },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    if (open) form.reset({ items: [emptyLine()], comment: '' });
  }, [open, form]);

  const dishes = useQuery({
    queryKey: qk.dishOptions,
    queryFn: () => dishesApi.options(),
    enabled: open,
    staleTime: 60_000,
  });
  const ingredients = useQuery({
    queryKey: qk.ingredientOptions,
    queryFn: () => ingredientsApi.options(),
    enabled: open,
    staleTime: 60_000,
  });
  const catalog = useMemo<Catalog>(() => {
    const dishList = dishes.data ?? [];
    const ingredientList = ingredients.data ?? [];
    return {
      loading: dishes.isLoading || ingredients.isLoading,
      dishOptions: dishList.map((dish) => ({ value: dish.id, label: dish.name, hint: dish.categoryName })),
      dishById: new Map(dishList.map((dish) => [dish.id, dish])),
      ingredientOptions: ingredientList.map((item) => ({
        value: item.id,
        label: item.name,
        hint: `Единица: ${unitLabel(item.unit)}`,
      })),
      ingredientById: new Map(ingredientList.map((item) => [item.id, item])),
    };
  }, [dishes.data, dishes.isLoading, ingredients.data, ingredients.isLoading]);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      stockApi.createReceipts(values.items.map(toPayload), values.comment || undefined),
    onSuccess: ({ created }) => {
      toast.success(`Приход оформлен: ${created} ${plural(created, ['позиция', 'позиции', 'позиций'])}`);
      invalidateScopes('stock', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Read during render: RHF only tracks the formState fields a component reads.
  const { isDirty, isSubmitted, errors } = form.formState;

  const requestClose = async () => {
    if (mutation.isPending) return;
    if (isDirty) {
      const ok = await confirm({
        title: 'Закрыть без сохранения?',
        description: 'Заполненные строки прихода будут потеряны.',
        confirmText: 'Закрыть',
        cancelText: 'Продолжить ввод',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  const addLine = () => {
    const last = form.getValues(`items.${fields.length - 1}`);
    append(emptyLine(last?.itemType, last?.location), { shouldFocus: false });
  };

  const atLimit = fields.length >= MAX_RECEIPT_LINES;

  return (
    <Modal
      open={open}
      onClose={() => void requestClose()}
      locked={mutation.isPending}
      size="xl"
      icon={<PackagePlus />}
      title="Новый приход"
      description="Добавьте поступившие товары и ингредиенты — остаток увеличится сразу после сохранения."
      footer={
        <>
          <ReceiptTotals control={form.control} />
          <Button variant="secondary" onClick={() => void requestClose()} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="receipt-form" loading={mutation.isPending}>
            Оформить приход
          </Button>
        </>
      }
    >
      <form
        id="receipt-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="flex gap-3 rounded-xl border border-ink-150 bg-ink-25 px-4 py-3 text-[13px] leading-relaxed text-ink-600">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-400" />
          <p>
            Приход товара автоматически включает для него учёт остатка. Цена продажи, отличная от текущей, сразу
            обновит цену в меню.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <ReceiptLine
              key={field.id}
              index={index}
              control={form.control}
              setValue={form.setValue}
              catalog={catalog}
              revalidate={isSubmitted}
              autoFocus={index > 0 && index === fields.length - 1}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand-soft" size="sm" leftIcon={<Plus className="size-4" />} onClick={addLine} disabled={atLimit}>
            Добавить строку
          </Button>
          {atLimit && <span className="text-xs text-ink-500">Не более {MAX_RECEIPT_LINES} строк в одном приходе</span>}
        </div>

        <Textarea
          label="Комментарий"
          rows={2}
          maxLength={MAX_COMMENT}
          placeholder="Например: поставщик, номер накладной"
          error={errors.comment?.message}
          {...form.register('comment')}
        />
      </form>
    </Modal>
  );
}

function ReceiptLine({
  index,
  control,
  setValue,
  catalog,
  revalidate,
  autoFocus,
  canRemove,
  onRemove,
}: {
  index: number;
  control: Control<FormInput, unknown, FormOutput>;
  setValue: UseFormSetValue<FormInput>;
  catalog: Catalog;
  /** After the first submit dependent fields are re-validated as they change. */
  revalidate: boolean;
  autoFocus: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const line = useWatch({ control, name: `items.${index}` });
  // A removed row may render once more before it unmounts.
  if (!line) return null;
  const isDish = line.itemType === 'DISH';
  const dish = isDish && line.itemId !== null ? catalog.dishById.get(line.itemId) : undefined;
  const total = lineTotal(line.quantity, line.purchasePrice);
  const options = { shouldDirty: true, shouldValidate: revalidate };

  const changeType = (itemType: StockItemType) => {
    if (itemType === line.itemType) return;
    setValue(`items.${index}`, emptyLine(itemType, line.location), options);
  };

  /** Selecting a position brings its unit, menu price and last purchase price along. */
  const selectItem = (id: number | null) => {
    setValue(`items.${index}.itemId`, id, { shouldDirty: true, shouldValidate: revalidate || id !== null });
    if (id === null) return;
    if (isDish) {
      const selected = catalog.dishById.get(id);
      if (!selected) return;
      setValue(`items.${index}.unit`, selected.unit, options);
      setValue(`items.${index}.salePrice`, selected.price, options);
      setValue(`items.${index}.purchasePrice`, selected.costPrice > 0 ? selected.costPrice : null, options);
    } else {
      const selected = catalog.ingredientById.get(id);
      if (!selected) return;
      setValue(`items.${index}.unit`, selected.unit, options);
      setValue(`items.${index}.purchasePrice`, selected.costPrice > 0 ? selected.costPrice : null, options);
    }
  };

  const salePriceHint = () => {
    if (!dish) return 'Цена в меню';
    if (line.salePrice === null) return `Пусто — останется ${formatMoney(dish.price)}`;
    if (line.salePrice !== dish.price) return `Цена в меню изменится: было ${formatMoney(dish.price)}`;
    return 'Совпадает с ценой в меню';
  };

  const half = isDish ? 'sm:col-span-2' : 'sm:col-span-3';

  return (
    <div className="rounded-xl border border-ink-150 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-ink-100 text-xs font-semibold text-ink-600 tabular">
          {index + 1}
        </span>
        <Segmented size="sm" items={TYPE_ITEMS} value={line.itemType} onChange={changeType} />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-ink-500">
            Сумма: <span className="font-semibold text-ink-900 tabular">{total === null ? '—' : formatMoney(total)}</span>
          </span>
          <IconButton
            label="Удалить строку"
            icon={<Trash2 />}
            size="sm"
            variant="danger"
            disabled={!canRemove}
            onClick={onRemove}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <Controller
          control={control}
          name={`items.${index}.itemId`}
          render={({ fieldState }) => (
            <Combobox
              className={isDish ? 'sm:col-span-4' : 'sm:col-span-6'}
              label={isDish ? 'Товар' : 'Ингредиент'}
              required
              autoFocus={autoFocus}
              value={line.itemId}
              onChange={selectItem}
              options={isDish ? catalog.dishOptions : catalog.ingredientOptions}
              placeholder={catalog.loading ? 'Загрузка…' : isDish ? 'Начните вводить название товара' : 'Начните вводить название ингредиента'}
              emptyText={isDish ? 'Товар не найден' : 'Ингредиент не найден'}
              error={fieldState.error?.message}
            />
          )}
        />
        {isDish && (
          <Controller
            control={control}
            name={`items.${index}.location`}
            render={({ field }) => (
              <Select
                className="sm:col-span-2"
                label="Куда"
                value={field.value}
                onChange={field.onChange}
                options={LOCATION_OPTIONS}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name={`items.${index}.quantity`}
          render={({ field, fieldState }) => (
            <NumericInput
              containerClassName={half}
              label="Количество"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              decimals={line.unit === null ? 3 : qtyDecimals(line.itemType, line.unit)}
              min={0}
              max={MAX_STOCK_QTY}
              suffix={unitLabel(line.unit)}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name={`items.${index}.purchasePrice`}
          render={({ field, fieldState }) => (
            <NumericInput
              containerClassName={half}
              label={isDish ? 'Цена закупки' : 'Цена закупки за единицу'}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              decimals={2}
              min={0}
              max={MAX_PRICE}
              suffix="сум"
              error={fieldState.error?.message}
            />
          )}
        />
        {isDish && (
          <Controller
            control={control}
            name={`items.${index}.salePrice`}
            render={({ field, fieldState }) => (
              <NumericInput
                containerClassName="sm:col-span-2"
                label="Цена продажи"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                decimals={2}
                min={0}
                max={MAX_PRICE}
                suffix="сум"
                error={fieldState.error?.message}
                hint={salePriceHint()}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}

/** Footer summary: lines count and the grand total, live. */
function ReceiptTotals({ control }: { control: Control<FormInput, unknown, FormOutput> }) {
  const items = useWatch({ control, name: 'items' }) ?? [];
  const total = items.reduce((sum, line) => sum + (lineTotal(line?.quantity ?? null, line?.purchasePrice ?? null) ?? 0), 0);
  return (
    <div className="mr-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-600">
      <span>
        {items.length} {plural(items.length, ['строка', 'строки', 'строк'])}
      </span>
      <span className="text-ink-300">·</span>
      <span>
        Итого: <span className="text-base font-semibold text-ink-900 tabular">{formatMoney(roundTo(total, 2))}</span> сум
      </span>
    </div>
  );
}
