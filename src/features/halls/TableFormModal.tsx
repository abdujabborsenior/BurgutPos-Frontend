import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { hallsApi, tablesApi } from '@/api/halls.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { TableView } from '@/api/types';
import { Button, Input, Modal, NumericInput, Select } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';

const schema = z.object({
  hallId: z
    .number()
    .nullable()
    .refine((value) => value !== null, 'Выберите зал'),
  name: z.string().trim().min(1, 'Укажите название стола').max(60, 'Не более 60 символов'),
  seats: z.number().int('Целое число').min(1, 'Не меньше 1').max(100, 'Не больше 100').nullable(),
  sortOrder: z.number().int('Целое число').min(0, 'Не меньше 0').max(100000, 'Не больше 100 000').nullable(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function TableFormModal({
  open,
  table,
  defaultHallId,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  table: TableView | null;
  /** Hall preselected when creating (e.g. the hall the list is filtered by). */
  defaultHallId: number | null;
  onClose: () => void;
}) {
  const hallsQuery = useQuery({ queryKey: qk.hallOptions, queryFn: hallsApi.options });
  const halls = hallsQuery.data ?? [];
  // A table of an archived hall stays editable: keep its hall selectable.
  const archivedHall =
    table && hallsQuery.isSuccess && !halls.some((hall) => hall.id === table.hall.id)
      ? [{ value: table.hall.id, label: `${table.hall.name} (в архиве)` }]
      : [];
  const hallOptions = [...halls.map((hall) => ({ value: hall.id, label: hall.name })), ...archivedHall];

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { hallId: null, name: '', seats: null, sortOrder: null },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      table
        ? { hallId: table.hall.id, name: table.name, seats: table.seats, sortOrder: table.sortOrder }
        : { hallId: defaultHallId, name: '', seats: null, sortOrder: null },
    );
  }, [open, table, defaultHallId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        hallId: values.hallId,
        name: values.name,
        seats: values.seats,
        sortOrder: values.sortOrder ?? undefined,
      };
      return table ? tablesApi.update(table.id, input) : tablesApi.create(input);
    },
    onSuccess: () => {
      toast.success(table ? 'Стол сохранён' : 'Стол создан');
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
      icon={<Armchair />}
      title={table ? 'Редактирование стола' : 'Новый стол'}
      description="Стол появится на экране столов в выбранном зале."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="table-form" loading={mutation.isPending}>
            {table ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="table-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Controller
          control={form.control}
          name="hallId"
          render={({ field }) => (
            <Select
              className="sm:col-span-2"
              label="Зал"
              required
              placeholder={hallsQuery.isLoading ? 'Загрузка…' : 'Выберите зал'}
              value={field.value}
              onChange={field.onChange}
              options={hallOptions}
              hint={hallsQuery.isSuccess && halls.length === 0 ? 'Сначала создайте зал в разделе «Залы»' : undefined}
              error={errors.hallId?.message}
            />
          )}
        />
        <Input
          containerClassName="sm:col-span-2"
          label="Название"
          required
          autoFocus
          maxLength={60}
          placeholder="Например: Стол 12 или ДИВАН 3"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="seats"
          render={({ field }) => (
            <NumericInput
              label="Мест"
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
        <Controller
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <NumericInput
              label="Порядок"
              hint="Пусто — в конец зала"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={0}
              max={100000}
              error={errors.sortOrder?.message}
            />
          )}
        />
      </form>
    </Modal>
  );
}
