import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, ShoppingBag, Truck, UtensilsCrossed } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { qk } from '@/api/keys';
import { ordersApi, type OrderListParams } from '@/api/pos.api';
import type { OrderType } from '@/api/types';
import { PageSpinner } from '@/components/ui';
import { Permission } from '@/lib/permissions';
import { useCan } from '@/stores/auth.store';
import { NewOrderCard, OrderCard, type OrderTone } from './components/OrderCard';
import { useOrderDialogs } from './components/OrderDialogs';
import { ShiftBanner } from './components/ShiftBanner';
import { useShiftStatus } from './usePosData';

const CHANNELS: Record<string, { type: OrderType; title: string; icon: React.ReactNode; tone: OrderTone }> = {
  '/pos/takeaway': { type: 'TAKEAWAY', title: 'С собой', icon: <ShoppingBag />, tone: 'togo' },
  '/pos/delivery': { type: 'DELIVERY', title: 'Доставка', icon: <Truck />, tone: 'togo' },
  '/pos/hall': { type: 'HALL', title: 'Зал', icon: <UtensilsCrossed />, tone: 'occupied' },
};

/**
 * Доска одного канала: плитка «Создать заказ» и открытые заказы рядом с ней.
 * Оплаченные и отменённые заказы живут в Отчёт → Заказы, где их можно
 * отфильтровать по периоду, типу и статусу.
 */
export default function ChannelOrdersPage() {
  const location = useLocation();
  const channel = CHANNELS[location.pathname] ?? CHANNELS['/pos/takeaway'];
  const navigate = useNavigate();
  const canCreate = useCan(Permission.OrdersCreate);
  const { data: shift } = useShiftStatus();
  const { actionsFor, dialogs } = useOrderDialogs();

  const params: OrderListParams = {
    type: channel.type,
    status: 'OPEN',
    limit: 200,
    sortBy: 'createdAt',
    sortOrder: 'ASC',
  };
  const { data, isLoading } = useQuery({
    queryKey: qk.orders(params),
    queryFn: () => ordersApi.list(params),
    refetchInterval: 60_000,
  });

  const create = () => {
    if (!canCreate) {
      toast.warning('У вас нет права создавать заказы');
      return;
    }
    if (!shift) {
      toast.warning('Смена не открыта. Откройте смену, чтобы принимать заказы');
      return;
    }
    navigate(`/pos/order/new?type=${channel.type}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <ShiftBanner />
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          <NewOrderCard
            title={channel.title}
            icon={channel.icon}
            onClick={create}
            disabled={!canCreate || !shift}
            hint={!shift ? 'Смена не открыта' : undefined}
          />
          {data?.items.map((order) => (
            <OrderCard
              key={order.id}
              title={`#${order.number}`}
              number={order.number}
              createdAt={order.createdAt}
              total={order.total}
              tone={channel.tone}
              printCount={order.precheckCount}
              footer={order.waiter?.fullName ?? order.createdBy?.fullName ?? '—'}
              extra={
                channel.type === 'DELIVERY' && order.deliveryAddress ? (
                  <span className="mt-0.5 flex max-w-full items-center gap-1 truncate px-2 text-[11px] text-ink-500">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{order.deliveryAddress}</span>
                  </span>
                ) : order.customerName ? (
                  <span className="mt-0.5 max-w-full truncate px-2 text-[11px] text-ink-500">{order.customerName}</span>
                ) : order.customerPhone ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                    <Phone className="size-3" /> {order.customerPhone}
                  </span>
                ) : null
              }
              actions={actionsFor({
                id: order.id,
                number: order.number,
                type: channel.type,
                total: order.total,
                title: order.customerName ?? `Заказ #${order.number}`,
                tableId: null,
                waiterId: order.waiter?.id ?? null,
              })}
            />
          ))}
        </div>
      )}
      {dialogs}
    </div>
  );
}
