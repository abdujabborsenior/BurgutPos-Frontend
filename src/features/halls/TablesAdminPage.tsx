import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ArchiveRestore, Armchair, CopyPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { hallsApi, tablesApi, type TableListParams } from '@/api/halls.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { ArchiveStatus, TableView } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Select,
  Toolbar,
  useConfirm,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatDateTime } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { BulkTablesModal } from './BulkTablesModal';
import { TableFormModal } from './TableFormModal';

type TableAction = 'archive' | 'restore' | 'delete';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

const SUCCESS: Record<TableAction, string> = {
  archive: 'Стол удалён — он в архиве, история заказов сохранена',
  restore: 'Стол восстановлен',
  delete: 'Стол удалён',
};

export default function TablesAdminPage() {
  const list = useListState({
    sortBy: 'hall',
    sortOrder: 'ASC',
    filters: { status: 'active', hall: 'all' },
  });
  const status = list.filters.status as ArchiveStatus;
  const hallId = list.filters.hall === 'all' ? undefined : Number(list.filters.hall) || undefined;
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TableView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Captured when a form opens, so a background refetch never resets a form being filled in.
  const [createHallId, setCreateHallId] = useState<number | null>(null);

  const params: TableListParams = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    status,
    hallId,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.tables(params),
    queryFn: () => tablesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const hallsQuery = useQuery({ queryKey: qk.hallOptions, queryFn: hallsApi.options });
  const halls = hallsQuery.data ?? [];
  const counts = query.data?.counts;
  // New tables go to the (active) hall the list is filtered by, or to the only hall there is.
  const preferredHallId = () => {
    if (hallId !== undefined && halls.some((hall) => hall.id === hallId)) return hallId;
    return halls.length === 1 ? halls[0].id : null;
  };

  const action = useMutation({
    mutationFn: async ({ kind, table }: { kind: TableAction; table: TableView }) => {
      if (kind === 'delete') await tablesApi.remove(table.id);
      else await tablesApi.update(table.id, { isActive: kind === 'restore' });
    },
    onSuccess: (_, { kind }) => {
      toast.success(SUCCESS[kind]);
      invalidateScopes('halls');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (table: TableView | null) => {
    setEditing(table);
    setCreateHallId(preferredHallId());
    setFormOpen(true);
  };

  const openBulk = () => {
    setCreateHallId(preferredHallId());
    setBulkOpen(true);
  };

  const askArchive = async (table: TableView) => {
    const ok = await confirm({
      title: `Удалить стол «${table.name}»?`,
      description:
        'Стол скроется с экрана столов и перейдёт в архив. История заказов сохранится, стол можно восстановить в любой момент.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', table });
  };

  const askDelete = async (table: TableView) => {
    const ok = await confirm({
      title: `Удалить стол «${table.name}» навсегда?`,
      description:
        'Удалить можно только стол без истории заказов — такой стол можно лишь архивировать. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', table });
  };

  const columns: Column<TableView>[] = [
    {
      key: 'name',
      header: 'Стол',
      sortKey: 'name',
      cell: (row) => <span className="text-ink-900 font-semibold">{row.name}</span>,
    },
    {
      key: 'hall',
      header: 'Зал',
      sortKey: 'hall',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="text-ink-800">{row.hall.name}</span>
          {!row.hall.isActive && (
            <Badge tone="neutral" size="sm">
              зал в архиве
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'seats',
      header: 'Мест',
      sortKey: 'seats',
      cell: (row) =>
        row.seats === null ? (
          <span className="text-ink-400">—</span>
        ) : (
          <span className="tabular">{row.seats}</span>
        ),
    },
    {
      key: 'order',
      header: 'Порядок',
      sortKey: 'sortOrder',
      cell: (row) => <span className="tabular">{row.sortOrder}</span>,
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
      sortKey: 'createdAt',
      cell: (row) => <span className="text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'createdBy',
      header: 'Создал',
      cell: (row) =>
        row.createdBy ? (
          <span className="whitespace-nowrap">{row.createdBy.fullName}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
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
                onClick={() => action.mutate({ kind: 'restore', table: row })}
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
        title="Столы"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} в архиве` : ' '}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<CopyPlus className="size-4" />}
              onClick={openBulk}
            >
              Создать несколько
            </Button>
            <Button leftIcon={<Plus className="size-4" />} onClick={() => openForm(null)}>
              Добавить стол
            </Button>
          </>
        }
      />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск" />
          <Select
            value={list.filters.hall}
            onChange={(value) => list.setFilter('hall', value)}
            options={[
              { value: 'all', label: 'Все залы' },
              ...halls.map((hall) => ({ value: String(hall.id), label: hall.name })),
            ]}
            placeholder="Все залы"
            className="w-52"
          />
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
          rows={query.data?.items}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={(list.page - 1) * list.limit}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSortChange={list.setSort}
          empty={
            list.search || !counts || counts.active + counts.archived > 0 ? undefined : (
              <EmptyState
                compact
                icon={<Armchair />}
                title="Столов пока нет"
                description="Добавьте столы по одному или создайте сразу несколько с общим префиксом."
              />
            )
          }
        />
        <Pagination
          className="mt-4"
          page={list.page}
          limit={list.limit}
          total={query.data?.total ?? 0}
          onPageChange={list.setPage}
          onLimitChange={list.setLimit}
        />
      </Panel>
      <TableFormModal
        open={formOpen}
        table={editing}
        defaultHallId={createHallId}
        onClose={() => setFormOpen(false)}
      />
      <BulkTablesModal
        open={bulkOpen}
        defaultHallId={createHallId}
        onClose={() => setBulkOpen(false)}
      />
    </div>
  );
}
