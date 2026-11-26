import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { shiftsApi } from '@/api/shifts.api';
import type { ShiftDetail } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, plural } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { cashDifference, DIFFERENCE_LABELS, differenceKind, formatSignedMoney } from './cash';

const schema = z.object({
  closingCash: z
    .number()
    .min(0, 'Сумма не может быть отрицательной')
    .nullable()
    .refine((value) => value !== null, 'Укажите сумму наличных в кассе'),
  comment: z.string().trim().max(500, 'Не более 500 символов'),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const DIFFERENCE_TILE = {
  surplus: 'border-success-200 bg-success-50 text-success-700',
  shortage: 'border-danger-200 bg-danger-50 text-danger-700',
  exact: 'border-success-200 bg-success-50 text-success-700',
} as const;

export function CloseShiftModal({
  open,
  shift,
  onClose,
}: {
  open: boolean;
  shift: ShiftDetail;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const expected = shift.cash.expected;
  const openOrders = shift.summary.openOrders;
  // The API refuses to close a shift while any order is still open.
  const blocked = openOrders.count > 0;

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { closingCash: null, comment: '' },
  });

  useEffect(() => {
    if (open) form.reset({ closingCash: null, comment: '' });
  }, [open, form]);

  const counted = useWatch({ control: form.control, name: 'closingCash' });
  const difference = counted === null || counted === undefined ? null : cashDifference(counted, expected);
  const kind = difference === null ? null : differenceKind(difference);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => shiftsApi.close(values.closingCash, values.comment || undefined),
    onSuccess: (closed) => {
      queryClient.setQueryData(qk.shift(closed.id), closed);
      invalidateScopes('shift', 'dashboard', 'counters');
      toast.success(`Смена №${closed.id} закрыта`, {
        action: { label: 'Отчёт', onClick: () => navigate(`/shifts/history?shift=${closed.id}`) },
      });
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
      icon={<Lock />}
      title={`Закрытие смены №${shift.id}`}
      description="Пересчитайте наличные в кассе и укажите фактическую сумму."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="close-shift-form" loading={mutation.isPending} disabled={blocked}>
            Закрыть смену
          </Button>
        </>
      }
    >
      <form
        id="close-shift-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {blocked && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] leading-relaxed text-warning-700"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Есть незакрытые заказы: {openOrders.count} {plural(openOrders.count, ['заказ', 'заказа', 'заказов'])} на{' '}
                {formatCurrency(openOrders.total)}
              </p>
              <p className="mt-0.5">Закройте или отмените их — до этого смену закрыть нельзя.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-150 bg-ink-25 px-4 py-3">
            <p className="text-xs font-medium text-ink-500">Ожидается в кассе</p>
            <p className="mt-1 text-lg font-semibold text-brand-900 tabular">{formatCurrency(expected)}</p>
            <p className="mt-0.5 text-xs text-ink-500">Начало + наличные оплаты ± операции</p>
          </div>
          <div
            className={cn(
              'rounded-xl border px-4 py-3',
              kind ? DIFFERENCE_TILE[kind] : 'border-ink-150 bg-ink-25 text-ink-500',
            )}
            aria-live="polite"
          >
            <p className="text-xs font-medium">Расхождение</p>
            <p className="mt-1 text-lg font-semibold tabular">
              {difference === null ? '—' : `${formatSignedMoney(difference)} сум`}
            </p>
            <p className="mt-0.5 text-xs">{kind ? DIFFERENCE_LABELS[kind] : 'Появится после ввода суммы'}</p>
          </div>
        </div>

        <Controller
          control={form.control}
          name="closingCash"
          render={({ field }) => (
            <NumericInput
              label="Фактически в кассе"
              required
              autoFocus
              inputSize="lg"
              decimals={2}
              min={0}
              suffix="сум"
              placeholder="Пересчитанная сумма"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.closingCash?.message}
            />
          )}
        />
        <Textarea
          label="Комментарий"
          rows={2}
          maxLength={500}
          placeholder={difference ? 'Укажите причину расхождения' : 'Необязательно'}
          error={errors.comment?.message}
          {...form.register('comment')}
        />
      </form>
    </Modal>
  );
}
