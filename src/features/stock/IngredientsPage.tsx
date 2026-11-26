import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, CircleMinus, ClipboardList, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ingredientsApi } from '@/api/stock.api';
import type { ArchiveStatus, IngredientView } from '@/api/types';
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
  Segmented,
  Switch,
  Toolbar,
  useConfirm,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatDateTime, formatMoney, formatQty, plural } from '@/lib/format';
import { INGREDIENT_UNIT_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { IngredientAdjustModal } from './IngredientAdjustModal';
import { IngredientFormModal } from './IngredientFormModal';
import { IngredientWriteOffModal } from './IngredientWriteOffModal';
import { StockHistoryDrawer } from './StockHistoryDrawer';
import { LoadError } from './StockParts';
import { formatQtyUnit } from './stock.utils';

type IngredientDialog = 'form' | 'adjust' | 'writeOff' | 'history';
type IngredientAction = 'archive' | 'restore' | 'delete';

const ACTION_DONE: Record<IngredientAction, string> = {
  archive: 'Ингредиент перемещён в архив',
  restore: 'Ингредиент восстановлен',
  delete: 'Ингредиент удалён',
};

const muted = <span className="text-ink-400">—</span>;

function QuantityCell({ row }: { row: IngredientView }) {
  const negative = row.quantity < 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={
          negative
            ? 'font-semibold text-danger-600 tabular'
            : row.isLow
              ? 'font-semibold text-warning-700 tabular'
              : 'text-ink-800 tabular'
        }
      >
        {formatQty(row.quantity)}
      </span>
      {row.isLow && (
        <Badge size="sm" tone={negative ? 'danger' : 'warning'}>
          Мало
        </Badge>
      )}
    </span>
  );
}

export default function IngredientsPage() {
  const list = useListState({ sortBy: 'name', sortOrder: 'ASC', filters: { status: 'active' } });
  // Two tabs as in the reference; an old "all" link falls back to the active list.
  const status: ArchiveStatus = list.filters.status === 'archived' ? 'archived' : 'active';
  const lowStock = list.filters.lowStock === 'true';
  const canManage = useCan(Permission.StockManage);
  const confirm = useConfirm();
  const [selected, setSelected] = useState<IngredientView | null>(null);
  const [dialog, setDialog] = useState<IngredientDialog | null>(null);

  const params = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    status,
    lowStock: lowStock || undefined,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.ingredients(params),
    queryFn: () => ingredientsApi.list(params),
    placeholderData: keepPreviousData,
  });
  const counts = query.data?.counts;

  const action = useMutation({
    mutationFn: async ({ kind, ingredient }: { kind: IngredientAction; ingredient: IngredientView }) => {
      if (kind === 'archive') await ingredientsApi.archive(ingredient.id);
      if (kind === 'restore') await ingredientsApi.restore(ingredient.id);
      if (kind === 'delete') await ingredientsApi.remove(ingredient.id);
      return kind;
    },
    onSuccess: (kind) => {
      toast.success(ACTION_DONE[kind]);
      invalidateScopes('stock', 'menu');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const askArchive = async (ingredient: IngredientView) => {
    const ok = await confirm({
      title: `Архивировать «${ingredient.name}»?`,
      description:
        'Ингредиент скроется из выбора в техкартах и приходах. Остаток и история движения сохранятся, восстановить можно в любой момент.',
      confirmText: 'В архив',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', ingredient });
  };

  const askDelete = async (ingredient: IngredientView) => {
    const ok = await confirm({
      title: `Удалить «${ingredient.name}» навсегда?`,
      description: 'Удалить можно только ингредиент без движений на складе. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', ingredient });
  };

  const openDialog = (row: IngredientView | null, kind: IngredientDialog) => {
    setSelected(row);
    setDialog(kind);
  };
  const closeDialog = () => setDialog(null);
  const busy = (row: IngredientView) => action.isPending && action.variables?.ingredient.id === row.id;

  const columns: Column<IngredientView>[] = [
    {
      key: 'name',
      header: 'Название',
      sortKey: 'name',
      cell: (row) => <span className="font-semibold text-ink-900">{row.name}</span>,
    },
    {
      key: 'unit',
      header: 'Ед.',
      cell: (row) => <span className="text-ink-600">{INGREDIENT_UNIT_LABELS[row.unit]}</span>,
    },
    {
      key: 'quantity',
      header: 'Остаток',
      sortKey: 'quantity',
      cell: (row) => <QuantityCell row={row} />,
    },
    {
      key: 'minQuantity',
      header: 'Мин. остаток',
      sortKey: 'minQuantity',
      cell: (row) => <span className="text-ink-600 tabular">{formatQty(row.minQuantity)}</span>,
    },
    {
      key: 'costPrice',
      header: 'Цена за ед.',
      sortKey: 'costPrice',
      cell: (row) => (row.costPrice > 0 ? <span className="tabular">{formatMoney(row.costPrice)}</span> : muted),
    },
    {
      key: 'dishes',
      header: 'В блюдах',
      cell: (row) => (
        <span className={row.dishesCount > 0 ? 'text-ink-800 tabular' : 'text-ink-400 tabular'}>{row.dishesCount}</span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Кто добавил',
      cell: (row) =>
        row.createdBy ? <span className="whitespace-nowrap text-ink-700">{row.createdBy.fullName}</span> : muted,
    },
    {
      key: 'createdAt',
      header: 'Дата',
      sortKey: 'createdAt',
      cell: (row) => <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
        <div className="flex items-center justify-center gap-1">
          {canManage && (
            <IconButton label="Редактировать" icon={<Pencil />} size="sm" onClick={() => openDialog(row, 'form')} />
          )}
          {canManage && row.isActive && (
            <>
              <IconButton
                label="Инвентаризация"
                icon={<ClipboardList />}
                size="sm"
                onClick={() => openDialog(row, 'adjust')}
              />
              <IconButton
                label="Списание"
                icon={<CircleMinus />}
                size="sm"
                variant="danger"
                disabled={row.quantity <= 0}
                onClick={() => openDialog(row, 'writeOff')}
              />
            </>
          )}
          <IconButton label="История движения" icon={<History />} size="sm" onClick={() => openDialog(row, 'history')} />
          {canManage &&
            (row.isActive ? (
              <IconButton
                label={
                  row.dishesCount > 0
                    ? `Используется в техкартах (${row.dishesCount}) — сначала уберите его из блюд`
                    : 'В архив'
                }
                icon={<Archive />}
                size="sm"
                variant="danger"
                disabled={row.dishesCount > 0}
                loading={busy(row)}
                onClick={() => void askArchive(row)}
              />
            ) : (
              <>
                <IconButton
                  label="Восстановить"
                  icon={<ArchiveRestore />}
                  size="sm"
                  variant="brand"
                  loading={busy(row) && action.variables?.kind === 'restore'}
                  disabled={busy(row)}
                  onClick={() => action.mutate({ kind: 'restore', ingredient: row })}
                />
                <IconButton
                  label="Удалить навсегда"
                  icon={<Trash2 />}
                  size="sm"
                  variant="danger"
                  loading={busy(row) && action.variables?.kind === 'delete'}
                  disabled={busy(row)}
                  onClick={() => void askDelete(row)}
                />
              </>
            ))}
        </div>
      ),
    },
  ];

  // Dialogs keep the click-time snapshot; the history header follows live data.
  const historyRow = query.data?.items.find((row) => row.id === selected?.id) ?? selected;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ингредиенты"
        subtitle={
          counts ? (
            <>
              Сырьё, которое расходуется по рецептам блюд · {counts.active} активных
              {counts.lowStock > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-warning-700">
                    {counts.lowStock} {plural(counts.lowStock, ['заканчивается', 'заканчиваются', 'заканчиваются'])}
                  </span>
                </>
              )}
            </>
          ) : (
            ' '
          )
        }
        actions={
          canManage && (
            <Button leftIcon={<Plus className="size-4" />} onClick={() => openDialog(null, 'form')}>
              Добавить ингредиент
            </Button>
          )
        }
      />
      <Segmented
        size="sm"
        value={status}
        onChange={(value) => list.setFilter('status', value)}
        items={[
          { value: 'active', label: 'Активные', count: counts?.active },
          { value: 'archived', label: 'Архив', count: counts?.archived },
        ]}
      />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск по названию" />
          <Switch
            checked={lowStock}
            onChange={(checked) => list.setFilter('lowStock', checked ? 'true' : undefined)}
            label="Только заканчивающиеся"
            className="items-center gap-3 px-1"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? (query.isError ? [] : undefined)}
          rowKey={(row) => row.id}
          empty={
            query.isError ? (
              <LoadError error={query.error} />
            ) : status === 'active' && !list.search && !lowStock && counts?.active === 0 ? (
              <EmptyState
                compact
                title="Ингредиентов пока нет"
                description="Добавьте ингредиенты, чтобы использовать их в техкартах блюд и приходах"
                action={
                  canManage && (
                    <Button leftIcon={<Plus className="size-4" />} onClick={() => openDialog(null, 'form')}>
                      Добавить
                    </Button>
                  )
                }
              />
            ) : undefined
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

      <IngredientFormModal open={dialog === 'form'} ingredient={selected} onClose={closeDialog} />
      <IngredientAdjustModal open={dialog === 'adjust'} ingredient={selected} onClose={closeDialog} />
      <IngredientWriteOffModal open={dialog === 'writeOff'} ingredient={selected} onClose={closeDialog} />
      <StockHistoryDrawer
        open={dialog === 'history'}
        target={historyRow && { kind: 'ingredient', id: historyRow.id, name: historyRow.name }}
        description={historyRow && `Остаток: ${formatQtyUnit(historyRow.quantity, historyRow.unit)}`}
        onClose={closeDialog}
      />
    </div>
  );
}
