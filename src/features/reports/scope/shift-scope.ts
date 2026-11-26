import { createContext, type ReactNode } from 'react';
import type { SelectOption } from '@/components/ui';

/** Where a report takes its figures from. */
export type ReportMode = 'period' | 'shift';

/** Set by the route: the "Отчёт по сменам" section renders in shift mode. */
export const ModeContext = createContext<ReportMode>('period');

/** Which moment of a shift the period filter applies to. */
export const SHIFT_TIME_FILTERS: SelectOption<'opened' | 'closed'>[] = [
  { value: 'opened', label: 'По времени открытия' },
  { value: 'closed', label: 'По времени закрытия' },
];

/** What the report on screen covers, and the controls that choose it. */
export interface ReportScope {
  mode: ReportMode;
  /** What the API is asked for: a period, or one shift. */
  params: { from?: string; to?: string; shiftId?: number };
  /** False while a shift still has to be picked. */
  ready: boolean;
  /** Period or shift in words, for the page subtitle. */
  label: string;
  /** The card(s) that choose the scope; `filters` are the report's own. */
  card: (filters?: ReactNode) => ReactNode;
  /** Shown instead of the report while `ready` is false. */
  hint: ReactNode;
}
