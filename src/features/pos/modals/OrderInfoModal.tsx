import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ClipboardEdit } from 'lucide-react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail, OrderType } from '@/api/types';
import { Button, Input, Modal, NumericInput, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { orderInfoSchema, type OrderInfoValues } from './orderInfo';

/** Fields shared by the "new order" draft and the edit modal. */
export function OrderInfoFields({ type, form }: { type: OrderType; form: UseFormReturn<OrderInfoValues> }) {
  const { errors } = form.formState;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {type === 'TABLE' || type === 'HALL' ? (
        <Controller
          control={form.control}
          name="guests"
          render={({ field }) => (
            <NumericInput label="Гостей" value={field.value} onChange={field.onChange} min={1} max={500} error={errors.guests?.message} />
          )}
        />
      ) : null}
      {type !== 'TABLE' && (
        <Input label="Имя клиента" error={errors.customerName?.message} {...form.register('customerName')} />
      )}
      {type !== 'TABLE' && (
        <Input
          label="Телефон"
          required={type === 'DELIVERY'}
          type="tel"
          placeholder="+998 90 123 45 67"
          error={errors.customerPhone?.message}
          {...form.register('customerPhone')}
        />
      )}
      {type === 'DELIVERY' && (
        <>
          <Input
            label="Адрес доставки"
            required
            containerClassName="sm:col-span-2"
            error={errors.deliveryAddress?.message}
            {...form.register('deliveryAddress')}
          />
          <Controller
            control={form.control}
            name="deliveryFee"
            render={({ field }) => (
              <NumericInput label="Стоимость доставки" value={field.value} onChange={field.onChange} min={0} suffix="сум" error={errors.deliveryFee?.message} />
            )}
          />
        </>
      )}
      <Textarea label="Комментарий к заказу" rows={2} containerClassName="sm:col-span-2" error={errors.comment?.message} {...form.register('comment')} />
    </div>
  );
}

function OrderInfoForm({ order, onDone, onCancel }: { order: OrderDetail; onDone: (order: OrderDetail) => void; onCancel: () => void }) {
  const form = useForm<OrderInfoValues>({
    resolver: zodResolver(orderInfoSchema(order.type)),
    defaultValues: {
      guests: order.guests,
      customerName: order.customerName ?? '',
      customerPhone: order.customerPhone ?? '',
      deliveryAddress: order.deliveryAddress ?? '',
      deliveryFee: order.type === 'DELIVERY' ? order.deliveryFee : null,
      comment: order.comment ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: OrderInfoValues) =>
      ordersApi.update(order.id, {
        guests: values.guests,
        customerName: values.customerName || null,
        customerPhone: values.customerPhone || null,
        comment: values.comment || null,
        ...(order.type === 'DELIVERY' ? { deliveryAddress: values.deliveryAddress, deliveryFee: values.deliveryFee ?? 0 } : {}),
      }),
    onSuccess: (updated) => {
      toast.success('Данные заказа сохранены');
      invalidateScopes('board', 'orders');
      onDone(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <OrderInfoFields type={order.type} form={form} />
      <div className="-mx-6 mt-6 -mb-5 flex justify-end gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
        <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Отмена
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

export function OrderInfoModal({ order, onClose, onSaved }: { order: OrderDetail | null; onClose: () => void; onSaved?: (order: OrderDetail) => void }) {
  return (
    <Modal open={order !== null} onClose={onClose} size="lg" icon={<ClipboardEdit />} title="Данные заказа">
      {order && (
        <OrderInfoForm
          key={order.id}
          order={order}
          onCancel={onClose}
          onDone={(updated) => {
            onSaved?.(updated);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
