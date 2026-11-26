import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useMemo } from 'react';
import { qk } from '@/api/keys';
import { loginEventsApi, type LoginEventParams } from '@/api/team.api';
import type { LoginEventType, LoginEventView } from '@/api/types';
import {
  Badge,
  Combobox,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  Panel,
  PeriodCard,
  SearchInput,
  Select,
  Toolbar,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { usePeriodParams } from '@/hooks/usePeriodParams';
import { useUserOptions } from '@/features/reports/components/useFilterOptions';
import { oneOf, toId } from '@/features/reports/components/report-utils';
import { formatDateTime, plural } from '@/lib/format';

const EVENT_LABELS: Record<LoginEventType, string> = { IN: 'Вход', OUT: 'Выход' };

const EVENT_OPTIONS: SelectOption<LoginEventType | null>[] = [
  { value: null, label: 'Все' },
  { value: 'IN', label: EVENT_LABELS.IN },
  { value: 'OUT', label: EVENT_LABELS.OUT },
];

const dash = <span className="text-ink-400">—</span>;

const columns: Column<LoginEventView>[] = [
  {
    key: 'createdAt',
    header: 'Дата',
    sortKey: 'createdAt',
    cell: (row) => <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
  },
  {
    key: 'user',
    header: 'Сотрудник',
    sortKey: 'user',
    cell: (row) =>
      row.user ? (
        <span className="font-medium whitespace-nowrap text-ink-900" title={row.user.login}>
          {row.user.fullName}
        </span>
      ) : (
        dash
      ),
  },
  {
    key: 'type',
    header: 'Событие',
    cell: (row) => (
      <Badge size="sm" tone={row.type === 'IN' ? 'success' : 'neutral'}>
        {EVENT_LABELS[row.type]}
      </Badge>
    ),
  },
  {
    key: 'device',
    header: 'Устройство',
    cell: (row) =>
      row.device === '—' ? (
        dash
      ) : (
        <span className="whitespace-nowrap text-ink-700" title={row.userAgent ?? undefined}>
          {row.device}
        </span>
      ),
  },
  {
    key: 'ip',
    header: 'IP',
    cell: (row) => (row.ip ? <span className="text-ink-600 tabular">{row.ip}</span> : dash),
  },
];

/** История входа: every sign-in and sign-out, with device and address. */
export default function LoginHistoryPage() {
  const { period, setPeriod } = usePeriodParams({ preset: 'thisWeek' });
  const list = useListState({ limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' });
  const type = oneOf(list.filters.event, ['IN', 'OUT'] as const);
  const userId = toId(list.filters.userId);
  const users = useUserOptions();

  const sortBy = oneOf(list.sortBy, ['createdAt', 'user'] as const) ?? 'createdAt';
  const sortOrder = list.sortBy === sortBy && list.sortOrder ? list.sortOrder : 'DESC';

  const params: LoginEventParams = {
    page: list.page,
    limit: list.limit,
    search: list.search || undefined,
    from: period.from,
    to: period.to,
    type,
    userId,
    sortBy,
    sortOrder,
  };
  const query = useQuery({
    queryKey: qk.loginEvents(params),
    queryFn: () => loginEventsApi.list(params),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.total;
  const userOptions = useMemo(() => users.data ?? [], [users.data]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="История входа"
        subtitle={total === undefined ? ' ' : `${total} ${plural(total, ['запись', 'записи', 'записей'])}`}
      />
      <PeriodCard value={period} onChange={setPeriod}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Событие"
            value={type ?? null}
            onChange={(value) => list.setFilter('event', value)}
            options={EVENT_OPTIONS}
          />
          <Field label="Сотрудник">
            <Combobox
              value={userId ?? null}
              onChange={(value) => list.setFilter('userId', value)}
              options={userOptions}
              placeholder="Все"
              clearable
            />
          </Field>
        </div>
      </PeriodCard>
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск по сотруднику" />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          fetching={query.isPlaceholderData}
          numberedFrom={(list.page - 1) * list.limit}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(by, order) => list.setSort(by ?? 'createdAt', by ? order : 'DESC')}
          empty={
            <EmptyState
              compact
              icon={<LogIn />}
              title="Нет записей"
              description="За выбранный период входов не было — измените период или фильтры."
            />
          }
        />
        <Pagination
          className="mt-4"
          page={list.page}
          limit={list.limit}
          total={total ?? 0}
          onPageChange={list.setPage}
          onLimitChange={list.setLimit}
        />
      </Panel>
    </div>
  );
}
