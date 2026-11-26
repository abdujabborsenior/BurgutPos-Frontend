import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { shiftsApi } from '@/api/shifts.api';
import type { CashOperationType } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { formatCurrency, formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';

/** Mirrors the API: positive amount, and a withdrawal cannot exceed the cash expected in the drawer. */
function buildSchema(type: CashOperationType, available: number) {
  return z.object({
    amount: z
      .number()
      .nullable()
      .refine((value) => value !== null, 'Укажите сумму')
      .refine((value) => value > 0, 'Сумма должна быть больше нуля')
      .refine(
        (value) => type === 'IN' || value <= available,
        `Не больше ${formatMoney(Math.max(available, 0))} сум — столько ожидается в кассе`,
      ),
    comment: z.string().trim().min(1, 'Укажите комментарий к операции').max(500, 'Не более 500 символов'),
  });
}

type Schema = ReturnType<typeof buildSchema>;
type FormInput = z.input<Schema>;
type FormValues = z.output<Schema>;

const COPY: Record<CashOperationType, { title: string; description: string; placeholder: string; submit: string; done: string }> = {
  IN: {
    title: 'Внесение наличных',
    description: 'Наличные, добавленные в кассу в течение смены.',
    placeholder: 'Например: размен из сейфа',
    submit: 'Внести',
    done: 'Внесение проведено',
  },
  OUT: {
    title: 'Изъятие наличных',
    description: 'Наличные, изъятые из кассы в течение смены.',
    placeholder: 'Например: инкассация, оплата поставщику',
    submit: 'Изъять',
    done: 'Изъятие проведено',
  },
};

export function CashOperationModal({
  open,
  type,
  expectedCash,
  onClose,
}: {
  open: boolean;
  type: CashOperationType;
  /** Cash currently expected in the drawer. */
  expectedCash: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const copy = COPY[type];
  const withdrawal = type === 'OUT';
  const nothingToWithdraw = withdrawal && expectedCash <= 0;
  const schema = useMemo(() => buildSchema(type, expectedCash), [type, expectedCash]);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: null, comment: '' },
  });

  useEffect(() => {
    if (open) form.reset({ amount: null, comment: '' });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => shiftsApi.cashOperation({ type, amount: values.amount, comment: values.comment }),
    onSuccess: (shift, values) => {
      queryClient.setQueryData(qk.shiftCurrent, shift);
      invalidateScopes('shift');
      toast.success(copy.done, { description: `${formatCurrency(values.amount)} · ${values.comment}` });
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
      size="sm"
      icon={withdrawal ? <ArrowUpFromLine /> : <ArrowDownToLine />}
      title={copy.title}
      description={copy.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="cash-operation-form"
            loading={mutation.isPending}
            disabled={nothingToWithdraw}
          >
            {copy.submit}
          </Button>
        </>
      }
    >
      <form
        id="cash-operation-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <NumericInput
              label="Сумма"
              required
              autoFocus
              inputSize="lg"
              decimals={2}
              min={0}
              suffix="сум"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.amount?.message}
              hint={
                withdrawal ? (
                  nothingToWithdraw ? (
                    'В кассе нет наличных для изъятия'
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span>
                        Доступно в кассе: <span className="font-semibold text-ink-700 tabular">{formatCurrency(expectedCash)}</span>
                      </span>
                      <button
                        type="button"
                        className="font-semibold text-brand-700 hover:text-brand-900 hover:underline"
                        onClick={() => form.setValue('amount', expectedCash, { shouldDirty: true, shouldValidate: true })}
                      >
                        Изъять всё
                      </button>
                    </span>
                  )
                ) : (
                  <>
                    Сейчас в кассе: <span className="font-semibold text-ink-700 tabular">{formatCurrency(expectedCash)}</span>
                  </>
                )
              }
            />
          )}
        />
        <Textarea
          label="Комментарий"
          required
          rows={2}
          maxLength={500}
          placeholder={copy.placeholder}
          error={errors.comment?.message}
          {...form.register('comment')}
        />
      </form>
    </Modal>
  );
}
