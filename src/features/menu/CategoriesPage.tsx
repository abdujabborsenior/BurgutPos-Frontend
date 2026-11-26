import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { categoriesApi } from '@/api/menu.api';
import type { ArchiveStatus, CategoryView } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
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
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { CategoryFormModal } from './CategoryFormModal';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

export default function CategoriesPage() {
  const list = useListState({
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    filters: { status: 'active' },
  });
  const status = list.filters.status as ArchiveStatus;
  const canManage = useCan(Permission.MenuManage);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const params = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    status,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.categories(params),
    queryFn: () => categoriesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const counts = query.data?.counts;

  const action = useMutation({
    mutationFn: async ({
      kind,
      category,
    }: {
      kind: 'archive' | 'restore' | 'delete';
      category: CategoryView;
    }) => {
      if (kind === 'archive') await categoriesApi.archive(category.id);
      if (kind === 'restore') await categoriesApi.restore(category.id);
      if (kind === 'delete') await categoriesApi.remove(category.id);
      return kind;
    },
    onSuccess: (kind) => {
      toast.success(
        kind === 'archive'
          ? 'Категория удалена — она в архиве, история продаж сохранена'
          : kind === 'restore'
            ? 'Категория восстановлена'
            : 'Категория удалена',
      );
      invalidateScopes('menu');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const askArchive = async (category: CategoryView) => {
    const ok = await confirm({
      title: `Удалить «${category.name}»?`,
      description:
        category.dishesCount > 0
          ? `Категория и её блюда (${category.dishesCount}) скроются с экрана заказа и перейдут в архив. История продаж сохранится, категорию можно восстановить.`
          : 'Категория скроется из меню и перейдёт в архив. Её можно восстановить в любой момент.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', category });
  };

  const askDelete = async (category: CategoryView) => {
    const ok = await confirm({
      title: `Удалить «${category.name}» навсегда?`,
      description: 'Удалить можно только категорию без блюд. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', category });
  };

  const columns: Column<CategoryView>[] = [
    {
      key: 'name',
      header: 'Категория',
      sortKey: 'name',
      cell: (row) => <span className="text-ink-900 font-semibold">{row.name}</span>,
    },
    {
      key: 'dishes',
      header: 'Блюд',
      sortKey: 'dishesCount',
      cell: (row) => <span className="tabular">{row.dishesCount}</span>,
    },
    {
      key: 'order',
      header: 'Порядок',
      sortKey: 'sortOrder',
      cell: (row) => <span className="tabular">{row.sortOrder}</span>,
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
      cell: (row) => row.createdBy?.fullName ?? <span className="text-ink-400">—</span>,
    },
    ...(status !== 'active'
      ? [
          {
            key: 'status',
            header: 'Статус',
            cell: (row: CategoryView) =>
              row.isActive ? (
                <Badge tone="success" dot>
                  Активна
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  В архиве
                </Badge>
              ),
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Действия',
            cell: (row: CategoryView) => (
              <div className="flex items-center justify-center gap-1">
                <IconButton
                  label="Редактировать"
                  icon={<Pencil />}
                  size="sm"
                  className={ACTION_ICON}
                  onClick={() => {
                    setEditing(row);
                    setFormOpen(true);
                  }}
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
                      onClick={() => action.mutate({ kind: 'restore', category: row })}
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
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Категории"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} в архиве` : ' '}
        actions={
          canManage && (
            <Button
              leftIcon={<Plus className="size-4" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Добавить
            </Button>
          )
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
          rows={query.data?.items}
          rowKey={(row) => row.id}
          onRowClick={
            canManage
              ? (row) => {
                  setEditing(row);
                  setFormOpen(true);
                }
              : undefined
          }
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={(list.page - 1) * list.limit}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSortChange={list.setSort}
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
      <CategoryFormModal open={formOpen} category={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
