import { use } from 'react';
import { EmptyState, Panel, PeriodCard } from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { usePeriodParams } from '@/hooks/usePeriodParams';
import { describePeriod } from '@/lib/period';
import { oneOf, toId } from '../components/report-utils';
import { ModeContext, type ReportScope } from './shift-scope';
import { ShiftPicker } from './ShiftPicker';

function usePeriodScope(): ReportScope {
  const { period, setPeriod } = usePeriodParams();
  return {
    mode: 'period',
    params: { from: period.from, to: period.to },
    ready: true,
    label: describePeriod(period),
    card: (filters) => (
      <PeriodCard value={period} onChange={setPeriod}>
        {filters}
      </PeriodCard>
    ),
    hint: null,
  };
}

function useShiftScope(): ReportScope {
  const { period, setPeriod } = usePeriodParams({ preset: 'thisMonth' });
  const list = useListState({ filters: { time: 'opened' } });
  const dateField = oneOf(list.filters.time, ['opened', 'closed'] as const) ?? 'opened';
  const cashierId = toId(list.filters.cashier);
  const shiftId = toId(list.filters.shift);

  return {
    mode: 'shift',
    params: { shiftId },
    ready: shiftId !== undefined,
    label: shiftId === undefined ? 'Смена не выбрана' : `Смена №${shiftId}`,
    card: (filters) => (
      <>
        <ShiftPicker
          period={period}
          onPeriodChange={setPeriod}
          dateField={dateField}
          onDateFieldChange={(value) => list.setFilter('time', value === 'opened' ? undefined : value)}
          cashierId={cashierId}
          onCashierChange={(value) => list.setFilter('cashier', value)}
          shiftId={shiftId}
          onShiftChange={(id) => list.setFilter('shift', id)}
        />
        {shiftId !== undefined && filters && <Panel>{filters}</Panel>}
      </>
    ),
    hint: (
      <Panel>
        <EmptyState compact title="Выберите смену, чтобы посмотреть отчёты" />
      </Panel>
    ),
  };
}

/**
 * The scope of the report on screen. Period mode reads it from the period
 * picker, shift mode from the shift the user picked — the report pages
 * themselves are the same in both sections.
 */
export function useReportScope(): ReportScope {
  const mode = use(ModeContext);
  const period = usePeriodScope();
  const shift = useShiftScope();
  return mode === 'shift' ? shift : period;
}

export type { ReportScope };
