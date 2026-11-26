import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { reportsApi } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { DishHistoryLine, DishHistoryReport } from '@/api/report-types';
import type { DishUnit } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  Modal,
  Pagination,
  type BadgeTone,
  type Column,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatQty, formatTime } from '@/lib/format';
import type { ReportScope } from '../scope/useReportScope';
import { lineQuantity, orderPlace, useDrilldown } from './drilldown';
import { ReportEmpty, ReportError, StackedValue, TotalsRow } from './ReportBits';

/** The row of «По блюдам» that was clicked. */
export interface DishTarget {
  dishId: number;
  name: string;
  unit: DishUnit;
}

const KIND_VIEW: Record<DishHistoryLine['kind'], { label: string; tone: BadgeTone }> = {
  paid: { label: 'Оплачено', tone: 'success' },
  pending: { label: 'Ожидает', tone: 'warning' },
  cancelled: { label: 'Отменено', tone: 'danger' },
};

/**
 * Figures read like the row they explain: paid plain, still pending amber
 * with "+", cancelled red with "−" — the same marks as in «По блюдам».
 */
function KindFigure({ line, value }: { line: DishHistoryLine; value: string }) {
  if (line.kind === 'pending') return <span className="text-warning-600 tabular">+{value}</span>;
  if (line.kind === 'cancelled') return <span className="text-danger-600 tabular">−{value}</span>;
  return <span className="text-ink-900 tabular">{value}</span>;
}

/** Long text wraps inside its cap, so the nine columns fit the window without a side scroll. */
const Wrapped = ({ text, width }: { text: string; width: string }) => (
  <span className={cn('mx-auto block leading-snug', width)}>{text}</span>
);

const CELL = 'px-3';

const columns: Column<DishHistoryLine>[] = [
  {
    key: 'when',
    header: 'Когда',
    className: CELL,
    cell: (line) => (
      <span className="tabular whitespace-nowrap">{formatDateTime(line.createdAt)}</span>
    ),
  },
  {
    key: 'order',
    header: 'Заказ',
    className: CELL,
    cell: (line) => <span className="text-ink-900 tabular font-medium">#{line.orderNumber}</span>,
  },
  {
    key: 'place',
    header: 'Стол / тип',
    className: CELL,
    cell: (line) => <Wrapped text={orderPlace(line.orderType, line.table)} width="max-w-44" />,
  },
  {
    key: 'addedBy',
    header: 'Добавил',
    className: CELL,
    cell: (line) => <Wrapped text={line.addedBy ?? '—'} width="max-w-28" />,
  },
  {
    key: 'waiter',
    header: 'Официант',
    className: CELL,
    cell: (line) => <Wrapped text={line.waiter ?? '—'} width="max-w-28" />,
  },
  {
    key: 'quantity',
    header: 'Кол-во',
    className: CELL,
    cell: (line) => <KindFigure line={line} value={lineQuantity(line.quantity, line.unit)} />,
  },
  {
    key: 'revenue',
    header: 'Выручка',
    className: CELL,
    cell: (line) => <KindFigure line={line} value={formatMoney(line.total)} />,
  },
  {
    key: 'status',
    header: 'Статус',
    className: CELL,
    cell: (line) => {
      const view = KIND_VIEW[line.kind];
      const note =
        line.kind === 'cancelled'
          ? [formatTime(line.cancelledAt), line.cancelReason, line.cancelledBy]
              .filter(Boolean)
              .join(' · ')
          : null;
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge size="sm" tone={view.tone}>
            {view.label}
          </Badge>
          {note && (
            <span className="text-ink-500 max-w-32 text-[11.5px] leading-tight">{note}</span>
          )}
        </div>
      );
    },
  },
];

/**
 * Every line of one dish behind its row in «По блюдам»: when it was added,
 * to which order and table, by whom, and whether it is paid, still waiting
 * for payment or cancelled. The totals are those of the row itself.
 */
export function DishHistoryModal({
  target,
  scopeParams,
  categoryId,
  subtitle,
  onClose,
}: {
  target: DishTarget | null;
  scopeParams: ReportScope['params'];
  /** The report's category filter — the history then adds up to the row. */
  categoryId?: number;
  subtitle: string;
  onClose: () => void;
}) {
  const view = useDrilldown(target);
  const dishId = view.shown?.dishId ?? 0;
  const params = { ...scopeParams, dishId, categoryId, page: view.page, limit: view.limit };
  const query = useQuery({
    queryKey: qk.report('dish-history', params),
    queryFn: () => reportsApi.dishHistory(params),
    enabled: view.shown !== null,
    // Paging keeps the current page on screen; another dish never flashes in.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as { dishId?: number } | undefined)?.dishId === dishId
        ? previous
        : undefined,
  });
  const data = query.data;
  const totals = data?.totals;

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="2xl"
      icon={<History />}
      title={`История блюда — ${view.shown?.name ?? ''}`}
      description={subtitle}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      {query.isError && !data ? (
        <ReportError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {totals && data.total > 0 && <HistorySummary totals={totals} unit={view.shown?.unit} />}
          <DataTable
            columns={columns}
            rows={data?.items}
            rowKey={(line) => line.id}
            loading={query.isLoading}
            fetching={query.isPlaceholderData}
            numberedFrom={view.offset}
            skeletonRows={6}
            rowClassName={(line) => cn(line.kind === 'cancelled' && 'bg-danger-50/40')}
            empty={<ReportEmpty title="Нет продаж блюда за период" />}
            footer={
              totals && data.total > 0 ? (
                <TotalsRow
                  columns={columns}
                  numbered
                  values={{
                    quantity: (
                      <StackedValue
                        value={totals.quantity}
                        pending={totals.pendingQuantity}
                        lost={totals.cancelledQuantity}
                        format={formatQty}
                      />
                    ),
                    revenue: (
                      <StackedValue
                        value={totals.revenue}
                        pending={totals.pendingRevenue}
                        lost={totals.cancelledAmount}
                      />
                    ),
                    status: '',
                  }}
                />
              ) : undefined
            }
          />
          <Pagination
            page={view.page}
            limit={view.limit}
            total={data?.total ?? 0}
            onPageChange={view.setPage}
            onLimitChange={view.setLimit}
          />
        </div>
      )}
    </Modal>
  );
}

/** The row's own figures, spelled out: sold, still on open bills, cancelled. */
function HistorySummary({
  totals,
  unit,
}: {
  totals: DishHistoryReport['totals'];
  unit?: DishUnit;
}) {
  const quantity = (value: number) => (unit ? lineQuantity(value, unit) : formatQty(value));
  return (
    <div className="bg-ink-50 text-ink-700 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg px-4 py-2.5 text-sm">
      <span>
        Оплачено:{' '}
        <span className="text-ink-900 tabular font-semibold">
          {quantity(totals.quantity)} · {formatMoney(totals.revenue)}
        </span>
      </span>
      {totals.pendingQuantity > 0 && (
        <span className="text-warning-600">
          Ожидает оплаты:{' '}
          <span className="tabular font-semibold">
            +{quantity(totals.pendingQuantity)} · +{formatMoney(totals.pendingRevenue)}
          </span>
        </span>
      )}
      {totals.cancelledQuantity > 0 && (
        <span className="text-danger-600">
          Отменено:{' '}
          <span className="tabular font-semibold">
            −{quantity(totals.cancelledQuantity)} · −{formatMoney(totals.cancelledAmount)}
          </span>
        </span>
      )}
    </div>
  );
}
