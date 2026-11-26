import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Link } from 'react-router';
import { qk } from '@/api/keys';
import { dishesApi } from '@/api/menu.api';
import { ingredientsApi, stockApi, type MovementListParams } from '@/api/stock.api';
import { usersApi } from '@/api/team.api';
import type { MovementView, StockItemType, StockLocation, StockMovementType } from '@/api/types';
import {
  Badge,
  Button,
  Combobox,
  DataTable,
  EmptyState,
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
import { formatDateTime, formatQty } from '@/lib/format';
import { LOCATION_LABELS, MOVEMENT_TYPE_LABELS } from '@/lib/labels';
import { todayPeriod } from '@/lib/period';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { LoadError, MovementTypeBadge, QtyDelta } from './StockParts';
import { pickOption, toId, unitLabel } from './stock.utils';

const TYPE_OPTIONS: SelectOption<'' | StockMovementType>[] = [
  { value: '', label: 'Все операции' },
  ...(Object.entries(MOVEMENT_TYPE_LABELS) as [StockMovementType, string][]).map(([value, label]) => ({ value, label })),
];

const ITEM_TYPE_OPTIONS: SelectOption<'' | StockItemType>[] = [
  { value: '', label: 'Все' },
  { value: 'DISH', label: 'Блюда и товары' },
  { value: 'INGREDIENT', label: 'Ингредиенты' },
];

const LOCATION_OPTIONS: SelectOption<'' | StockLocation>[] = [
  { value: '', label: 'Все места' },
  { value: 'SALE', label: LOCATION_LABELS.SALE },
  { value: 'WAREHOUSE', label: LOCATION_LABELS.WAREHOUSE },
];

/** Filters other pages may link with; each one is shown as a removable chip. */
type LinkedFilter = 'dishId' | 'ingredientId' | 'orderId';

const MOVEMENT_TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[];
const ITEM_TYPES: readonly StockItemType[] = ['DISH', 'INGREDIENT'];
const LOCATIONS: readonly StockLocation[] = ['SALE', 'WAREHOUSE'];

const muted = <span className="text-ink-400">—</span>;

/** История склада: every change of dish and ingredient balances. */
export default function HistoryPage() {
  const list = useListState({ limit: 10 });
  const { period, setPeriod } = usePeriodParams();
  const canOpenOrders = useCan(Permission.PosAccess);

  const filters = list.filters;
  const type = pickOption(filters.type, MOVEMENT_TYPES);
  const itemType = pickOption(filters.itemType, ITEM_TYPES);
  const location = pickOption(filters.location, LOCATIONS);
  const userId = toId(filters.userId);
  const dishId = toId(filters.dishId);
  const ingredientId = toId(filters.ingredientId);
  const orderId = toId(filters.orderId);

  const params: MovementListParams = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    from: period.from,
    to: period.to,
    type,
    itemType,
    location,
    userId,
    dishId,
    ingredientId,
    orderId,
  };
  const query = useQuery({
    queryKey: qk.movements(params),
    queryFn: () => stockApi.movements(params),
    placeholderData: keepPreviousData,
  });
  const users = useQuery({
    queryKey: qk.userOptions(),
    queryFn: () => usersApi.options(),
    staleTime: 5 * 60_000,
  });
  const dishes = useQuery({
    queryKey: qk.dishOptions,
    queryFn: () => dishesApi.options(),
    enabled: dishId !== undefined,
    staleTime: 5 * 60_000,
  });
  const ingredients = useQuery({
    queryKey: qk.ingredientOptions,
    queryFn: () => ingredientsApi.options(),
    enabled: ingredientId !== undefined,
    staleTime: 5 * 60_000,
  });

  const rows = query.data?.items;
  /** Name for a linked filter: catalog first (active items), then the loaded rows (archived ones). */
  const itemName = (kind: StockItemType, id: number) =>
    (kind === 'DISH' ? dishes.data : ingredients.data)?.find((item) => item.id === id)?.name ??
    rows?.find((row) => row.itemType === kind && row.item?.id === id)?.item?.name ??
    `#${id}`;
  const linkedOrderNumber = rows?.find((row) => row.orderId === orderId)?.orderNumber;

  const chips: { key: LinkedFilter; label: string }[] = [];
  if (dishId) chips.push({ key: 'dishId', label: `Позиция: ${itemName('DISH', dishId)}` });
  if (ingredientId) chips.push({ key: 'ingredientId', label: `Ингредиент: ${itemName('INGREDIENT', ingredientId)}` });
  if (orderId) chips.push({ key: 'orderId', label: linkedOrderNumber ? `Заказ #${linkedOrderNumber}` : `Заказ (ID ${orderId})` });

  const today = todayPeriod();
  const hasFilters =
    Boolean(list.search || type || itemType || location || userId || chips.length) ||
    period.from !== today.from ||
    period.to !== today.to;

  const resetFilters = () =>
    list.setFilters({
      q: undefined,
      type: undefined,
      itemType: undefined,
      location: undefined,
      userId: undefined,
      dishId: undefined,
      ingredientId: undefined,
      orderId: undefined,
      from: undefined,
      to: undefined,
    });

  const showItem = (row: MovementView) => {
    if (!row.item) return;
    list.setFilters(
      row.itemType === 'DISH'
        ? { dishId: row.item.id, ingredientId: undefined }
        : { ingredientId: row.item.id, dishId: undefined },
    );
  };

  const userOptions: SelectOption<number>[] = (users.data ?? []).map((user) => ({
    value: user.id,
    label: user.fullName,
    hint: user.roleName ?? undefined,
  }));

  const columns: Column<MovementView>[] = [
    {
      key: 'createdAt',
      header: 'Дата',
      cell: (row) => <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'item',
      header: 'Название',
      cell: (row) =>
        row.item ? (
          <button
            type="button"
            title="Показать движения только этой позиции"
            onClick={() => showItem(row)}
            className="font-semibold text-ink-900 transition-colors hover:text-brand-800 hover:underline"
          >
            {row.item.name}
          </button>
        ) : (
          muted
        ),
    },
    {
      key: 'itemType',
      header: 'Тип',
      cell: (row) => (
        <Badge size="sm" tone="neutral">
          {row.itemType === 'INGREDIENT' ? 'Ингредиент' : 'Блюдо'}
        </Badge>
      ),
    },
    {
      key: 'type',
      header: 'Операция',
      cell: (row) => <MovementTypeBadge type={row.type} />,
    },
    {
      key: 'location',
      header: 'Место',
      cell: (row) => (row.location ? <span className="text-ink-700">{LOCATION_LABELS[row.location]}</span> : muted),
    },
    {
      key: 'quantity',
      header: 'Изменение',
      cell: (row) => <QtyDelta value={row.quantity} unit={row.item?.unit} />,
    },
    {
      key: 'balanceAfter',
      header: 'Остаток после',
      cell: (row) => (
        <span className="whitespace-nowrap tabular">
          <span className={row.balanceAfter < 0 ? 'font-medium text-danger-600' : 'text-ink-800'}>
            {formatQty(row.balanceAfter)}
          </span>{' '}
          <span className="text-xs text-ink-500">{unitLabel(row.item?.unit)}</span>
        </span>
      ),
    },
    {
      key: 'document',
      header: 'Документ',
      cell: (row) => {
        if (row.orderId) {
          const label = `Заказ #${row.orderNumber ?? row.orderId}`;
          return canOpenOrders ? (
            <Link
              to={`/pos/order/${row.orderId}`}
              className="font-medium whitespace-nowrap text-brand-700 hover:text-brand-900 hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span className="whitespace-nowrap text-ink-700">{label}</span>
          );
        }
        if (row.receiptId) return <span className="whitespace-nowrap text-ink-700">Приход #{row.receiptId}</span>;
        return muted;
      },
    },
    {
      key: 'createdBy',
      header: 'Кто',
      cell: (row) => (row.createdBy ? <span className="whitespace-nowrap">{row.createdBy.fullName}</span> : muted),
    },
    {
      key: 'comment',
      header: 'Комментарий',
      cell: (row) =>
        row.comment ? (
          <span className="mx-auto block max-w-56 truncate text-ink-600" title={row.comment}>
            {row.comment}
          </span>
        ) : (
          muted
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="История склада" subtitle="Все изменения остатков блюд и ингредиентов" />
      <PeriodCard value={period} onChange={setPeriod} />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск по названию" />
          <Select
            value={itemType ?? ''}
            onChange={(value) => list.setFilter('itemType', value)}
            options={ITEM_TYPE_OPTIONS}
            className="w-48"
          />
          <Select
            value={type ?? ''}
            onChange={(value) => list.setFilter('type', value)}
            options={TYPE_OPTIONS}
            className="w-56"
          />
          <Select
            value={location ?? ''}
            onChange={(value) => list.setFilter('location', value)}
            options={LOCATION_OPTIONS}
            className="w-40"
          />
          <Combobox
            value={userId ?? null}
            onChange={(value) => list.setFilter('userId', value)}
            options={userOptions}
            placeholder="Все сотрудники"
            emptyText="Сотрудник не найден"
            clearable
            className="w-full sm:w-56"
          />
          {hasFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              Сбросить
            </Button>
          )}
        </Toolbar>
        {chips.length > 0 && (
          <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <Badge key={chip.key} tone="brand" className="py-0.5 pr-1">
                {chip.label}
                <button
                  type="button"
                  aria-label={`Убрать фильтр «${chip.label}»`}
                  onClick={() => list.setFilter(chip.key, undefined)}
                  className="rounded-full p-0.5 text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-900"
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <DataTable
          columns={columns}
          rows={rows ?? (query.isError ? [] : undefined)}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={(list.page - 1) * list.limit}
          empty={
            query.isError ? (
              <LoadError error={query.error} />
            ) : (
              <EmptyState compact title="Нет записей" description="Измените период или условия фильтра" />
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
    </div>
  );
}
