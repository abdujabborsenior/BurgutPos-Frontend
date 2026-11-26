import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { minuteKey, todayKey } from '@/lib/format';
import {
  describePeriod,
  isPlausibleMinute,
  matchPreset,
  PERIOD_PRESETS,
  presetPeriod,
  shiftPeriod,
  withBound,
  type Period,
  type PeriodPreset,
} from '@/lib/period';
import { controlBase, controlState, Field } from './Field';
import { IconButton } from './IconButton';
import { Panel } from './PageHeader';
import { Select, type SelectOption } from './Select';

/** Commit delay while typing into a date-time input (each typed segment is a new value). */
const TYPING_DELAY_MS = 700;

/**
 * Minute-precision date-time input. Typing is buffered: the value is applied
 * after a short pause, on Enter or when the field loses focus — so partial
 * input ("0002-…" while typing the year) never reaches the report.
 */
function MinuteInput({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    // The period changed from outside (preset, arrows, the other bound).
    setSynced(value);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string) => {
    clearTimeout(timer.current);
    if (!isPlausibleMinute(next)) {
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  };

  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="datetime-local"
        step={60}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          if (isPlausibleMinute(next)) timer.current = setTimeout(() => commit(next), TYPING_DELAY_MS);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(draft);
        }}
        className={cn(controlBase, controlState(false), 'h-10 px-3.5 tabular [color-scheme:light]')}
      />
    </Field>
  );
}

/**
 * Report period: preset with ‹ › stepping, plus exact "С" / "По" minutes.
 * Extra filters of the page go below (`children`).
 */
export function PeriodFields({ value, onChange }: { value: Period; onChange: (next: Period) => void }) {
  const today = todayKey();
  const preset = matchPreset(value, today);
  const next = shiftPeriod(value, 1);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Field label="Период">
        <div className="flex items-center gap-2">
          <IconButton
            variant="outline"
            label="Предыдущий период"
            icon={<ChevronLeft />}
            onClick={() => onChange(shiftPeriod(value, -1))}
          />
          <Select<PeriodPreset | null>
            className="min-w-0 flex-1"
            value={preset}
            onChange={(selected) => {
              if (selected) onChange(presetPeriod(selected, today));
            }}
            options={PERIOD_PRESETS as SelectOption<PeriodPreset | null>[]}
            displayLabel={describePeriod(value)}
          />
          <IconButton
            variant="outline"
            label="Следующий период"
            icon={<ChevronRight />}
            // A period that starts in the future has nothing to show.
            disabled={next.from > minuteKey()}
            onClick={() => onChange(next)}
          />
        </div>
      </Field>
      <MinuteInput label="С" value={value.from} onCommit={(from) => onChange(withBound(value, 'from', from))} />
      <MinuteInput label="По" value={value.to} onCommit={(to) => onChange(withBound(value, 'to', to))} />
    </div>
  );
}

export function PeriodCard({
  value,
  onChange,
  children,
  className,
}: {
  value: Period;
  onChange: (next: Period) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <PeriodFields value={value} onChange={onChange} />
      {children && <div className="mt-5 flex flex-col gap-4">{children}</div>}
    </Panel>
  );
}
