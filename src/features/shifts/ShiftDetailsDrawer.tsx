import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { shiftsApi } from '@/api/shifts.api';
import type { ShiftDetail } from '@/api/types';
import { Badge, Button, Drawer, EmptyState, Skeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { SHIFT_STATUS_LABELS } from '@/lib/labels';
import { ShiftSummaryView } from './ShiftSummaryView';

function ShiftMeta({ shift }: { shift: ShiftDetail }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge tone={shift.status === 'OPEN' ? 'brand' : 'neutral'} size="sm" dot>
        {SHIFT_STATUS_LABELS[shift.status]}
      </Badge>
      <span>
        Открыта {formatDateTime(shift.openedAt)} · {shift.openedBy?.fullName ?? '—'}
      </span>
      {shift.closedAt && (
        <span>
          Закрыта {formatDateTime(shift.closedAt)} · {shift.closedBy?.fullName ?? '—'}
        </span>
      )}
    </span>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

/** Side panel with the full report of one shift; `shiftId = null` closes it. */
export function ShiftDetailsDrawer({ shiftId, onClose }: { shiftId: number | null; onClose: () => void }) {
  const navigate = useNavigate();
  // Keep the last shown id so the content stays in place while the drawer slides out.
  const [shownId, setShownId] = useState(shiftId);
  if (shiftId !== null && shiftId !== shownId) setShownId(shiftId);

  const query = useQuery({
    queryKey: qk.shift(shownId ?? 0),
    queryFn: () => shiftsApi.get(shownId ?? 0),
    enabled: shownId !== null,
  });
  const shift = query.data;

  return (
    <Drawer
      open={shiftId !== null}
      onClose={onClose}
      width="max-w-3xl"
      title={shownId !== null ? `Смена №${shownId}` : 'Смена'}
      description={shift ? <ShiftMeta shift={shift} /> : undefined}
      footer={
        shift?.status === 'OPEN' ? (
          <Button variant="secondary" rightIcon={<ArrowRight className="size-4" />} onClick={() => navigate('/shifts/current')}>
            Перейти к текущей смене
          </Button>
        ) : undefined
      }
    >
      {shift ? (
        <ShiftSummaryView shift={shift} />
      ) : query.isError ? (
        <EmptyState
          icon={<CalendarClock />}
          title="Не удалось открыть смену"
          description={getErrorMessage(query.error)}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Повторить
            </Button>
          }
        />
      ) : (
        <DrawerSkeleton />
      )}
    </Drawer>
  );
}
