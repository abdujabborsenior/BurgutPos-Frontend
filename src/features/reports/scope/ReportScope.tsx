import type { ReactNode } from 'react';
import { ModeContext, type ReportMode } from './shift-scope';

/** Routes under "Отчёт по сменам" render the same reports for one shift. */
export function ReportModeProvider({ mode, children }: { mode: ReportMode; children: ReactNode }) {
  return <ModeContext value={mode}>{children}</ModeContext>;
}
