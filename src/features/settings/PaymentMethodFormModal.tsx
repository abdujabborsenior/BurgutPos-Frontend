import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { paymentMethodsApi } from '@/api/settings.api';
import type { PaymentMethodType, PaymentMethodView } from '@/api/types';
import { Button, Input, Modal, NumericInput, Select } from '@/components/ui';
import { PAYMENT_TYPE_LABELS } from '@/lib/labels';
import { invalidateScopes } from '@/lib/realtime';

const TYPE_HINTS: Record<PaymentMethodType, string> = {
  CASH: 'Выдача сдачи, учитываются в кассе смены',
  CARD: 'Терминал банка: Uzcard, Humo, Visa',
  ONLINE: 'Click, Payme и другие сервисы',
  OTHER: 'Сертификаты, перевод на счёт и прочее',
};

const TYPE_OPTIONS = (Object.keys(PAYMENT_TYPE_LABELS) as PaymentMethodType[]).map((type) => ({
  value: type,
  label: PAYMENT_TYPE_LABELS[type],
  hint: TYPE_HINTS[type],
}));

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(60, 'Не более 60 символов'),
  type: z
    .enum(['CASH', 'CARD', 'ONLINE', 'OTHER'])
    .nullable()
    .refine((value) => value !== null, 'Выберите тип'),
  sortOrder: z.number().int('Целое число').min(0, 'Не меньше 0').max(100000, 'Не больше 100 000').nullable(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function PaymentMethodFormModal({
  open,
  method,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  method: PaymentMethodView | null;
  onClose: () => void;
}) {
  // The server refuses to change the type once payments were taken with the method.
  const typeLocked = Boolean(method && method.paymentsCount > 0);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: null, sortOrder: null },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: method?.name ?? '', type: method?.type ?? null, sortOrder: method?.sortOrder ?? null });
    }
  }, [open, method, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const sortOrder = values.sortOrder ?? undefined;
      if (method) {
        return paymentMethodsApi.update(method.id, {
          name: values.name,
          sortOrder,
          ...(typeLocked ? {} : { type: values.type }),
        });
      }
      return paymentMethodsApi.create({ name: values.name, type: values.type, sortOrder });
    },
    onSuccess: () => {
      toast.success(method ? 'Способ оплаты сохранён' : 'Способ оплаты создан');
      invalidateScopes('payment-methods');
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
      icon={<CreditCard />}
      title={method ? 'Редактирование способа оплаты' : 'Новый способ оплаты'}
      description="Способы оплаты доступны кассиру при закрытии заказа."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="payment-method-form" loading={mutation.isPending}>
            {method ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="payment-method-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input
          label="Название"
          required
          autoFocus
          maxLength={60}
          placeholder="Например: Uzcard"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select
              label="Тип"
              required
              placeholder="Выберите тип"
              value={field.value}
              onChange={field.onChange}
              options={TYPE_OPTIONS}
              disabled={typeLocked}
              hint={
                typeLocked
                  ? 'Тип нельзя изменить: этим способом уже принимались оплаты. Для другого типа создайте новый способ.'
                  : '«Наличные» позволяют выдавать сдачу и учитываются в кассе смены'
              }
              error={errors.type?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <NumericInput
              label="Порядок"
              hint="Чем меньше число, тем раньше способ на экране оплаты. Пусто — в конец."
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
