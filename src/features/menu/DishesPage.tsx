import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ArchiveRestore, ImageOff, Pencil, Plus, Sprout, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { categoriesApi, dishesApi } from '@/api/menu.api';
import { printersApi } from '@/api/settings.api';
import type { ArchiveStatus, DishView } from '@/api/types';
import {
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
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { DISH_UNIT_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { StockCellButton, UnlimitedMark } from '@/features/stock/StockParts';
import { DishFormModal } from './DishFormModal';
import { DishRecipeModal } from './DishRecipeModal';
import { DishStockModal } from './DishStockModal';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

export default function DishesPage() {
  const list = useListState({
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    filters: { status: 'active' },
  });
  const status = list.filters.status as ArchiveStatus;
  const categoryId = list.filters.category ? Number(list.filters.category) : undefined;
  const printerId = list.filters.printer ? Number(list.filters.printer) : undefined;
  const availability = list.filters.available;
  const canManage = useCan(Permission.MenuManage);
  const canStock = useCan(Permission.StockManage);
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stockDish, setStockDish] = useState<DishView | null>(null);
  const [recipeDish, setRecipeDish] = useState<DishView | null>(null);

  const params = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    status,
    categoryId,
    printerId,
    isAvailable: availability === 'yes' ? true : availability === 'no' ? false : undefined,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.dishes(params),
    queryFn: () => dishesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: qk.categoryOptions, queryFn: categoriesApi.options });
  const printers = useQuery({ queryKey: qk.printerOptions, queryFn: printersApi.options });
  const counts = query.data?.counts;

  const action = useMutation({
    mutationFn: async ({
      kind,
      dish,
    }: {
      kind: 'archive' | 'restore' | 'delete' | 'available' | 'unavailable';
      dish: DishView;
    }) => {
      if (kind === 'archive') await dishesApi.archive(dish.id);
      if (kind === 'restore') await dishesApi.restore(dish.id);
      if (kind === 'delete') await dishesApi.remove(dish.id);
      if (kind === 'available') await dishesApi.setAvailability(dish.id, true);
      if (kind === 'unavailable') await dishesApi.setAvailability(dish.id, false);
      return kind;
    },
    onSuccess: (kind, { dish }) => {
      const messages = {
        archive: `«${dish.name}» удалено — оно в архиве, история продаж сохранена`,
        restore: `«${dish.name}» восстановлено`,
        delete: `«${dish.name}» удалено`,
        available: `«${dish.name}» снова в наличии`,
        unavailable: `«${dish.name}» отмечено как «нет в наличии»`,
      };
      toast.success(messages[kind]);
      invalidateScopes('menu', 'stock');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (id: number | null) => {
    setEditingId(id);
    setFormOpen(true);
  };

  /** Наличие меняется одним щелчком, но с подтверждением: блюдо исчезает
   *  с экрана заказа у всех официантов сразу. */
  const askAvailability = async (dish: DishView) => {
    const ok = await confirm({
      title: 'Подтвердите действие',
      description: dish.isAvailable
        ? `Отметить «${dish.name}» как «Закончилось»?`
        : `Вернуть «${dish.name}» в наличие?`,
      confirmText: dish.isAvailable ? 'Закончилось' : 'В наличии',
      cancelText: 'Нет',
    });
    if (ok) action.mutate({ kind: dish.isAvailable ? 'unavailable' : 'available', dish });
  };

  const columns: Column<DishView>[] = [
    {
      key: 'photo',
      header: 'Фото',
      cell: (row) =>
        row.imageUrl ? (
          <img
            src={row.imageUrl}
            alt=""
            loading="lazy"
            className="ring-ink-150 mx-auto size-10 rounded-lg object-cover ring-1"
          />
        ) : (
          <span className="bg-ink-50 text-ink-300 mx-auto flex size-10 items-center justify-center rounded-lg">
            <ImageOff className="size-4" />
          </span>
        ),
    },
    {
      key: 'name',
      header: 'Блюдо',
      sortKey: 'name',
      cell: (row) => <span className="text-ink-900 font-semibold">{row.name}</span>,
    },
    {
      key: 'sortOrder',
      header: 'Порядок',
      sortKey: 'sortOrder',
      cell: (row) => <span className="tabular">{row.sortOrder}</span>,
    },
    {
      key: 'category',
      header: 'Категория',
      sortKey: 'category',
      cell: (row) => (
        <span className={cn(!row.category.isActive && 'text-ink-400')}>{row.category.name}</span>
      ),
    },
    {
      key: 'printer',
      header: 'Принтер',
      cell: (row) => row.printer?.name ?? <span className="text-ink-400">—</span>,
    },
    {
      key: 'price',
      header: 'Цена',
      sortKey: 'price',
      cell: (row) => (
        <span className="text-ink-900 tabular font-semibold">
          {formatMoney(row.price)}
          {row.unit !== 'PCS' && (
            <span className="text-ink-500 ml-1 text-xs font-normal">
              / {DISH_UNIT_LABELS[row.unit]}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'available',
      header: 'Наличие',
      sortKey: 'isAvailable',
      cell: (row) => (
        <button
          type="button"
          disabled={!canManage || !row.isActive}
          title={canManage ? 'Нажмите, чтобы изменить' : undefined}
          onClick={() => void askAvailability(row)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors ring-inset disabled:cursor-default',
            row.isAvailable
              ? 'bg-success-50 text-success-700 ring-success-200/70 enabled:hover:bg-success-100'
              : 'bg-ink-100 text-ink-600 ring-ink-200/70 enabled:hover:bg-ink-150',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              row.isAvailable ? 'bg-success-500' : 'bg-ink-400',
            )}
          />
          {row.isAvailable ? 'В наличии' : 'Нет в наличии'}
        </button>
      ),
    },
    {
      key: 'stock',
      header: 'Остаток',
      sortKey: 'saleQty',
      cell: (row) => (
        <StockCellButton
          hint="Изменить остаток"
          disabled={!canStock}
          onClick={() => setStockDish(row)}
        >
          {row.trackStock ? (
            <span
              className={cn(
                'tabular font-semibold',
                row.saleQty <= 0 ? 'text-danger-600' : 'text-ink-900',
              )}
            >
              {formatQty(row.saleQty)}
            </span>
          ) : (
            <UnlimitedMark title={null} />
          )}
        </StockCellButton>
      ),
    },
    {
      key: 'ingredients',
      header: 'Ингредиенты',
      cell: (row) => (
        <button
          type="button"
          title="Показать рецепт"
          onClick={() => setRecipeDish(row)}
          className={cn(
            'tabular hover:bg-ink-100 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors',
            row.ingredientsCount ? 'text-ink-800' : 'text-ink-400',
          )}
        >
          <Sprout className="size-3.5" />
          {row.ingredientsCount}
        </button>
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
      cell: (row) => row.createdBy?.fullName ?? <span className="text-ink-400">—</span>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Действия',
            cell: (row: DishView) => (
              <div className="flex items-center justify-center gap-1">
                <IconButton
                  label="Редактировать"
                  icon={<Pencil />}
                  size="sm"
                  className={ACTION_ICON}
                  onClick={() => openForm(row.id)}
                />
                {row.isActive ? (
                  <IconButton
                    label="Удалить"
                    icon={<Trash2 />}
                    size="sm"
                    className={DANGER_ICON}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Удалить «${row.name}»?`,
                        description:
                          'Блюдо скроется с экрана заказа и перейдёт в архив. История продаж и остатки сохранятся, блюдо можно восстановить.',
                        confirmText: 'Удалить',
                        tone: 'danger',
                      });
                      if (ok) action.mutate({ kind: 'archive', dish: row });
                    }}
                  />
                ) : (
                  <>
                    <IconButton
                      label="Восстановить"
                      icon={<ArchiveRestore />}
                      size="sm"
                      variant="brand"
                      onClick={() => action.mutate({ kind: 'restore', dish: row })}
                    />
                    <IconButton
                      label="Удалить навсегда"
                      icon={<Trash2 />}
                      size="sm"
                      className={DANGER_ICON}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Удалить «${row.name}» навсегда?`,
                          description:
                            'Удалить можно только блюдо без продаж и приходов. Действие необратимо.',
                          confirmText: 'Удалить',
                          tone: 'danger',
                        });
                        if (ok) action.mutate({ kind: 'delete', dish: row });
                      }}
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
        title="Блюда"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} в архиве` : ' '}
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
            className="w-44"
            options={[
              { value: 'active', label: `Активные${counts ? ` (${counts.active})` : ''}` },
              { value: 'archived', label: `Архив${counts ? ` (${counts.archived})` : ''}` },
              { value: 'all', label: 'Все' },
            ]}
          />
          <Select
            value={categoryId ?? null}
            onChange={(value) => list.setFilter('category', value)}
            className="w-52"
            options={[
              { value: null, label: 'Все категории' },
              ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            value={printerId ?? null}
            onChange={(value) => list.setFilter('printer', value)}
            className="w-44"
            options={[
              { value: null, label: 'Все принтеры' },
              ...(printers.data ?? []).map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Select
            value={availability ?? null}
            onChange={(value) => list.setFilter('available', value)}
            className="w-44"
            options={[
              { value: null, label: 'Любое наличие' },
              { value: 'yes', label: 'В наличии' },
              { value: 'no', label: 'Нет в наличии' },
            ]}
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
          onRowClick={canManage ? (row) => openForm(row.id) : undefined}
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
      <DishFormModal open={formOpen} dishId={editingId} onClose={() => setFormOpen(false)} />
      <DishStockModal dish={stockDish} onClose={() => setStockDish(null)} />
      <DishRecipeModal
        dish={recipeDish}
        onClose={() => setRecipeDish(null)}
        onEdit={
          canManage
            ? () => {
                const id = recipeDish?.id ?? null;
                setRecipeDish(null);
                if (id !== null) openForm(id);
              }
            : undefined
        }
      />
    </div>
  );
}
