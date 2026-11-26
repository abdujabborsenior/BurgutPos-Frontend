import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent, Printer, ReceiptText, RotateCcw, Save, Store, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { settingsApi } from '@/api/settings.api';
import type { OrderType, Settings } from '@/api/types';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
  NumericInput,
  PageHeader,
  Skeleton,
  Switch,
  Textarea,
} from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { ORDER_TYPE_LABELS } from '@/lib/labels';
import { ReceiptPreview } from './ReceiptPreview';

const ORDER_TYPES: OrderType[] = ['TABLE', 'TAKEAWAY', 'DELIVERY', 'HALL'];

// Same rule as the API (settings/dto/settings.dto.ts).
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

const percent = z
  .number()
  .min(0, 'Не меньше 0')
  .max(100, 'Не больше 100')
  .nullable()
  .refine((value) => value !== null, 'Укажите значение, 0 — не начислять');

const schema = z.object({
  restaurantName: z
    .string()
    .trim()
    .min(1, 'Укажите название заведения')
    .max(120, 'Не более 120 символов'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || PHONE_RE.test(value.replace(/\s+/g, ' ')),
      'Некорректный номер телефона',
    ),
  address: z.string().trim().max(255, 'Не более 255 символов'),
  receiptHeader: z.string().trim().max(500, 'Не более 500 символов'),
  receiptFooter: z.string().trim().max(500, 'Не более 500 символов'),
  serviceChargePercent: percent,
  serviceChargeOrderTypes: z.array(z.enum(['TABLE', 'TAKEAWAY', 'DELIVERY', 'HALL'])),
  waiterCommissionPercent: percent,
  allowNegativeStock: z.boolean(),
  autoPrintKitchenTicket: z.boolean(),
  autoPrintReceipt: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
/** The fields this page edits; the receipt designer owns the rest. */
type SettingsInput = Omit<Settings, 'updatedAt' | 'orderCheck' | 'dishCheck' | 'logoUrl'>;

function toFormValues(settings: Settings): FormInput {
  return {
    restaurantName: settings.restaurantName,
    phone: settings.phone ?? '',
    address: settings.address ?? '',
    receiptHeader: settings.receiptHeader ?? '',
    receiptFooter: settings.receiptFooter ?? '',
    serviceChargePercent: settings.serviceChargePercent,
    serviceChargeOrderTypes: settings.serviceChargeOrderTypes,
    waiterCommissionPercent: settings.waiterCommissionPercent,
    allowNegativeStock: settings.allowNegativeStock,
    autoPrintKitchenTicket: settings.autoPrintKitchenTicket,
    autoPrintReceipt: settings.autoPrintReceipt,
  };
}

/** Empty optional texts are sent as null — that is how the API clears them. */
function toPayload(values: FormValues): SettingsInput {
  return {
    restaurantName: values.restaurantName,
    phone: values.phone || null,
    address: values.address || null,
    receiptHeader: values.receiptHeader || null,
    receiptFooter: values.receiptFooter || null,
    serviceChargePercent: values.serviceChargePercent,
    serviceChargeOrderTypes: ORDER_TYPES.filter((type) =>
      values.serviceChargeOrderTypes.includes(type),
    ),
    waiterCommissionPercent: values.waiterCommissionPercent,
    allowNegativeStock: values.allowNegativeStock,
    autoPrintKitchenTicket: values.autoPrintKitchenTicket,
    autoPrintReceipt: values.autoPrintReceipt,
  };
}

/** Only the fields that differ from the server copy, so concurrent edits of other fields survive. */
function changedFields(next: SettingsInput, current: Settings): Partial<SettingsInput> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof SettingsInput)[]) {
    const value = next[key];
    const saved = current[key];
    const same =
      Array.isArray(value) && Array.isArray(saved)
        ? value.length === saved.length && value.every((item) => saved.includes(item))
        : value === saved;
    if (!same) patch[key] = value;
  }
  return patch as Partial<SettingsInput>;
}

function SettingsCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">{children}</div>
    </Card>
  );
}

/** Subscribes to the receipt fields only, so typing re-renders the preview and nothing else. */
function LiveReceiptPreview({ control }: { control: Control<FormInput, unknown, FormValues> }) {
  const [restaurantName, phone, address, header, footer, servicePercent, serviceTypes] = useWatch({
    control,
    name: [
      'restaurantName',
      'phone',
      'address',
      'receiptHeader',
      'receiptFooter',
      'serviceChargePercent',
      'serviceChargeOrderTypes',
    ],
  });
  return (
    <ReceiptPreview
      restaurantName={restaurantName}
      phone={phone}
      address={address}
      header={header}
      footer={footer}
      servicePercent={servicePercent ?? 0}
      serviceApplies={serviceTypes.includes('TABLE')}
    />
  );
}

function ServiceScopeHint({ control }: { control: Control<FormInput, unknown, FormValues> }) {
  const [servicePercent, serviceTypes] = useWatch({
    control,
    name: ['serviceChargePercent', 'serviceChargeOrderTypes'],
  });
  if (!servicePercent) {
    return (
      <p className="text-ink-500 text-xs">
        Процент обслуживания равен 0 — надбавка к счёту не начисляется.
      </p>
    );
  }
  if (serviceTypes.length === 0) {
    return (
      <p className="text-warning-700 flex items-center gap-1.5 text-xs font-medium">
        <TriangleAlert className="size-3.5 shrink-0" />
        Не выбран ни один тип заказа — обслуживание не будет начисляться.
      </p>
    );
  }
  return (
    <p className="text-ink-500 text-xs">Процент фиксируется в заказе в момент его открытия.</p>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        {['h-48', 'h-60', 'h-56', 'h-60'].map((height, index) => (
          <Skeleton key={index} className={`${height} rounded-2xl`} />
        ))}
      </div>
      <Skeleton className="h-[520px] rounded-2xl" />
    </div>
  );
}

/** Mounted once the settings are loaded, so the fields start with the server values (no empty flash). */
function SettingsForm({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(settings),
  });
  const { errors, isDirty } = form.formState;

  // Adopt changes saved elsewhere (another device, another admin) unless the user is editing.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toFormValues(settings));
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<SettingsInput>) => settingsApi.update(patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.settings, saved);
      form.reset(toFormValues(saved));
      toast.success('Настройки сохранены');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const submit = form.handleSubmit((values) => {
    const patch = changedFields(toPayload(values), settings);
    if (Object.keys(patch).length === 0) {
      form.reset(toFormValues(settings));
      toast.info('Изменений нет — настройки уже совпадают');
      return;
    }
    mutation.mutate(patch);
  });

  return (
    <>
      <PageHeader
        title="Общие настройки"
        subtitle={`Последнее изменение: ${formatDateTime(settings.updatedAt)}`}
        actions={
          <>
            {isDirty && (
              <Button
                variant="ghost"
                leftIcon={<RotateCcw className="size-4" />}
                disabled={mutation.isPending}
                onClick={() => form.reset(toFormValues(settings))}
              >
                Отменить изменения
              </Button>
            )}
            <Button
              type="submit"
              form="settings-form"
              leftIcon={<Save className="size-4" />}
              loading={mutation.isPending}
              disabled={!isDirty}
            >
              Сохранить
            </Button>
          </>
        }
      />

      <form
        id="settings-form"
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
        onSubmit={submit}
        noValidate
      >
        <div className="flex min-w-0 flex-col gap-4">
          <SettingsCard
            title="Заведение"
            subtitle="Название и контакты печатаются в шапке чека"
            icon={<Store />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Название заведения"
                required
                maxLength={120}
                placeholder="Например: Чайхана «Бургут»"
                error={errors.restaurantName?.message}
                {...form.register('restaurantName')}
              />
              <Input
                label="Телефон"
                type="tel"
                maxLength={20}
                placeholder="+998 71 200 00 00"
                error={errors.phone?.message}
                {...form.register('phone')}
              />
            </div>
            <Input
              label="Адрес"
              maxLength={255}
              placeholder="г. Ташкент, ул. Амира Темура, 1"
              error={errors.address?.message}
              {...form.register('address')}
            />
          </SettingsCard>

          <SettingsCard
            title="Чек"
            subtitle="Дополнительный текст в начале и в конце чека"
            icon={<ReceiptText />}
          >
            <Textarea
              label="Шапка чека"
              rows={3}
              maxLength={500}
              placeholder="ИНН, режим работы, пароль от Wi-Fi"
              hint="Печатается под названием и контактами заведения. До 500 символов."
              error={errors.receiptHeader?.message}
              {...form.register('receiptHeader')}
            />
            <Textarea
              label="Подвал чека"
              rows={3}
              maxLength={500}
              placeholder="Спасибо за визит!"
              hint="Печатается в конце чека. До 500 символов."
              error={errors.receiptFooter?.message}
              {...form.register('receiptFooter')}
            />
          </SettingsCard>

          <SettingsCard
            title="Обслуживание и официанты"
            subtitle="Надбавка к счёту и доля официантов в отчётах"
            icon={<Percent />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="serviceChargePercent"
                render={({ field }) => (
                  <NumericInput
                    label="Обслуживание"
                    required
                    decimals={2}
                    min={0}
                    max={100}
                    suffix="%"
                    hint="% от суммы заказа после скидки"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.serviceChargePercent?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="waiterCommissionPercent"
                render={({ field }) => (
                  <NumericInput
                    label="Процент официанта"
                    required
                    decimals={2}
                    min={0}
                    max={100}
                    suffix="%"
                    hint="Доля от продаж официанта после скидки — только для отчётов"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.waiterCommissionPercent?.message}
                  />
                )}
              />
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-ink-700 mb-2.5 text-[13px] font-medium">
                Начислять обслуживание для заказов
              </legend>
              <Controller
                control={form.control}
                name="serviceChargeOrderTypes"
                render={({ field }) => (
                  <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-4">
                    {ORDER_TYPES.map((type) => (
                      <Checkbox
                        key={type}
                        label={ORDER_TYPE_LABELS[type]}
                        checked={field.value.includes(type)}
                        onChange={(checked) =>
                          field.onChange(
                            checked
                              ? ORDER_TYPES.filter(
                                  (item) => item === type || field.value.includes(item),
                                )
                              : field.value.filter((item) => item !== type),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              />
              <ServiceScopeHint control={form.control} />
            </fieldset>
          </SettingsCard>

          <SettingsCard
            title="Склад и печать"
            subtitle="Контроль остатков и автоматическая печать"
            icon={<Printer />}
          >
            <div className="divide-ink-100 flex flex-col divide-y">
              <Controller
                control={form.control}
                name="allowNegativeStock"
                render={({ field }) => (
                  <Switch
                    className="pb-4"
                    label="Продажа в минус"
                    description="Разрешить продавать блюда с учётом остатков, даже когда остаток в продаже закончился. Остаток станет отрицательным."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="autoPrintKitchenTicket"
                render={({ field }) => (
                  <Switch
                    className="py-4"
                    label="Автопечать бегунков"
                    description="Печатать бегунок на принтеры приготовления сразу после отправки новых позиций заказа."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="autoPrintReceipt"
                render={({ field }) => (
                  <Switch
                    className="pt-4"
                    label="Автопечать чека"
                    description="Печатать чек для гостя автоматически после оплаты заказа."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </SettingsCard>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4">
          <Card>
            <CardHeader
              title="Предпросмотр чека"
              subtitle="Обновляется по мере ввода"
              icon={<ReceiptText />}
            />
            <div className="px-5 pt-4 pb-5">
              <LiveReceiptPreview control={form.control} />
            </div>
          </Card>
        </aside>
      </form>
    </>
  );
}

export default function GeneralSettingsPage() {
  const query = useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });

  return (
    <div className="flex flex-col gap-4">
      {query.data ? (
        <SettingsForm settings={query.data} />
      ) : (
        <>
          <PageHeader title="Общие настройки" subtitle=" " />
          {query.isError ? (
            <Card>
              <EmptyState
                title="Не удалось загрузить настройки"
                description={getErrorMessage(query.error)}
                action={
                  <Button variant="secondary" onClick={() => void query.refetch()}>
                    Повторить
                  </Button>
                }
              />
            </Card>
          ) : (
            <SettingsSkeleton />
          )}
        </>
      )}
    </div>
  );
}
