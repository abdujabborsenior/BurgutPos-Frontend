import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { dayEnd, dayOf, dayStart, parseBound, presetPeriod, type Period, type PeriodPreset } from '@/lib/period';

/**
 * Period kept in the URL (?from=…&to=…, minutes or whole days), so refresh,
 * back/forward and shared links reopen the same view. The default period
 * (today unless `preset` says otherwise) stays out of the URL; a lone bound
 * covers the rest of that day.
 */
export function usePeriodParams({ preset = 'today' }: { preset?: PeriodPreset } = {}) {
  const [params, setParams] = useSearchParams();
  const rawFrom = params.get('from');
  const rawTo = params.get('to');

  const fallback = useMemo(() => presetPeriod(preset), [preset]);

  const period = useMemo<Period>(() => {
    if (rawFrom === null && rawTo === null) return fallback;
    const parsedTo = parseBound(rawTo, 'end');
    const from = parseBound(rawFrom, 'start') ?? dayStart(parsedTo ? dayOf(parsedTo) : dayOf(fallback.from));
    const to = parsedTo ?? dayEnd(dayOf(from));
    // Reversed bounds (an edited link) become the whole days they span.
    return from <= to ? { from, to } : { from: dayStart(dayOf(to)), to: dayEnd(dayOf(from)) };
  }, [rawFrom, rawTo, fallback]);

  const setPeriod = useCallback(
    (next: Period) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next.from === fallback.from && next.to === fallback.to) {
            updated.delete('from');
            updated.delete('to');
          } else {
            updated.set('from', next.from);
            updated.set('to', next.to);
          }
          // A new period is a new result set: start from its first page.
          updated.delete('page');
          return updated;
        },
        { replace: true },
      );
    },
    [setParams, fallback],
  );

  return { period, setPeriod };
}
