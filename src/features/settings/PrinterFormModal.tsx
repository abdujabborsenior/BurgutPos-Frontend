import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { printersApi } from '@/api/settings.api';
import type { PrinterConnection, PrinterView } from '@/api/types';
import { Button, Field, Input, Modal, NumericInput, Segmented, Switch } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';

const HOST = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,118}[a-zA-Z0-9])?$/;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Укажите название принтера').max(60, 'Не более 60 символов'),
    connection: z.enum(['LAN', 'USB']),
    host: z.string().trim().max(120, 'Не более 120 символов'),
    port: z
      .number()
      .int('Целое число')
      .min(1, 'От 1 до 65535')
      .max(65535, 'От 1 до 65535')
      .nullable(),
    isDefault: z.boolean(),
  })
  // A network printer is useless without an address; a USB one needs none.
  .refine((values) => values.connection !== 'LAN' || values.host.length > 0, {
    path: ['host'],
    message: 'Укажите IP-адрес принтера',
  })
  .refine((values) => values.connection !== 'LAN' || HOST.test(values.host), {
    path: ['host'],
    message: 'Укажите IP-адрес или имя принтера',
  });

const CONNECTION_ITEMS: { value: PrinterConnection; label: string }[] = [
  { value: 'LAN', label: 'LAN' },
  { value: 'USB', label: 'USB' },
];

/** What each connection means for printing — shown under the switch. */
const CONNECTION_HINTS: Record<PrinterConnection, string> = {
  LAN: 'Сетевой принтер: сервер печатает на него по IP-адресу.',
  USB: 'Подключён к компьютеру кассы: печатает браузер этого терминала.',
};

/** Standard port of an ESC/POS network printer. */
const DEFAULT_PORT = 9100;

type FormValues = z.infer<typeof schema>;

/**
 * Add / edit a printer, as in the reference: name, LAN or USB, IP and port
 * for a network printer, and the default switch. The description and the
 * list order a printer may already have are kept as they are.
 */
export function PrinterFormModal({
  open,
  printer,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  printer: PrinterView | null;
  onClose: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', connection: 'LAN', host: '', port: DEFAULT_PORT, isDefault: false },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: printer?.name ?? '',
        connection: printer?.connection ?? 'LAN',
        host: printer?.host ?? '',
        port: printer?.port ?? DEFAULT_PORT,
        isDefault: printer?.isDefault ?? false,
      });
    }
  }, [open, printer, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const lan = values.connection === 'LAN';
      const input = {
        name: values.name,
        connection: values.connection,
        host: lan ? values.host : null,
        port: lan ? (values.port ?? DEFAULT_PORT) : null,
        isDefault: values.isDefault,
      };
      return printer ? printersApi.update(printer.id, input) : printersApi.create(input);
    },
    onSuccess: () => {
      toast.success(printer ? 'Принтер сохранён' : 'Принтер добавлен');
      invalidateScopes('printers', 'menu');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const connection = useWatch({ control: form.control, name: 'connection' });
  const { errors } = form.formState;
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      size="sm"
      icon={<Printer />}
      title={printer ? 'Изменить' : 'Добавить'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="printer-form" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="printer-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input
          label="Принтер"
          required
          autoFocus
          maxLength={60}
          placeholder="Например: KASSA, ОШХОНА, БАР"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Controller
          control={form.control}
          name="connection"
          render={({ field }) => (
            <Field label="Тип" hint={CONNECTION_HINTS[field.value]}>
              <Segmented items={CONNECTION_ITEMS} value={field.value} onChange={field.onChange} />
            </Field>
          )}
        />
        {connection === 'LAN' && (
          <>
            <Input
              label="IP"
              required
              maxLength={120}
              placeholder="192.168.1.50"
              inputMode="decimal"
              error={errors.host?.message}
              {...form.register('host')}
            />
            <Controller
              control={form.control}
              name="port"
              render={({ field }) => (
                <NumericInput
                  label="Port"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  min={1}
                  max={65535}
                  grouping={false}
                  hint="Обычно 9100"
                  error={errors.port?.message}
                />
              )}
            />
          </>
        )}
        <Controller
          control={form.control}
          name="isDefault"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onChange={field.onChange}
              label="Принтер по умолчанию"
              description="Счета, чеки, отчёты и бегунки блюд без своего принтера"
            />
          )}
        />
      </form>
    </Modal>
  );
}
