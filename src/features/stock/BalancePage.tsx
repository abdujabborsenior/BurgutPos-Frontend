import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, History, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { categoriesApi } from '@/api/menu.api';
import { stockApi, type DishStockView } from '@/api/stock.api';
import type { BalanceRow, Paginated } from '@/api/types';
import {
  DataTable,
  IconButton,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Select,
  Switch,
  Toolbar,
  useConfirm,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatQty, plural } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { DishAdjustModal } from './DishAdjustModal';
import { DishTransferModal } from './DishTransferModal';
import { DishWriteOffModal } from './DishWriteOffModal';
import { StockHistoryDrawer } from './StockHistoryDrawer';
import { DishStockModal } from '@/features/menu/DishStockModal';
import { LoadError, StockCellButton, StockQty, UnlimitedMark } from './StockParts';
import { formatQtyUnit, toId } from './stock.utils';

type DishDialog = 'adjust' | 'transfer' | 'writeOff' | 'history';

const BALANCE_SCOPE = ['stock', 'balance'] as const;

const TRACKING_OPTIONS = [
  { value: 'all', label: 'Все позиции' },
  { value: 'true', label: 'С учётом остатка' },
  { value: 'false', label: 'Без учёта' },
];

const canTransfer = (row: BalanceRow) =>
  row.trackStock && (row.saleQty > 0 || row.warehouseQty > 0);
const canWriteOff = (row: BalanceRow) =>
  row.warehouseQty > 0 || (row.trackStock && row.saleQty > 0);

export default function BalancePage() {
  const list = useListState({ sortBy: 'name', sortOrder: 'ASC', filters: { tracked: 'all' } });
  const canManage = useCan(Permission.StockManage);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<BalanceRow | null>(null);
  const [dialog, setDialog] = useState<DishDialog | null>(null);
  /** «Изменить остаток»: quantity in sale and whether it is counted at all (∞). */
  const [stockDish, setStockDish] = useState<BalanceRow | null>(null);
  /** Optimistic switch positions while the tracking request is in flight. */
  const [pendingTracking, setPendingTracking] = useState<Record<number, boolean>>({});

  const categoryId = list.filters.categoryId ?? '';
  const tracked = list.filters.tracked;
  const params = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    categoryId: toId(categoryId),
    tracked: tracked === 'true' ? true : tracked === 'false' ? false : undefined,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.balance(params),
    queryFn: () => stockApi.balance(params),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: qk.categoryOptions,
    queryFn: () => categoriesApi.options(),
    staleTime: 5 * 60_000,
  });

  /** Puts fresh quantities from a stock operation into every cached balance page at once. */
  const applyView = (view: DishStockView) => {
    queryClient.setQueriesData<Paginated<BalanceRow>>({ queryKey: BALANCE_SCOPE }, (data) =>
      data
        ? {
            ...data,
            items: data.items.map((row) =>
              row.id === view.id
                ? {
                    ...row,
                    trackStock: view.trackStock,
                    saleQty: view.saleQty,
                    warehouseQty: view.warehouseQty,
                    totalQty: view.totalQty,
                  }
                : row,
            ),
          }
        : data,
    );
  };

  const tracking = useMutation({
    mutationFn: ({ row, value }: { row: BalanceRow; value: boolean }) =>
      stockApi.setTracking(row.id, value),
    onMutate: ({ row, value }) =>
      setPendingTracking((current) => ({ ...current, [row.id]: value })),
    onSuccess: (view, { row, value }) => {
      applyView(view);
      if (!value) toast.success(`«${view.name}» продаётся без учёта остатка`);
      else if (view.saleQty > 0) toast.success(`Учёт остатка «${view.name}» включён`);
      else {
        toast.warning(`Учёт остатка «${view.name}» включён`, {
          description: `В продаже ${formatQtyUnit(view.saleQty, row.unit)} — оформите приход или переместите позицию со склада.`,
        });
      }
      invalidateScopes('stock', 'menu');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: (_view, _error, { row }) =>
      setPendingTracking((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      }),
  });

  const toggleTracking = async (row: BalanceRow, value: boolean) => {
    if (!value) {
      const ok = await confirm({
        title: `Отключить учёт остатка «${row.name}»?`,
        description:
          'Позиция будет продаваться без ограничения количества: продажи перестанут списывать остаток. Текущие остатки сохранятся, учёт можно включить снова в любой момент.',
        confirmText: 'Отключить учёт',
      });
      if (!ok) return;
    }
    tracking.mutate({ row, value });
  };

  const openDialog = (row: BalanceRow, kind: DishDialog) => {
    setSelected(row);
    setDialog(kind);
  };
  const closeDialog = () => setDialog(null);

  const columns: Column<BalanceRow>[] = [
    {
      key: 'name',
      header: 'Название',
      sortKey: 'name',
      cell: (row) => <span className="text-ink-900 font-semibold">{row.name}</span>,
    },
    {
      key: 'sale',
      header: 'В продаже',
      sortKey: 'saleQty',
      cell: (row) => (
        <StockCellButton
          hint="Изменить остаток"
          disabled={!canManage}
          onClick={() => setStockDish(row)}
        >
          {row.trackStock ? <StockQty value={row.saleQty} /> : <UnlimitedMark title={null} />}
        </StockCellButton>
      ),
    },
    {
      key: 'warehouse',
      header: 'На складе',
      sortKey: 'warehouseQty',
      cell: (row) => (
        <StockCellButton
          hint="Инвентаризация — изменить остаток на складе"
          disabled={!canManage}
          onClick={() => openDialog(row, 'adjust')}
        >
          <StockQty value={row.warehouseQty} alert={row.trackStock} />
        </StockCellButton>
      ),
    },
    {
      key: 'total',
      header: 'Всего',
      sortKey: 'totalQty',
      cell: (row) =>
        row.trackStock ? (
          <StockQty value={row.totalQty} className="font-semibold" />
        ) : (
          <span className="whitespace-nowrap">
            <StockQty value={row.warehouseQty} alert={false} />{' '}
            <span className="text-ink-500">(∞)</span>
          </span>
        ),
    },
    {
      key: 'tracking',
      header: 'Учитывать остаток',
      cell: (row) => (
        <Switch
          size="sm"
          checked={pendingTracking[row.id] ?? row.trackStock}
          onChange={(value) => void toggleTracking(row, value)}
          disabled={!canManage || row.id in pendingTracking}
          aria-label={`Учитывать остаток «${row.name}»`}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
        <div className="flex items-center justify-center gap-1">
          {canManage && (
            <>
              <IconButton
                label="Инвентаризация"
                icon={<Pencil />}
                size="sm"
                onClick={() => openDialog(row, 'adjust')}
              />
              <IconButton
                label={row.trackStock ? 'Перемещение' : 'Перемещение доступно при учёте остатка'}
                icon={<ArrowLeftRight />}
                size="sm"
                disabled={!canTransfer(row)}
                onClick={() => openDialog(row, 'transfer')}
              />
              <IconButton
                label="Списание"
                icon={<Trash2 />}
                size="sm"
                variant="danger"
                disabled={!canWriteOff(row)}
                onClick={() => openDialog(row, 'writeOff')}
              />
            </>
          )}
          <IconButton
            label="История движения"
            icon={<History />}
            size="sm"
            onClick={() => openDialog(row, 'history')}
          />
        </div>
      ),
    },
  ];

  const total = query.data?.total;
  // Dialogs keep the click-time snapshot (their forms must not reset mid-edit);
  // the history header follows live quantities.
  const historyRow = query.data?.items.find((row) => row.id === selected?.id) ?? selected;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Остаток"
        subtitle={
          total !== undefined
            ? `${formatQty(total)} ${plural(total, ['позиция', 'позиции', 'позиций'])}`
            : ' '
        }
      />
      <Panel>
        <Toolbar>
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Поиск по названию"
          />
          <Select
            value={categoryId}
            onChange={(value) => list.setFilter('categoryId', value)}
            options={[
              { value: '', label: 'Все категории' },
              ...(categories.data ?? []).map((category) => ({
                value: String(category.id),
                label: category.name,
              })),
            ]}
            className="w-52"
          />
          <Select
            value={tracked}
            onChange={(value) => list.setFilter('tracked', value)}
            options={TRACKING_OPTIONS}
            className="w-52"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? (query.isError ? [] : undefined)}
          rowKey={(row) => row.id}
          empty={query.isError ? <LoadError error={query.error} /> : undefined}
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
          total={total ?? 0}
          onPageChange={list.setPage}
          onLimitChange={list.setLimit}
        />
      </Panel>

      <DishStockModal dish={stockDish} onClose={() => setStockDish(null)} />
      <DishAdjustModal
        open={dialog === 'adjust'}
        dish={selected}
        onClose={closeDialog}
        onDone={applyView}
      />
      <DishTransferModal
        open={dialog === 'transfer'}
        dish={selected}
        onClose={closeDialog}
        onDone={applyView}
      />
      <DishWriteOffModal
        open={dialog === 'writeOff'}
        dish={selected}
        onClose={closeDialog}
        onDone={applyView}
      />
      <StockHistoryDrawer
        open={dialog === 'history'}
        target={historyRow && { kind: 'dish', id: historyRow.id, name: historyRow.name }}
        description={
          historyRow &&
          (historyRow.trackStock
            ? `В продаже: ${formatQtyUnit(historyRow.saleQty, historyRow.unit)} · На складе: ${formatQtyUnit(historyRow.warehouseQty, historyRow.unit)}`
            : `Без учёта остатка · На складе: ${formatQtyUnit(historyRow.warehouseQty, historyRow.unit)}`)
        }
        onClose={closeDialog}
      />
    </div>
  );
}
