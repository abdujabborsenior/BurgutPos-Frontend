import { useMutation } from '@tanstack/react-query';
import { ArrowLeftRight, Merge, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail } from '@/api/types';
import { Button, EmptyState, Modal, PageSpinner, Segmented, Select, useConfirm } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { invalidateScopes } from '@/lib/realtime';
import { useBoard, useWaiters } from '../usePosData';

export interface TransferTarget {
  id: number;
  /** Daily order number shown to people. */
  number: number;
  type: OrderDetail['type'];
  tableId: number | null;
  waiterId: number | null;
  title: string;
}

function TransferForm({ order, onDone }: { order: TransferTarget; onDone: (updated: OrderDetail) => void }) {
  const isTable = order.type === 'TABLE';
  const [tab, setTab] = useState<'table' | 'waiter'>(isTable ? 'table' : 'waiter');
  const [waiterId, setWaiterId] = useState<number | null>(order.waiterId);
  const board = useBoard();
  const waiters = useWaiters();
  const confirm = useConfirm();

  const done = (updated: OrderDetail, message: string) => {
    toast.success(message);
    invalidateScopes('board', 'counters', 'orders');
    onDone(updated);
  };

  const move = useMutation({
    mutationFn: (tableId: number) => ordersApi.move(order.id, tableId),
    onSuccess: (updated) => done(updated, `Заказ перенесён: ${updated.table?.name ?? ''}`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const merge = useMutation({
    mutationFn: (targetOrderId: number) => ordersApi.merge(order.id, targetOrderId),
    onSuccess: (updated) => done(updated, `Заказы объединены в #${updated.number}`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const changeWaiter = useMutation({
    mutationFn: (id: number) => ordersApi.changeWaiter(order.id, id),
    onSuccess: (updated) => done(updated, `Официант: ${updated.waiter?.fullName ?? '—'}`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const pending = move.isPending || merge.isPending || changeWaiter.isPending;

  return (
    <div className="flex flex-col gap-5">
      {isTable && (
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: 'table', label: 'Другой стол', icon: <ArrowLeftRight /> },
            { value: 'waiter', label: 'Другой официант', icon: <UserRound /> },
          ]}
        />
      )}

      {tab === 'table' ? (
        board.isLoading ? (
          <PageSpinner />
        ) : (
          <div className="flex max-h-[55vh] flex-col gap-5 overflow-y-auto pr-1 scrollbar-thin">
            <p className="text-[13px] text-ink-500">
              Выберите свободный стол для переноса или занятый — чтобы объединить заказы.
            </p>
            {board.data?.map((hall) => (
              <div key={hall.id}>
                <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-500 uppercase">{hall.name}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {hall.tables.map((table) => {
                    const current = table.id === order.tableId;
                    const occupied = Boolean(table.order);
                    return (
                      <button
                        key={table.id}
                        type="button"
                        disabled={current || pending}
                        onClick={async () => {
                          if (!occupied) {
                            move.mutate(table.id);
                            return;
                          }
                          const target = table.order;
                          if (!target) return;
                          const ok = await confirm({
                            title: `Объединить с заказом #${target.number}?`,
                            description: `Все позиции заказа #${order.number} перейдут в заказ стола «${table.name}» (${formatMoney(target.total)} сум). Стол «${order.title}» освободится.`,
                            confirmText: 'Объединить',
                          });
                          if (ok) merge.mutate(target.id);
                        }}
                        className={cn(
                          'flex h-16 flex-col items-center justify-center rounded-xl border px-2 text-center transition-colors disabled:cursor-not-allowed',
                          current
                            ? 'border-brand-800 bg-brand-900 text-white'
                            : occupied
                              ? 'border-ink-200 bg-ink-50 text-ink-700 hover:border-brand-300'
                              : 'border-ink-200 bg-white text-ink-900 hover:border-brand-400 hover:bg-brand-50',
                        )}
                      >
                        <span className="truncate text-[13px] font-semibold">{table.name}</span>
                        <span className={cn('mt-0.5 flex items-center gap-1 text-[11px]', current ? 'text-brand-200' : 'text-ink-500')}>
                          {current ? 'текущий' : occupied ? (
                            <>
                              <Merge className="size-3" /> #{table.order?.id}
                            </>
                          ) : (
                            'свободен'
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : waiters.isLoading ? (
        <PageSpinner />
      ) : !waiters.data?.length ? (
        <EmptyState compact title="Нет официантов" description="Назначьте сотрудникам роль с правом «Официант»." />
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Официант"
            value={waiterId}
            onChange={setWaiterId}
            placeholder="Выберите официанта"
            options={waiters.data.map((waiter) => ({ value: waiter.id, label: waiter.fullName, hint: waiter.roleName ?? undefined }))}
          />
          <Button
            disabled={!waiterId || waiterId === order.waiterId}
            loading={changeWaiter.isPending}
            onClick={() => waiterId && changeWaiter.mutate(waiterId)}
          >
            Назначить официанта
          </Button>
        </div>
      )}
    </div>
  );
}

export function TransferModal({
  order,
  onClose,
  onTransferred,
}: {
  order: TransferTarget | null;
  onClose: () => void;
  onTransferred?: (order: OrderDetail) => void;
}) {
  return (
    <Modal
      open={order !== null}
      onClose={onClose}
      size="lg"
      icon={<ArrowLeftRight />}
      title={`Перенос заказа #${order?.number ?? ''}`}
      description={order?.title}
    >
      {order && (
        <TransferForm
          key={order.id}
          order={order}
          onDone={(updated) => {
            onTransferred?.(updated);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
