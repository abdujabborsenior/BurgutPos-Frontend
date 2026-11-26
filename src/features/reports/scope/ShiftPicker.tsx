import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi, type ShiftsReportParams } from '@/api/analytics.api';
import { qk } from '@/api/keys';
import type { ShiftReportRow } from '@/api/report-types';
import {
  Badge,
  Combobox,
  DataTable,
  Field,
  Panel,
  PeriodFields,
  Select,
  type Column,
} from '@/components/ui';
import { formatDateTime, formatMoney } from '@/lib/format';
import { SHIFT_TIME_FILTERS } from './shift-scope';
import { SHIFT_STATUS_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import type { Period } from '@/lib/period';
import { Dash, Pending, ReportError } from '../components/ReportBits';
import { formatCount } from '../components/report-utils';
import { useUserOptions } from '../components/useFilterOptions';

/**
 * "Выберите смену": the period, cashier and time filter that narrow the list,
 * and the list itself. Picking a row scopes every report of the section to
 * that shift.
 */
export function ShiftPicker({
  period,
  onPeriodChange,
  dateField,
  onDateFieldChange,
  cashierId,
  onCashierChange,
  shiftId,
  onShiftChange,
}: {
  period: Period;
  onPeriodChange: (period: Period) => void;
  dateField: 'opened' | 'closed';
  onDateFieldChange: (value: 'opened' | 'closed') => void;
  cashierId: number | undefined;
  onCashierChange: (value: number | null) => void;
  shiftId: number | undefined;
  onShiftChange: (id: number | null) => void;
}) {
  const cashiers = useUserOptions(Permission.ShiftsManage);

  const params: ShiftsReportParams = {
    from: period.from,
    to: period.to,
    dateField,
    cashierId,
  };
  const query = useQuery({
    queryKey: qk.report('shift-picker', params),
    queryFn: () => reportsApi.shifts(params),
    placeholderData: keepPreviousData,
  });

  const picked = query.data?.items.find((row) => row.id === shiftId);
  const [expanded, setExpanded] = useState(false);

  const columns: Column<ShiftReportRow>[] = [
    {
      key: 'id',
      header: 'Смена №',
      cell: (row) => <span className="font-semibold text-ink-900 tabular">{row.id}</span>,
    },
    { key: 'cashier', header: 'Кассир', cell: (row) => <span className="whitespace-nowrap">{row.openedBy}</span> },
    {
      key: 'openedAt',
      header: 'Открыта',
      cell: (row) => <span className="whitespace-nowrap tabular">{formatDateTime(row.openedAt)}</span>,
    },
    {
      key: 'closedAt',
      header: 'Закрыта',
      cell: (row) =>
        row.closedAt ? <span className="whitespace-nowrap tabular">{formatDateTime(row.closedAt)}</span> : <Dash />,
    },
    {
      key: 'orders',
      header: 'Заказов',
      cell: (row) => <span className="tabular">{formatCount(row.ordersCount)}</span>,
    },
    {
      key: 'revenue',
      header: 'Выручка',
      cell: (row) => <span className="font-medium text-ink-900 tabular">{formatMoney(row.revenue)}</span>,
    },
    { key: 'pending', header: 'Ожидает оплаты', cell: (row) => <Pending value={row.pending} /> },
    {
      key: 'status',
      header: 'Статус',
      cell: (row) => (
        <Badge size="sm" tone={row.status === 'OPEN' ? 'success' : 'neutral'} dot={row.status === 'OPEN'}>
          {SHIFT_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <Panel>
        <div className="flex flex-col gap-4">
          <PeriodFields value={period} onChange={onPeriodChange} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Combobox
              label="Кассир"
              value={cashierId ?? null}
              onChange={onCashierChange}
              options={cashiers.data ?? []}
              placeholder="Все"
              clearable
            />
            <Select
              label="Фильтр по времени"
              value={dateField}
              onChange={onDateFieldChange}
              options={SHIFT_TIME_FILTERS}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <Field label="Выберите смену">
          {picked && (
            // Once a shift is picked the list folds away, so the report itself
            // is the first thing on screen.
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50/70 px-4 py-2.5 text-[13px] text-ink-700">
              <span className="font-semibold text-brand-900">Смена №{picked.id}</span>
              <span>{picked.openedBy}</span>
              <span className="text-ink-500">
                {formatDateTime(picked.openedAt)}
                {picked.closedAt ? ` — ${formatDateTime(picked.closedAt)}` : ' — сейчас'}
              </span>
              <div className="ml-auto flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setExpanded((open) => !open)}
                  className="font-medium text-brand-700 transition-colors hover:text-brand-950"
                >
                  {expanded ? 'Свернуть список' : 'Другая смена'}
                </button>
                <button
                  type="button"
                  onClick={() => onShiftChange(null)}
                  className="font-medium text-ink-500 transition-colors hover:text-ink-900"
                >
                  Сбросить
                </button>
              </div>
            </div>
          )}
          {(!picked || expanded) && (
            <DataTable
              className={picked ? 'mt-3' : undefined}
              columns={columns}
              rows={query.data?.items ?? (query.isError ? [] : undefined)}
              rowKey={(row) => row.id}
              loading={query.isLoading}
              fetching={query.isPlaceholderData}
              onRowClick={(row) => {
                onShiftChange(row.id === shiftId ? null : row.id);
                setExpanded(false);
              }}
              rowClassName={(row) => (row.id === shiftId ? 'bg-brand-50/80 hover:bg-brand-50' : 'cursor-pointer')}
              empty={
                query.isError ? (
                  <ReportError error={query.error} onRetry={() => void query.refetch()} />
                ) : (
                  <span className="text-sm text-ink-500">Нет записей</span>
                )
              }
            />
          )}
        </Field>
      </Panel>
    </>
  );
}
