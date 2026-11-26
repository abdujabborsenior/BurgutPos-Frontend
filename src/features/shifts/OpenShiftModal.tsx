import { useMutation } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { shiftsApi } from '@/api/shifts.api';
import type { ShiftDetail } from '@/api/types';
import { Button, Modal, NumericInput, Textarea } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';

/** Opens the restaurant-wide cash shift. Shared by the POS and the shift pages. */
export function OpenShiftModal({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened?: (shift: ShiftDetail) => void;
}) {
  const [openingCash, setOpeningCash] = useState<number | null>(0);
  const [comment, setComment] = useState('');

  const close = () => {
    setOpeningCash(0);
    setComment('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => shiftsApi.open(openingCash ?? 0, comment.trim() || undefined),
    onSuccess: (shift) => {
      toast.success(`Смена №${shift.id} открыта`);
      invalidateScopes('shift', 'dashboard');
      onOpened?.(shift);
      close();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onClose={close}
      locked={mutation.isPending}
      size="sm"
      icon={<CalendarClock />}
      title="Открытие смены"
      description="Укажите сумму наличных в кассе на начало смены."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Открыть смену
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <NumericInput
          label="Наличные в кассе"
          value={openingCash}
          onChange={setOpeningCash}
          min={0}
          suffix="сум"
          autoFocus
          inputSize="lg"
        />
        <Textarea
          label="Комментарий"
          rows={2}
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Необязательно"
        />
      </div>
    </Modal>
  );
}
