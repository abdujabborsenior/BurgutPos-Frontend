import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Trash2, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { rolesApi, usersApi, type UserListParams } from '@/api/team.api';
import type { ArchiveStatus, UserView } from '@/api/types';
import {
  Avatar,
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
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeePasswordModal } from './EmployeePasswordModal';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

type EmployeeAction = 'activate' | 'deactivate' | 'delete';

const SUCCESS: Record<EmployeeAction, (name: string) => string> = {
  activate: (name) => `Доступ для «${name}» включён`,
  deactivate: (name) => `«${name}» удалён в неактивные, все сеансы завершены`,
  delete: (name) => `Сотрудник «${name}» удалён`,
};

export default function EmployeesPage() {
  const list = useListState({
    sortBy: 'fullName',
    sortOrder: 'ASC',
    filters: { status: 'active', role: 'all' },
  });
  const status = list.filters.status as ArchiveStatus;
  const roleId = list.filters.role === 'all' ? undefined : Number(list.filters.role) || undefined;
  const canManage = useCan(Permission.TeamManage);
  const meId = useAuthStore((state) => state.user?.id);
  const confirm = useConfirm();
  const [editing, setEditing] = useState<UserView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<UserView | null>(null);

  const params: UserListParams = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    status,
    roleId,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.users(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });
  const rolesQuery = useQuery({ queryKey: qk.roles(), queryFn: () => rolesApi.list() });
  const counts = query.data?.counts;
  const permissionsTotal = query.data?.permissionsTotal ?? 0;

  const action = useMutation({
    mutationFn: async ({ kind, user }: { kind: EmployeeAction; user: UserView }) => {
      if (kind === 'delete') await usersApi.remove(user.id);
      else await usersApi.update(user.id, { isActive: kind === 'activate' });
    },
    onSuccess: (_, { kind, user }) => {
      toast.success(SUCCESS[kind](user.fullName));
      invalidateScopes('team');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (user: UserView | null) => {
    setEditing(user);
    setFormOpen(true);
  };

  const askDeactivate = async (user: UserView) => {
    const ok = await confirm({
      title: `Удалить «${user.fullName}»?`,
      description:
        'Сотрудник перейдёт в «Неактивные»: войти в систему он не сможет, все его сеансы на всех устройствах будут завершены. История заказов и операций сохранится, доступ можно вернуть.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'deactivate', user });
  };

  const askActivate = async (user: UserView) => {
    const ok = await confirm({
      title: `Включить доступ для «${user.fullName}»?`,
      description: 'Сотрудник снова сможет входить в систему со своим логином и паролем.',
      confirmText: 'Включить',
    });
    if (ok) action.mutate({ kind: 'activate', user });
  };

  const askDelete = async (user: UserView) => {
    const ok = await confirm({
      title: `Удалить «${user.fullName}» навсегда?`,
      description:
        'Удалить можно только сотрудника без заказов и операций — в остальных случаях его достаточно отключить. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', user });
  };

  const columns: Column<UserView>[] = [
    {
      key: 'fullName',
      header: 'Сотрудник',
      sortKey: 'fullName',
      align: 'left',
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.fullName} size="sm" />
          <span className="text-ink-900 font-semibold">{row.fullName}</span>
          {row.id === meId && <span className="text-ink-400 text-xs font-medium">это вы</span>}
        </span>
      ),
    },
    {
      key: 'login',
      header: 'Логин',
      sortKey: 'login',
      cell: (row) => <span className="text-ink-700">{row.login}</span>,
    },
    {
      key: 'phone',
      header: 'Телефон',
      cell: (row) =>
        row.phone ? (
          <span className="tabular whitespace-nowrap">{row.phone}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'role',
      header: 'Роль',
      sortKey: 'role',
      cell: (row) =>
        row.role ? (
          <Badge tone="brand">{row.role.name}</Badge>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'permissions',
      header: 'Права доступа',
      cell: (row) =>
        row.role ? (
          <span
            className="bg-ink-100 text-ink-700 tabular inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold"
            title={`${row.role.name}: ${row.role.permissionsCount} из ${permissionsTotal} прав`}
          >
            {row.role.permissionsCount}/{permissionsTotal}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
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
            Отключён
          </Badge>
        ),
    },
    {
      key: 'lastLoginAt',
      header: 'Последний вход',
      sortKey: 'lastLoginAt',
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-ink-700 tabular">{formatDateTime(row.lastLoginAt)}</span>
        ) : (
          <span className="text-ink-400">Никогда</span>
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
    {
      key: 'createdAt',
      header: 'Создан',
      sortKey: 'createdAt',
      cell: (row) => <span className="text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Действия',
            cell: (row: UserView) => {
              const self = row.id === meId;
              const selfReason = 'Нельзя удалить собственную учётную запись';
              return (
                <div className="flex items-center justify-center gap-1">
                  <IconButton
                    label="Пароль"
                    icon={<KeyRound />}
                    size="sm"
                    className={ACTION_ICON}
                    onClick={() => setPasswordFor(row)}
                  />
                  <IconButton
                    label="Редактировать"
                    icon={<Pencil />}
                    size="sm"
                    className={ACTION_ICON}
                    onClick={() => openForm(row)}
                  />
                  {row.isActive ? (
                    <span title={self ? selfReason : undefined} className="inline-flex">
                      <IconButton
                        label="Удалить"
                        title={self ? selfReason : 'Удалить'}
                        icon={<Trash2 />}
                        size="sm"
                        className={DANGER_ICON}
                        disabled={self}
                        onClick={() => void askDeactivate(row)}
                      />
                    </span>
                  ) : (
                    <>
                      <IconButton
                        label="Включить доступ"
                        icon={<UserCheck />}
                        size="sm"
                        variant="brand"
                        onClick={() => void askActivate(row)}
                      />
                      <IconButton
                        label="Удалить навсегда"
                        icon={<Trash2 />}
                        size="sm"
                        className={DANGER_ICON}
                        disabled={self}
                        onClick={() => void askDelete(row)}
                      />
                    </>
                  )}
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
        title="Сотрудники"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} неактивных` : ' '}
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
          <Select
            value={status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'active', label: `Активные${counts ? ` (${counts.active})` : ''}` },
              { value: 'archived', label: `Неактивные${counts ? ` (${counts.archived})` : ''}` },
              { value: 'all', label: 'Все' },
            ]}
            className="w-48"
          />
          <Select
            value={list.filters.role}
            onChange={(value) => list.setFilter('role', value)}
            options={[
              { value: 'all', label: 'Все роли' },
              ...(rolesQuery.data?.items ?? []).map((role) => ({
                value: String(role.id),
                label: role.name,
              })),
            ]}
            placeholder="Все роли"
            className="w-52"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.id}
          onRowClick={canManage ? (row) => openForm(row) : undefined}
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={(list.page - 1) * list.limit}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSortChange={list.setSort}
          empty={
            !list.search && counts && counts.active + counts.archived === 0 ? (
              <EmptyState
                compact
                icon={<Users />}
                title="Сотрудников пока нет"
                description="Добавьте сотрудника и назначьте ему роль, чтобы он мог войти в систему."
              />
            ) : undefined
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
      <EmployeeFormModal open={formOpen} employee={editing} onClose={() => setFormOpen(false)} />
      <EmployeePasswordModal employee={passwordFor} onClose={() => setPasswordFor(null)} />
    </div>
  );
}
