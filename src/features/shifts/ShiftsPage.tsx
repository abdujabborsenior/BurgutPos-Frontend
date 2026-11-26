import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CalendarClock,
  CircleDot,
  Lock,
  LockOpen,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { shiftsApi, type ShiftListParams } from '@/api/shifts.api';
import type { CashOperationType, ShiftDetail, ShiftListRow, ShiftStatus } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  Panel,
  Select,
  Skeleton,
  Toolbar,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDuration, formatMoney, plural } from '@/lib/format';
import { SHIFT_STATUS_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { formatSignedMoney } from './cash';
import { CashOperationModal } from './CashOperationModal';
import { CloseShiftModal } from './CloseShiftModal';
import { OpenShiftModal } from './OpenShiftModal';
import { ShiftDetailsDrawer } from './ShiftDetailsDrawer';
import { ShiftSummaryView } from './ShiftSummaryView';

const dash = <span className="text-ink-400">—</span>;

function parseShiftId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function Money({ value }: { value: number | null }) {
  return value === null ? dash : <span className="text-ink-800 tabular">{formatMoney(value)}</span>;
}

const columns: Column<ShiftListRow>[] = [
  {
    key: 'id',
    header: 'Смена №',
    cell: (row) => <span className="font-semibold text-ink-900 tabular">{row.id}</span>,
  },
  { key: 'cashier', header: 'Кассир', cell: (row) => row.openedBy?.fullName ?? dash },
  {
    key: 'openedAt',
    header: 'Открыта',
    cell: (row) => <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.openedAt)}</span>,
  },
  {
    key: 'closedAt',
    header: 'Закрыта',
    cell: (row) =>
      row.closedAt ? (
        <span className="whitespace-nowrap text-ink-700 tabular">{formatDateTime(row.closedAt)}</span>
      ) : (
        dash
      ),
  },
  {
    key: 'duration',
    header: 'Длительность',
    cell: (row) => (
      <span className="whitespace-nowrap text-ink-700">{formatDuration(row.openedAt, row.closedAt ?? undefined)}</span>
    ),
  },
  { key: 'closedBy', header: 'Закрыл', cell: (row) => row.closedBy?.fullName ?? dash },
  { key: 'orders', header: 'Заказов', cell: (row) => <span className="tabular">{row.ordersCount}</span> },
  {
    key: 'revenue',
    header: 'Выручка',
    cell: (row) => <span className="font-semibold text-ink-900 tabular">{formatMoney(row.revenue)}</span>,
  },
  { key: 'expected', header: 'Ожидалось', cell: (row) => <Money value={row.expectedCash} /> },
  { key: 'counted', header: 'Фактически', cell: (row) => <Money value={row.closingCash} /> },
  {
    key: 'difference',
    header: 'Расхождение',
    cell: (row) =>
      row.cashDifference === null ? (
        dash
      ) : (
        <span
          className={cn(
            'font-semibold whitespace-nowrap tabular',
            row.cashDifference > 0 && 'text-success-700',
            row.cashDifference < 0 && 'text-danger-700',
            row.cashDifference === 0 && 'font-normal text-ink-500',
          )}
        >
          {formatSignedMoney(row.cashDifference)}
        </span>
      ),
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (row) => (
      <Badge size="sm" tone={row.status === 'OPEN' ? 'success' : 'neutral'} dot>
        {SHIFT_STATUS_LABELS[row.status]}
      </Badge>
    ),
  },
];

/** The open shift: who runs it, since when, and what can be done with it. */
function CurrentShiftCard({
  shift,
  loading,
  error,
  onOpen,
  onCash,
  onClose,
}: {
  shift: ShiftDetail | null | undefined;
  loading: boolean;
  error: unknown;
  onOpen: () => void;
  onCash: (type: CashOperationType) => void;
  onClose: () => void;
}) {
  const canManage = useCan(Permission.ShiftsManage);

  if (loading) {
    return (
      <Panel>
        <Skeleton className="h-12 w-full" />
      </Panel>
    );
  }
  if (shift === undefined) {
    return (
      <Panel>
        <EmptyState
          compact
          title="Не удалось загрузить смену"
          description={getErrorMessage(error)}
        />
      </Panel>
    );
  }
  if (shift === null) {
    return (
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-900">Смена не открыта</p>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {canManage
                ? 'Откройте смену, чтобы принимать заказы и оплаты.'
                : 'Заказы и оплаты принимаются только в открытой смене.'}
            </p>
          </div>
          {canManage && (
            <Button leftIcon={<LockOpen className="size-4" />} onClick={onOpen}>
              Открыть смену
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CircleDot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-900">
              Смена открыта <span className="ml-1.5 text-ink-500">Смена № {shift.id}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Открыта: {formatDateTime(shift.openedAt)} · {shift.openedBy?.fullName ?? '—'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to={`/shifts/reports/summary?shift=${shift.id}`}>
              <Button variant="secondary" leftIcon={<BarChart3 className="size-4" />}>
                Отчёты смены
              </Button>
            </Link>
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  leftIcon={<ArrowDownToLine className="size-4" />}
                  onClick={() => onCash('IN')}
                >
                  Внесение
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<ArrowUpFromLine className="size-4" />}
                  onClick={() => onCash('OUT')}
                >
                  Изъятие
                </Button>
                <Button variant="danger" leftIcon={<Lock className="size-4" />} onClick={onClose}>
                  Закрыть смену
                </Button>
              </>
            )}
          </div>
        </div>
      </Panel>
      <ShiftSummaryView shift={shift} />
    </>
  );
}

/** Смены: the open shift and the history of every shift before it. */
export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const list = useListState({ filters: { status: 'all' } });
  const [searchParams, setSearchParams] = useSearchParams();

  const current = useQuery({ queryKey: qk.shiftCurrent, queryFn: shiftsApi.current });
  const shift = current.data;
  // The dialogs keep the last open shift, so they can finish their closing animation.
  const [lastShift, setLastShift] = useState<ShiftDetail | null>(shift ?? null);
  if (shift && shift !== lastShift) setLastShift(shift);

  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [operationType, setOperationType] = useState<CashOperationType>('IN');
  const [operationOpen, setOperationOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const status: ShiftStatus | 'all' =
    list.filters.status === 'OPEN' || list.filters.status === 'CLOSED' ? list.filters.status : 'all';
  const params: ShiftListParams = {
    page: list.page,
    limit: list.limit,
    status: status === 'all' ? undefined : status,
  };
  const history = useQuery({
    queryKey: qk.shifts(params),
    queryFn: () => shiftsApi.list(params),
    placeholderData: keepPreviousData,
  });
  const total = history.data?.total;

  // ?shift=<id> opens that shift's details (other pages link here).
  const selectedId = parseShiftId(searchParams.get('shift'));
  const selectShift = (id: number | null) =>
    setSearchParams(
      (next) => {
        const updated = new URLSearchParams(next);
        if (id === null) updated.delete('shift');
        else updated.set('shift', String(id));
        return updated;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Смена"
        subtitle={
          total === undefined ? ' ' : `Всего ${total} ${plural(total, ['смена', 'смены', 'смен'])} в истории`
        }
      />
      <CurrentShiftCard
        shift={shift}
        loading={current.isPending}
        error={current.error}
        onOpen={() => setOpenShiftOpen(true)}
        onCash={(type) => {
          setOperationType(type);
          setOperationOpen(true);
        }}
        onClose={() => {
          setCloseOpen(true);
          // Open orders block closing: let the dialog judge by fresh data.
          void current.refetch();
        }}
      />

      <Panel>
        <h2 className="mb-4 text-[15px] font-semibold text-ink-900">История смен</h2>
        <Toolbar>
          <Select
            value={status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'all', label: 'Все статусы' },
              { value: 'OPEN', label: SHIFT_STATUS_LABELS.OPEN },
              { value: 'CLOSED', label: SHIFT_STATUS_LABELS.CLOSED },
            ]}
            className="w-44"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={history.data?.items}
          rowKey={(row) => row.id}
          loading={history.isLoading}
          fetching={history.isPlaceholderData}
          numberedFrom={(list.page - 1) * list.limit}
          onRowClick={(row) => selectShift(row.id)}
          rowClassName={(row) => (row.id === selectedId ? 'bg-brand-50/70 hover:bg-brand-50' : 'cursor-pointer')}
          empty={
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Смен пока нет"
              description="Откройте первую смену, чтобы начать работу."
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

      <ShiftDetailsDrawer shiftId={selectedId} onClose={() => selectShift(null)} />
      <OpenShiftModal
        open={openShiftOpen}
        onClose={() => setOpenShiftOpen(false)}
        onOpened={(opened) => queryClient.setQueryData(qk.shiftCurrent, opened)}
      />
      {lastShift && (
        <>
          <CashOperationModal
            open={operationOpen}
            type={operationType}
            expectedCash={lastShift.cash.expected}
            onClose={() => setOperationOpen(false)}
          />
          <CloseShiftModal open={closeOpen} shift={lastShift} onClose={() => setCloseOpen(false)} />
        </>
      )}
    </div>
  );
}
