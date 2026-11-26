import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { hallsApi } from '@/api/halls.api';
import { getErrorMessage } from '@/api/http';
import type { HallView } from '@/api/types';
import { Button, Input, Modal, NumericInput } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название зала').max(100, 'Не более 100 символов'),
  servicePercent: z.number().min(0, 'Не меньше 0').max(100, 'Не больше 100').nullable(),
  sortOrder: z.number().int('Целое число').min(0, 'Не меньше 0').max(100000, 'Не больше 100 000').nullable(),
});

type FormValues = z.infer<typeof schema>;

export function HallFormModal({
  open,
  hall,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  hall: HallView | null;
  onClose: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', servicePercent: null, sortOrder: null },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: hall?.name ?? '',
        servicePercent: hall?.servicePercent ?? null,
        sortOrder: hall?.sortOrder ?? null,
      });
    }
  }, [open, hall, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        name: values.name,
        // null is meaningful here: "take the percent from the settings".
        servicePercent: values.servicePercent,
        sortOrder: values.sortOrder ?? undefined,
      };
      return hall ? hallsApi.update(hall.id, input) : hallsApi.create(input);
    },
    onSuccess: () => {
      toast.success(hall ? 'Зал сохранён' : 'Зал создан');
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
      icon={<MapPin />}
      title={hall ? 'Редактирование зала' : 'Новый зал'}
      description="Залы группируют столы на экране кассы."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="hall-form" loading={mutation.isPending}>
            {hall ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="hall-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input
          label="Название"
          required
          autoFocus
          maxLength={100}
          placeholder="Например: Основной зал"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="servicePercent"
          render={({ field }) => (
            <NumericInput
              label="Процент обслуживания"
              hint="Процент этого зала к сумме заказа. Пусто — как в настройках заведения."
              suffix="%"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={0}
              max={100}
              decimals={2}
              error={errors.servicePercent?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <NumericInput
              label="Порядок"
              hint="Чем меньше число, тем раньше зал в списках и на экране столов. Пусто — в конец."
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
