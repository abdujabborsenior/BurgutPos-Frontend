import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CopyPlus } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { hallsApi, tablesApi } from '@/api/halls.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { Button, Input, Modal, NumericInput, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';

/** Server limit for one bulk request (halls.service.ts). */
const MAX_TABLES = 100;

const number = z
  .number()
  .int('Целое число')
  .min(1, 'Не меньше 1')
  .max(9999, 'Не больше 9999')
  .nullable()
  .refine((value) => value !== null, 'Укажите номер');

const schema = z
  .object({
    hallId: z
      .number()
      .nullable()
      .refine((value) => value !== null, 'Выберите зал'),
    prefix: z.string().trim().min(1, 'Укажите префикс').max(50, 'Не более 50 символов'),
    from: number,
    to: number,
    seats: z.number().int('Целое число').min(1, 'Не меньше 1').max(100, 'Не больше 100').nullable(),
  })
  .refine((data) => data.from <= data.to, { message: 'Не меньше начального номера', path: ['to'] })
  .refine((data) => data.to - data.from + 1 <= MAX_TABLES, {
    message: `За один раз — не более ${MAX_TABLES} столов`,
    path: ['to'],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const tablesWord = (count: number) => plural(count, ['стол', 'стола', 'столов']);

/** Mirrors how the server builds names: trimmed prefix with collapsed spaces + " " + number. */
const tableName = (prefix: string, index: number) => `${prefix.trim().replace(/\s+/g, ' ')} ${index}`;

function Preview({ prefix, from, to }: { prefix: string; from: number | null; to: number | null }) {
  const ready = prefix.trim() !== '' && from !== null && to !== null;
  const count = ready ? to - from + 1 : 0;
  const invalid = ready && (count < 1 || count > MAX_TABLES);

  let names: (string | null)[] = [];
  if (ready && !invalid) {
    names =
      count <= 4
        ? Array.from({ length: count }, (_, index) => tableName(prefix, from + index))
        : [tableName(prefix, from), tableName(prefix, from + 1), null, tableName(prefix, to)];
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3.5 sm:col-span-2',
        invalid ? 'border-danger-200 bg-danger-50' : 'border-brand-100 bg-brand-50/60',
      )}
      aria-live="polite"
    >
      {!ready ? (
        <p className="text-[13px] text-ink-500">Укажите префикс и диапазон номеров — здесь появится список столов.</p>
      ) : invalid ? (
        <p className="text-[13px] font-medium text-danger-700">
          {count < 1
            ? 'Начальный номер больше конечного'
            : `Слишком много столов: ${count}. За один раз — не более ${MAX_TABLES}`}
        </p>
      ) : (
        <>
          <p className="text-[13px] font-semibold text-brand-900">
            {plural(count, ['Будет создан', 'Будут созданы', 'Будут созданы'])}: {count} {tablesWord(count)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {names.map((name, index) =>
              name === null ? (
                <span key={`gap-${index}`} className="px-1 text-ink-400">
                  …
                </span>
              ) : (
                <span
                  key={name}
                  className="rounded-lg border border-ink-150 bg-white px-2.5 py-1 text-xs font-semibold text-ink-800"
                >
                  {name}
                </span>
              ),
            )}
          </div>
          <p className="mt-2.5 text-xs text-ink-500">Столы, которые уже есть в зале, будут пропущены.</p>
        </>
      )}
    </div>
  );
}

export function BulkTablesModal({
  open,
  defaultHallId,
  onClose,
}: {
  open: boolean;
  defaultHallId: number | null;
  onClose: () => void;
}) {
  const hallsQuery = useQuery({ queryKey: qk.hallOptions, queryFn: hallsApi.options });
  const halls = hallsQuery.data ?? [];

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { hallId: null, prefix: 'Стол', from: 1, to: 10, seats: null },
  });

  useEffect(() => {
    if (open) form.reset({ hallId: defaultHallId, prefix: 'Стол', from: 1, to: 10, seats: null });
  }, [open, defaultHallId, form]);

  const [prefix, from, to] = useWatch({ control: form.control, name: ['prefix', 'from', 'to'] });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      tablesApi.bulkCreate({
        hallId: values.hallId,
        prefix: values.prefix,
        from: values.from,
        to: values.to,
        seats: values.seats,
      }),
    onSuccess: ({ created, skipped }) => {
      if (created === 0) {
        toast.warning(`Новых столов нет: все ${skipped} ${tablesWord(skipped)} уже существуют`);
      } else if (skipped > 0) {
        toast.success(`Создано ${created}, пропущено ${skipped} (уже существуют)`);
      } else {
        toast.success(`Создано ${created} ${tablesWord(created)}`);
      }
      invalidateScopes('halls');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const { errors } = form.formState;
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      size="lg"
      icon={<CopyPlus />}
      title="Создать несколько столов"
      description="Столы получат названия из префикса и номера: «Стол 1», «Стол 2» и так далее."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="bulk-tables-form" loading={mutation.isPending}>
            Создать столы
          </Button>
        </>
      }
    >
      <form
        id="bulk-tables-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Controller
          control={form.control}
          name="hallId"
          render={({ field }) => (
            <Select
              label="Зал"
              required
              placeholder={hallsQuery.isLoading ? 'Загрузка…' : 'Выберите зал'}
              value={field.value}
              onChange={field.onChange}
              options={halls.map((hall) => ({ value: hall.id, label: hall.name }))}
              hint={hallsQuery.isSuccess && halls.length === 0 ? 'Сначала создайте зал в разделе «Залы»' : undefined}
              error={errors.hallId?.message}
            />
          )}
        />
        <Input
          label="Префикс названия"
          required
          autoFocus
          maxLength={50}
          placeholder="Например: ДИВАН"
          error={errors.prefix?.message}
          {...form.register('prefix')}
        />
        <Controller
          control={form.control}
          name="from"
          render={({ field }) => (
            <NumericInput
              label="Первый номер"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={1}
              max={9999}
              error={errors.from?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="to"
          render={({ field }) => (
            <NumericInput
              label="Последний номер"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={1}
              max={9999}
              error={errors.to?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="seats"
          render={({ field }) => (
            <NumericInput
              containerClassName="sm:col-span-2"
              label="Мест за каждым столом"
              hint="Необязательно"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={1}
              max={100}
              error={errors.seats?.message}
            />
          )}
        />
        <Preview prefix={prefix ?? ''} from={from ?? null} to={to ?? null} />
      </form>
    </Modal>
  );
}
