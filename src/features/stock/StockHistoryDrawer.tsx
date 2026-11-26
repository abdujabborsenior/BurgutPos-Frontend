import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { qk } from '@/api/keys';
import { stockApi, type MovementListParams } from '@/api/stock.api';
import type { MovementView } from '@/api/types';
import { Button, Drawer, EmptyState, Skeleton } from '@/components/ui';
import { formatDateTime, formatQty, shiftDateKey, todayKey } from '@/lib/format';
import { LOCATION_LABELS } from '@/lib/labels';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { MovementTypeBadge, QtyDelta } from './StockParts';
import { unitLabel } from './stock.utils';

export interface HistoryTarget {
  kind: 'dish' | 'ingredient';
  id: number;
  name: string;
}

const RECENT_LIMIT = 50;

/** Latest movements of one position, with a jump to the full history page. */
export function StockHistoryDrawer({
  open,
  target,
  description,
  onClose,
}: {
  open: boolean;
  target: HistoryTarget | null;
  description?: ReactNode;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const params: MovementListParams | null = target
    ? {
        page: 1,
        limit: RECENT_LIMIT,
        ...(target.kind === 'dish' ? { dishId: target.id } : { ingredientId: target.id }),
      }
    : null;

  const query = useQuery({
    queryKey: qk.movements(params ?? {}),
    queryFn: () => stockApi.movements(params ?? {}),
    enabled: open && params !== null,
  });
  const items = query.data?.items;
  const total = query.data?.total ?? 0;

  const openFullHistory = () => {
    if (!target) return;
    const today = todayKey();
    const search = new URLSearchParams({
      [target.kind === 'dish' ? 'dishId' : 'ingredientId']: String(target.id),
      from: shiftDateKey(today, -365),
      to: today,
    });
    onClose();
    navigate(`/inventory/history?${search.toString()}`);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={target ? `История · ${target.name}` : 'История'}
      description={description}
      width="max-w-lg"
      footer={
        <>
          {total > RECENT_LIMIT && (
            <span className="mr-auto text-xs text-ink-500">
              Показаны последние {RECENT_LIMIT} из {formatQty(total)}
            </span>
          )}
          <Button variant="secondary" onClick={openFullHistory} leftIcon={<History className="size-4" />}>
            Открыть всю историю
          </Button>
        </>
      }
    >
      {query.isLoading ? (
        <div className="flex flex-col gap-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-start justify-between gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState compact title="Не удалось загрузить историю" description="Проверьте соединение и откройте окно снова" />
      ) : !items?.length ? (
        <EmptyState compact icon={<History />} title="Движений пока нет" description="Здесь появятся приходы, продажи, списания и перемещения" />
      ) : (
        <ul className="-my-3 divide-y divide-ink-100">
          {items.map((movement) => (
            <MovementItem key={movement.id} movement={movement} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function MovementItem({ movement }: { movement: MovementView }) {
  const canOpenOrders = useCan(Permission.PosAccess);
  const unit = movement.item?.unit;
  return (
    <li className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <MovementTypeBadge type={movement.type} size="sm" />
          {movement.location && <span className="text-xs font-medium text-ink-600">{LOCATION_LABELS[movement.location]}</span>}
        </div>
        <div className="mt-1.5 text-xs text-ink-500 tabular">
          {formatDateTime(movement.createdAt)}
          {movement.createdBy && <> · {movement.createdBy.fullName}</>}
        </div>
        {(movement.orderId || movement.receiptId) && (
          <div className="mt-1 text-xs">
            {movement.orderId ? (
              canOpenOrders ? (
                <Link to={`/pos/order/${movement.orderId}`} className="font-medium text-brand-700 hover:text-brand-900 hover:underline">
                  Заказ #{movement.orderNumber ?? movement.orderId}
                </Link>
              ) : (
                <span className="text-ink-600">Заказ #{movement.orderNumber ?? movement.orderId}</span>
              )
            ) : (
              <span className="text-ink-600">Приход #{movement.receiptId}</span>
            )}
          </div>
        )}
        {movement.comment && <p className="mt-1 text-[13px] break-words text-ink-600">{movement.comment}</p>}
      </div>
      <div className="shrink-0 text-right">
        <QtyDelta value={movement.quantity} unit={unit} className="text-sm" />
        <div className="mt-1 text-xs text-ink-500 tabular">
          Остаток: <span className={movement.balanceAfter < 0 ? 'font-medium text-danger-600' : 'text-ink-700'}>{formatQty(movement.balanceAfter)}</span>
          {unit && ` ${unitLabel(unit)}`}
        </div>
      </div>
    </li>
  );
}
