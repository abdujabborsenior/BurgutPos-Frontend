import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { rolesApi } from '@/api/team.api';
import type { RoleView } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  Toolbar,
  useConfirm,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatDateTime } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { catalogKeys } from './permissions';
import { RoleFormModal } from './RoleFormModal';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

function PermissionShare({ count, total }: { count: number; total: number }) {
  if (!total) return <span className="tabular font-medium">{count}</span>;
  const share = Math.min(100, Math.round((count / total) * 100));
  return (
    <div
      className="mx-auto flex w-24 flex-col items-center gap-1.5"
      title={`${share}% от всех прав`}
    >
      <span className="tabular text-[13px]">
        <span className="text-ink-900 font-semibold">{count}</span>
        <span className="text-ink-400"> / {total}</span>
      </span>
      <span className="bg-ink-100 block h-1 w-full overflow-hidden rounded-full">
        <span className="bg-brand-600 block h-full rounded-full" style={{ width: `${share}%` }} />
      </span>
    </div>
  );
}

/**
 * Roles are not archived: a role in use stays (its people keep their rights),
 * an unused one is deleted.
 */
export default function RolesPage() {
  const canManage = useCan(Permission.TeamManage);
  const myRoleId = useAuthStore((state) =>
    state.user?.isSuperadmin ? null : (state.user?.role?.id ?? null),
  );
  const confirm = useConfirm();
  const [editing, setEditing] = useState<RoleView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const list = useListState();
  const search = list.search.trim().toLowerCase();

  const rolesQuery = useQuery({
    queryKey: qk.roles(),
    queryFn: () => rolesApi.list(),
    placeholderData: keepPreviousData,
  });
  const catalogQuery = useQuery({
    queryKey: qk.permissionCatalog,
    queryFn: rolesApi.permissions,
    staleTime: Infinity,
  });
  const roles = rolesQuery.data?.items.filter(
    (role) => !search || role.name.toLowerCase().includes(search),
  );
  const known = new Set(catalogKeys(catalogQuery.data ?? []));

  const remove = useMutation({
    mutationFn: (role: RoleView) => rolesApi.remove(role.id),
    onSuccess: (_, role) => {
      toast.success(`Роль «${role.name}» удалена`);
      invalidateScopes('team');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (role: RoleView | null) => {
    setEditing(role);
    setFormOpen(true);
  };

  const askDelete = async (role: RoleView) => {
    const ok = await confirm({
      title: `Удалить роль «${role.name}»?`,
      description: 'Роль будет удалена без возможности восстановления.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) remove.mutate(role);
  };

  const columns: Column<RoleView>[] = [
    {
      key: 'name',
      header: 'Роль',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="text-ink-900 font-semibold">{row.name}</span>
          {row.id === myRoleId && (
            <Badge tone="brand" size="sm">
              ваша роль
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Описание',
      cell: (row) =>
        row.description ? (
          <span className="text-ink-600 mx-auto block max-w-sm text-[13px] whitespace-normal">
            {row.description}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'users',
      header: 'Сотрудников',
      cell: (row) => (
        <span className={row.usersCount ? 'tabular' : 'text-ink-400 tabular'}>
          {row.usersCount}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Права доступа',
      cell: (row) => (
        <PermissionShare
          count={
            known.size
              ? row.permissions.filter((key) => known.has(key)).length
              : row.permissions.length
          }
          total={known.size}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Создан',
      cell: (row) => (
        <span className="text-ink-700 tabular whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Создал',
      cell: (row) =>
        row.createdBy ? (
          <span className="whitespace-nowrap">{row.createdBy.fullName}</span>
        ) : (
          <span className="text-ink-500">Система</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Действия',
            cell: (row: RoleView) => {
              const blocked = row.usersCount > 0;
              const reason = `Роль назначена сотрудникам (${row.usersCount}). Сначала назначьте им другую роль`;
              return (
                <div className="flex items-center justify-center gap-1">
                  <IconButton
                    label="Редактировать"
                    icon={<Pencil />}
                    size="sm"
                    className={ACTION_ICON}
                    onClick={() => openForm(row)}
                  />
                  <span title={blocked ? reason : undefined} className="inline-flex">
                    <IconButton
                      label="Удалить"
                      title={blocked ? reason : 'Удалить'}
                      icon={<Trash2 />}
                      size="sm"
                      className={DANGER_ICON}
                      disabled={blocked}
                      loading={remove.isPending && remove.variables?.id === row.id}
                      onClick={() => void askDelete(row)}
                    />
                  </span>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Роли"
        subtitle="Готовые наборы прав для быстрого назначения сотрудникам."
        actions={
          canManage && (
            <Button leftIcon={<Plus className="size-4" />} onClick={() => openForm(null)}>
              Добавить
            </Button>
          )
        }
      />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={roles}
          rowKey={(row) => row.id}
          onRowClick={canManage ? (row) => openForm(row) : undefined}
          loading={rolesQuery.isLoading || catalogQuery.isLoading}
          fetching={rolesQuery.isFetching}
          numberedFrom={0}
          skeletonRows={4}
          empty={
            <EmptyState
              compact
              icon={<ShieldCheck />}
              title={search ? 'Ничего не найдено' : 'Ролей пока нет'}
              description={
                search
                  ? 'Измените запрос поиска.'
                  : 'Создайте роль, чтобы назначать её сотрудникам.'
              }
            />
          }
        />
      </Panel>
      <RoleFormModal open={formOpen} role={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
