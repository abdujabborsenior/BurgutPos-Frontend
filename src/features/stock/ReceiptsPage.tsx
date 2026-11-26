import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { stockApi } from '@/api/stock.api';
import type { ReceiptView, StockItemType } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  DateRangePicker,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Segmented,
  Select,
  Toolbar,
  usePrompt,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { formatCurrency, formatDateTime, formatMoney, formatQty, plural, shiftDateKey, todayKey } from '@/lib/format';
import { LOCATION_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { ReceiptFormModal } from './ReceiptFormModal';
import { LoadError } from './StockParts';
import {
  formatQtyUnit,
  ITEM_TYPE_FILTER_OPTIONS,
  pickOption,
  RECEIPT_LOCATION_LABELS,
  unitLabel,
} from './stock.utils';

type Period = 'all' | 'today' | '7d' | '30d' | 'custom';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'За всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: 'Последние 7 дней' },
  { value: '30d', label: 'Последние 30 дней' },
  { value: 'custom', label: 'Период…' },
];

const PERIODS = PERIOD_OPTIONS.map((option) => option.value);
const ITEM_TYPES: readonly StockItemType[] = ['DISH', 'INGREDIENT'];

function periodRange(period: Period, filters: Record<string, string>): { from?: string; to?: string } {
  const today = todayKey();
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: shiftDateKey(today, -6), to: today };
    case '30d':
      return { from: shiftDateKey(today, -29), to: today };
    case 'custom':
      return { from: filters.from ?? shiftDateKey(today, -29), to: filters.to ?? today };
    default:
      return {};
  }
}

const muted = <span className="text-ink-400">—</span>;

export default function ReceiptsPage() {
  const list = useListState({ sortBy: 'createdAt', sortOrder: 'DESC', filters: { archived: 'false', period: 'all' } });
  const canManage = useCan(Permission.StockManage);
  const prompt = usePrompt();
  const [formOpen, setFormOpen] = useState(false);

  const archived = list.filters.archived === 'true';
  const itemType = pickOption(list.filters.itemType, ITEM_TYPES) ?? '';
  const period = pickOption(list.filters.period, PERIODS) ?? 'all';
  const range = periodRange(period, list.filters);

  const params = {
    page: list.page,
    limit: list.limit,
    search: list.search,
    archived,
    itemType: itemType || undefined,
    from: range.from,
    to: range.to,
    sortBy: list.sortBy,
    sortOrder: list.sortOrder,
  };
  const query = useQuery({
    queryKey: qk.receipts(params),
    queryFn: () => stockApi.receipts(params),
    placeholderData: keepPreviousData,
  });
  const summary = query.data?.summary;
  const hasFilters = Boolean(list.search || itemType || period !== 'all');

  const archive = useMutation({
    mutationFn: ({ receipt, reason }: { receipt: ReceiptView; reason: string }) =>
      stockApi.archiveReceipt(receipt.id, reason || undefined),
    onSuccess: (_result, { receipt }) => {
      toast.success(`Приход «${receipt.item?.name ?? `#${receipt.id}`}» отменён и перемещён в архив`);
      invalidateScopes('stock', 'menu');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const askArchive = async (receipt: ReceiptView) => {
    const amount = formatQtyUnit(receipt.quantity, receipt.item?.unit);
    const place = receipt.location ? ` (${LOCATION_LABELS[receipt.location].toLowerCase()})` : '';
    const reason = await prompt({
      title: `Отменить приход «${receipt.item?.name ?? `#${receipt.id}`}»?`,
      description:
        `Остаток уменьшится обратно на ${amount}${place}, приход переместится в архив.` +
        (receipt.itemType === 'DISH'
          ? ' Если часть уже продана или списана, отмена может быть отклонена из-за нехватки остатка.'
          : ''),
      confirmText: 'Отменить приход',
      tone: 'danger',
      reason: { label: 'Причина', placeholder: 'Необязательно, например: ошибка ввода' },
    });
    if (reason !== null) archive.mutate({ receipt, reason });
  };

  const changePeriod = (next: Period) => {
    if (next === 'custom') {
      const today = todayKey();
      list.setFilters({ period: next, from: shiftDateKey(today, -29), to: today });
    } else {
      list.setFilters({ period: next, from: undefined, to: undefined });
    }
  };

  const columns: Column<ReceiptView>[] = [
    {
      key: 'createdAt',
      header: 'Дата',
      sortKey: 'createdAt',
      cell: (row) => <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'item',
      header: 'Позиция',
      sortKey: 'item',
      cell: (row) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-2">
            <span className="font-semibold text-ink-900">{row.item?.name ?? `#${row.id}`}</span>
            {row.itemType === 'INGREDIENT' && (
              <Badge size="sm" tone="neutral">
                Ингредиент
              </Badge>
            )}
          </span>
          {row.location && <span className="text-xs text-ink-500">{RECEIPT_LOCATION_LABELS[row.location]}</span>}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Кол-во',
      sortKey: 'quantity',
      cell: (row) => (
        <span className="whitespace-nowrap tabular">
          {formatQty(row.quantity)} <span className="text-xs text-ink-500">{unitLabel(row.item?.unit)}</span>
        </span>
      ),
    },
    {
      key: 'purchasePrice',
      header: 'Цена закупки',
      sortKey: 'purchasePrice',
      cell: (row) => <span className="tabular">{formatMoney(row.purchasePrice)}</span>,
    },
    {
      key: 'salePrice',
      header: 'Цена продажи',
      sortKey: 'salePrice',
      cell: (row) =>
        row.itemType === 'DISH' && row.salePrice !== null ? <span className="tabular">{formatMoney(row.salePrice)}</span> : muted,
    },
    {
      key: 'total',
      header: 'Сумма',
      sortKey: 'total',
      cell: (row) => <span className="font-semibold text-ink-900 tabular">{formatMoney(row.total)}</span>,
    },
    {
      key: 'createdBy',
      header: 'Кто добавил',
      cell: (row) => row.createdBy?.fullName ?? muted,
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
    ...(archived
      ? [
          {
            key: 'archivedAt',
            header: 'Архивирован',
            cell: (row: ReceiptView) => (
              <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.archivedAt)}</span>
            ),
          },
          {
            key: 'archivedBy',
            header: 'Кем',
            cell: (row: ReceiptView) => row.archivedBy?.fullName ?? muted,
          },
          {
            key: 'archiveReason',
            header: 'Причина',
            cell: (row: ReceiptView) =>
              row.archiveReason ? (
                <span className="mx-auto block max-w-56 truncate text-ink-600" title={row.archiveReason}>
                  {row.archiveReason}
                </span>
              ) : (
                muted
              ),
          },
        ]
      : []),
    ...(!archived && canManage
      ? [
          {
            key: 'actions',
            header: 'Действия',
            cell: (row: ReceiptView) => (
              <div className="flex items-center justify-center">
                <IconButton
                  label="Отменить приход"
                  icon={<Trash2 />}
                  size="sm"
                  variant="danger"
                  loading={archive.isPending && archive.variables?.receipt.id === row.id}
                  onClick={() => void askArchive(row)}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Приход"
        subtitle={
          summary
            ? `${formatQty(summary.count)} ${plural(summary.count, ['операция', 'операции', 'операций'])} · ${formatCurrency(summary.totalSum)}`
            : ' '
        }
        actions={
          canManage && (
            <Button leftIcon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
              Добавить приход
            </Button>
          )
        }
      />
      <Panel>
        <Toolbar>
          <Segmented
            items={[
              { value: 'false', label: 'Активные' },
              { value: 'true', label: 'Архив' },
            ]}
            value={archived ? 'true' : 'false'}
            onChange={(value) => list.setFilter('archived', value)}
          />
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск по позиции" />
          <Select
            value={itemType}
            onChange={(value) => list.setFilter('itemType', value)}
            options={ITEM_TYPE_FILTER_OPTIONS}
            className="w-48"
          />
          <Select value={period} onChange={changePeriod} options={PERIOD_OPTIONS} className="w-48" />
          {period === 'custom' && range.from && range.to && (
            <DateRangePicker
              value={{ from: range.from, to: range.to }}
              onChange={(next) => list.setFilters({ from: next.from, to: next.to })}
            />
          )}
        </Toolbar>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? (query.isError ? [] : undefined)}
          rowKey={(row) => row.id}
          empty={
            query.isError ? (
              <LoadError error={query.error} />
            ) : !hasFilters ? (
              <EmptyState
                compact
                title={archived ? 'Архив пуст' : 'Приходов пока нет'}
                description={
                  archived
                    ? 'Сюда попадают отменённые приходы'
                    : 'Оформите приход — остатки товаров и ингредиентов обновятся автоматически'
                }
                action={
                  !archived &&
                  canManage && (
                    <Button leftIcon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
                      Добавить приход
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
      {canManage && <ReceiptFormModal open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
