import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDateKey, shiftDateKey, todayKey } from '@/lib/format';
import { Button } from './Button';
import { controlBase, controlState } from './Field';

export interface DateRange {
  from: string;
  to: string;
}

function presets(): { label: string; range: () => DateRange }[] {
  const monthStart = (key: string) => `${key.slice(0, 8)}01`;
  return [
    { label: 'Сегодня', range: () => ({ from: todayKey(), to: todayKey() }) },
    { label: 'Вчера', range: () => ({ from: shiftDateKey(todayKey(), -1), to: shiftDateKey(todayKey(), -1) }) },
    { label: 'Последние 7 дней', range: () => ({ from: shiftDateKey(todayKey(), -6), to: todayKey() }) },
    { label: 'Последние 30 дней', range: () => ({ from: shiftDateKey(todayKey(), -29), to: todayKey() }) },
    { label: 'Этот месяц', range: () => ({ from: monthStart(todayKey()), to: todayKey() }) },
    {
      label: 'Прошлый месяц',
      range: () => {
        const end = shiftDateKey(monthStart(todayKey()), -1);
        return { from: monthStart(end), to: end };
      },
    },
  ];
}

export function describeRange(range: DateRange): string {
  const match = presets().find((preset) => {
    const value = preset.range();
    return value.from === range.from && value.to === range.to;
  });
  if (match) return match.label;
  if (range.from === range.to) return formatDateKey(range.from);
  return `${formatDateKey(range.from)} — ${formatDateKey(range.to)}`;
}

/** Period selector with quick presets; dates are YYYY-MM-DD in the business time zone. */
export function DateRangePicker({
  value,
  onChange,
  className,
  maxDays = 366,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  maxDays?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value.from !== synced.from || value.to !== synced.to) {
    setSynced(value);
    setDraft(value);
  }
  const today = todayKey();
  const spanDays = Math.round((Date.parse(draft.to) - Date.parse(draft.from)) / 86_400_000) + 1;
  const invalid = !draft.from || !draft.to || draft.from > draft.to || spanDays > maxDays;

  return (
    <Popover className={cn('relative', className)}>
      <PopoverButton
        className={cn(
          controlBase,
          controlState(false),
          'flex h-10 items-center gap-2 pr-2.5 pl-3 text-left font-medium data-open:border-brand-500 data-open:ring-4 data-open:ring-brand-500/12',
        )}
      >
        <CalendarDays className="size-4 text-ink-400" />
        <span className="whitespace-nowrap">{describeRange(value)}</span>
        <ChevronDown className="ml-auto size-4 text-ink-400" />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom start"
        transition
        className="z-[60] flex w-[min(92vw,520px)] rounded-2xl border border-ink-150 bg-white shadow-pop [--anchor-gap:6px] transition duration-100 ease-out data-closed:scale-[0.98] data-closed:opacity-0"
      >
        {({ close }) => (
          <>
            <div className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-ink-100 p-2">
              {presets().map((preset) => {
                const range = preset.range();
                const active = range.from === value.from && range.to === value.to;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onChange(range);
                      close();
                    }}
                    className={cn(
                      'rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-900' : 'text-ink-700 hover:bg-ink-50',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-[13px] font-semibold text-ink-800">Произвольный период</p>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
                С
                <input
                  type="date"
                  max={today}
                  value={draft.from}
                  onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
                  className={cn(controlBase, controlState(false), 'h-10 px-3')}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
                По
                <input
                  type="date"
                  max={today}
                  value={draft.to}
                  onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
                  className={cn(controlBase, controlState(false), 'h-10 px-3')}
                />
              </label>
              {invalid && draft.from && draft.to && (
                <p className="text-xs text-danger-600">
                  {draft.from > draft.to ? 'Дата начала позже даты окончания' : `Период — не более ${maxDays} дней`}
                </p>
              )}
              <Button
                size="sm"
                className="mt-auto"
                disabled={invalid}
                onClick={() => {
                  onChange(draft);
                  close();
                }}
              >
                Применить
              </Button>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
