import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { OpenShiftModal } from '@/features/shifts/OpenShiftModal';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { useShiftStatus } from '../usePosData';

/** Warns that no shift is open; new orders and payments are blocked until one is. */
export function ShiftBanner() {
  const { data: shift, isLoading } = useShiftStatus();
  const canManage = useCan(Permission.ShiftsManage);
  const [open, setOpen] = useState(false);
  if (isLoading || shift) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-white text-warning-600 shadow-card">
        <CalendarClock className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-warning-700">Смена не открыта</p>
        <p className="text-[13px] text-warning-700/80">
          {canManage
            ? 'Откройте смену, чтобы принимать заказы и оплату.'
            : 'Новые заказы и оплата недоступны. Обратитесь к кассиру или администратору.'}
        </p>
      </div>
      {canManage && (
        <Button size="sm" onClick={() => setOpen(true)}>
          Открыть смену
        </Button>
      )}
      <OpenShiftModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
