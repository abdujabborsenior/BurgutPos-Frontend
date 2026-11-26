import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArchiveRestore,
  Banknote,
  CreditCard,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { paymentMethodsApi } from '@/api/settings.api';
import type { ArchiveStatus, PaymentMethodType, PaymentMethodView } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  Toolbar,
  useConfirm,
  type BadgeTone,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatMoney } from '@/lib/format';
import { PAYMENT_TYPE_LABELS } from '@/lib/labels';
import { invalidateScopes } from '@/lib/realtime';
import { PaymentMethodFormModal } from './PaymentMethodFormModal';

const TYPE_TONES: Record<PaymentMethodType, BadgeTone> = {
  CASH: 'success',
  CARD: 'brand',
  ONLINE: 'brand',
  OTHER: 'neutral',
};

/** The kind of money is read at a glance, next to the name. */
const TYPE_ICONS: Record<PaymentMethodType, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  ONLINE: Smartphone,
  OTHER: Wallet,
};

const TYPE_ICON_COLORS: Record<PaymentMethodType, string> = {
  CASH: 'text-success-600',
  CARD: 'text-brand-600',
  ONLINE: 'text-brand-600',
  OTHER: 'text-ink-400',
};

type MethodAction = 'archive' | 'restore' | 'delete';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

const SUCCESS: Record<MethodAction, string> = {
  archive: 'Способ оплаты удалён — он в архиве, история оплат сохранена',
  restore: 'Способ оплаты восстановлен',
  delete: 'Способ оплаты удалён',
};

export default function PaymentMethodsPage() {
  const list = useListState({ filters: { status: 'active' } });
  const status = list.filters.status as ArchiveStatus;
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PaymentMethodView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Small unpaginated catalog: load it whole, filter locally and get the counts for free.
  const query = useQuery({
    queryKey: qk.paymentMethods('all'),
    queryFn: () => paymentMethodsApi.list('all'),
  });
  const methods = query.data;
  const counts = methods && {
    active: methods.filter((method) => method.isActive).length,
    archived: methods.filter((method) => !method.isActive).length,
  };
  const needle = list.search.trim().toLowerCase();
  const rows = methods?.filter(
    (method) =>
      (status === 'all' || method.isActive === (status === 'active')) &&
      (!needle ||
        method.name.toLowerCase().includes(needle) ||
        PAYMENT_TYPE_LABELS[method.type].toLowerCase().includes(needle)),
  );

  const action = useMutation({
    mutationFn: async ({ kind, method }: { kind: MethodAction; method: PaymentMethodView }) => {
      if (kind === 'delete') await paymentMethodsApi.remove(method.id);
      else await paymentMethodsApi.update(method.id, { isActive: kind === 'restore' });
    },
    onSuccess: (_, { kind }) => {
      toast.success(SUCCESS[kind]);
      invalidateScopes('payment-methods');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (method: PaymentMethodView | null) => {
    setEditing(method);
    setFormOpen(true);
  };

  const askArchive = async (method: PaymentMethodView) => {
    const ok = await confirm({
      title: `Удалить «${method.name}»?`,
      description:
        'Способ оплаты исчезнет с экрана оплаты и перейдёт в архив. История оплат и отчёты сохранятся, его можно восстановить в любой момент.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', method });
  };

  const askDelete = async (method: PaymentMethodView) => {
    const ok = await confirm({
      title: `Удалить «${method.name}» навсегда?`,
      description: 'Способ оплаты будет удалён без возможности восстановления.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', method });
  };

  const columns: Column<PaymentMethodView>[] = [
    {
      key: 'order',
      header: 'Порядок',
      cell: (row) => <span className="tabular">{row.sortOrder}</span>,
    },
    {
      key: 'name',
      header: 'Название',
      cell: (row) => {
        const Icon = TYPE_ICONS[row.type];
        return (
          <span className="flex items-center justify-center gap-2">
            <Icon className={`size-4 shrink-0 ${TYPE_ICON_COLORS[row.type]}`} />
            <span className="text-ink-900 font-semibold">{row.name}</span>
          </span>
        );
      },
    },
    {
      key: 'type',
      header: 'Тип',
      cell: (row) => <Badge tone={TYPE_TONES[row.type]}>{PAYMENT_TYPE_LABELS[row.type]}</Badge>,
    },
    {
      key: 'payments',
      header: 'Оплат',
      cell: (row) => (
        <span className={row.paymentsCount ? 'tabular' : 'text-ink-400 tabular'}>
          {formatMoney(row.paymentsCount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (row) =>
        row.isActive ? (
          <Badge tone="success" dot>
            Активен
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            В архиве
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => {
        const used = row.paymentsCount > 0;
        const reason =
          'Способом уже принимались оплаты — он остаётся в архиве, чтобы история оплат не потерялась';
        return (
          <div className="flex items-center justify-center gap-1">
            <IconButton
              label="Редактировать"
              icon={<Pencil />}
              size="sm"
              className={ACTION_ICON}
              onClick={() => openForm(row)}
            />
            {row.isActive ? (
              <IconButton
                label="Удалить"
                icon={<Trash2 />}
                size="sm"
                className={DANGER_ICON}
                onClick={() => void askArchive(row)}
              />
            ) : (
              <>
                <IconButton
                  label="Восстановить"
                  icon={<ArchiveRestore />}
                  size="sm"
                  variant="brand"
                  onClick={() => action.mutate({ kind: 'restore', method: row })}
                />
                <span title={used ? reason : undefined} className="inline-flex">
                  <IconButton
                    label="Удалить навсегда"
                    title={used ? reason : 'Удалить навсегда'}
                    icon={<Trash2 />}
                    size="sm"
                    className={DANGER_ICON}
                    disabled={used}
                    onClick={() => void askDelete(row)}
                  />
                </span>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Способ оплаты"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} в архиве` : ' '}
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => openForm(null)}>
            Добавить
          </Button>
        }
      />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск" />
          <Select
            value={status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'active', label: `Активные${counts ? ` (${counts.active})` : ''}` },
              { value: 'archived', label: `Архив${counts ? ` (${counts.archived})` : ''}` },
              { value: 'all', label: 'Все' },
            ]}
            className="w-44"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => openForm(row)}
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={0}
          skeletonRows={5}
          empty={
            methods?.length === 0 ? (
              <EmptyState
                compact
                icon={<CreditCard />}
                title="Способов оплаты пока нет"
                description="Добавьте наличные, карты и онлайн-сервисы, которыми принимаете оплату."
              />
            ) : (
              <EmptyState
                compact
                icon={<CreditCard />}
                title={
                  needle
                    ? 'Ничего не найдено'
                    : status === 'archived'
                      ? 'В архиве нет способов оплаты'
                      : 'Активных способов оплаты нет'
                }
                description={
                  needle ? 'Измените запрос или фильтр статуса.' : 'Измените фильтр статуса.'
                }
              />
            )
          }
        />
      </Panel>
      <PaymentMethodFormModal open={formOpen} method={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
