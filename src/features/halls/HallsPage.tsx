import { useMutation, useQuery } from '@tanstack/react-query';
import { ArchiveRestore, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { hallsApi } from '@/api/halls.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { ArchiveStatus, HallView } from '@/api/types';
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
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatDateTime, formatPercent } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { HallFormModal } from './HallFormModal';

type HallAction = 'archive' | 'restore' | 'delete';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

const SUCCESS: Record<HallAction, string> = {
  archive: 'Зал удалён — он в архиве, история заказов сохранена',
  restore: 'Зал восстановлен',
  delete: 'Зал удалён',
};

export default function HallsPage() {
  const list = useListState({ filters: { status: 'active' } });
  const status = list.filters.status as ArchiveStatus;
  const confirm = useConfirm();
  const [editing, setEditing] = useState<HallView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // The list is small and unpaginated: load every hall once, filter locally and get the counts for free.
  const query = useQuery({ queryKey: qk.halls('all'), queryFn: () => hallsApi.list('all') });
  const halls = query.data;
  const counts = halls && {
    active: halls.filter((hall) => hall.isActive).length,
    archived: halls.filter((hall) => !hall.isActive).length,
  };
  const search = list.search.trim().toLowerCase();
  const rows = halls?.filter(
    (hall) =>
      (status === 'all' || hall.isActive === (status === 'active')) &&
      (!search || hall.name.toLowerCase().includes(search)),
  );

  const action = useMutation({
    mutationFn: async ({ kind, hall }: { kind: HallAction; hall: HallView }) => {
      if (kind === 'delete') await hallsApi.remove(hall.id);
      else await hallsApi.update(hall.id, { isActive: kind === 'restore' });
    },
    onSuccess: (_, { kind }) => {
      toast.success(SUCCESS[kind]);
      invalidateScopes('halls');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (hall: HallView | null) => {
    setEditing(hall);
    setFormOpen(true);
  };

  const askArchive = async (hall: HallView) => {
    const ok = await confirm({
      title: `Удалить зал «${hall.name}»?`,
      description:
        hall.tablesCount > 0
          ? `Зал и его столы (${hall.tablesCount}) скроются с экрана столов и перейдут в архив. История заказов сохранится, зал можно восстановить.`
          : 'Зал скроется с экрана столов и перейдёт в архив. Его можно восстановить в любой момент.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', hall });
  };

  const askDelete = async (hall: HallView) => {
    const ok = await confirm({
      title: `Удалить зал «${hall.name}» навсегда?`,
      description:
        'Удалить можно только зал без столов, в том числе архивных. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', hall });
  };

  const columns: Column<HallView>[] = [
    {
      key: 'name',
      header: 'Зал',
      cell: (row) => <span className="text-ink-900 font-semibold">{row.name}</span>,
    },
    {
      key: 'servicePercent',
      header: 'Процент',
      cell: (row) =>
        row.servicePercent === null ? (
          <span className="text-ink-400" title="Как в настройках заведения">
            по умолчанию
          </span>
        ) : (
          <span className="tabular">{formatPercent(row.servicePercent)}</span>
        ),
    },
    {
      key: 'order',
      header: 'Порядок',
      cell: (row) => <span className="tabular">{row.sortOrder}</span>,
    },
    {
      key: 'tables',
      header: 'Столов',
      cell: (row) => (
        <span className={row.tablesCount ? 'tabular' : 'text-ink-400 tabular'}>
          {row.tablesCount}
        </span>
      ),
    },
    {
      key: 'openOrders',
      header: 'Открытых заказов',
      cell: (row) => (
        <span className={row.openOrdersCount ? 'tabular font-medium' : 'text-ink-400 tabular'}>
          {row.openOrdersCount}
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
      key: 'createdAt',
      header: 'Создан',
      cell: (row) => <span className="text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'createdBy',
      header: 'Создал',
      cell: (row) => row.createdBy?.fullName ?? <span className="text-ink-400">—</span>,
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
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
                onClick={() => action.mutate({ kind: 'restore', hall: row })}
              />
              <IconButton
                label="Удалить навсегда"
                icon={<Trash2 />}
                size="sm"
                className={DANGER_ICON}
                onClick={() => void askDelete(row)}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Залы"
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
          skeletonRows={4}
          empty={
            halls?.length === 0 ? (
              <EmptyState
                compact
                icon={<MapPin />}
                title="Залов пока нет"
                description="Создайте зал, а затем добавьте в него столы."
              />
            ) : (
              <EmptyState
                compact
                icon={<MapPin />}
                title={
                  search
                    ? 'Ничего не найдено'
                    : status === 'archived'
                      ? 'В архиве нет залов'
                      : 'Активных залов нет'
                }
                description={search ? 'Измените запрос поиска.' : 'Измените фильтр статуса.'}
              />
            )
          }
        />
      </Panel>
      <HallFormModal open={formOpen} hall={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
