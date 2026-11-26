import { LayoutGrid, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button, EmptyState, PageSpinner, Segmented, type SegmentItem } from '@/components/ui';
import { Permission } from '@/lib/permissions';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { FreeTableCard, OrderCard } from './components/OrderCard';
import { useOrderDialogs } from './components/OrderDialogs';
import { ShiftBanner } from './components/ShiftBanner';
import { useBoard, useShiftStatus } from './usePosData';

type Filter = 'all' | 'open' | 'mine' | `hall:${number}`;

export default function TablesBoardPage() {
  const { data: halls, isLoading } = useBoard();
  const { data: shift } = useShiftStatus();
  const me = useAuthStore((state) => state.user);
  const canCreate = useCan(Permission.OrdersCreate);
  const canManageHalls = useCan(Permission.HallsManage);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter | null) ?? 'all';
  const { actionsFor, dialogs } = useOrderDialogs();

  const stats = useMemo(() => {
    const all = halls?.flatMap((hall) => hall.tables) ?? [];
    return {
      open: all.filter((table) => table.order).length,
      mine: all.filter((table) => table.order?.waiter?.id === me?.id).length,
      perHall: new Map(halls?.map((hall) => [hall.id, hall.tables.filter((table) => table.order).length])),
    };
  }, [halls, me?.id]);

  const visibleHalls = useMemo(() => {
    if (!halls) return [];
    return halls
      .filter((hall) => !filter.startsWith('hall:') || hall.id === Number(filter.slice(5)))
      .map((hall) => ({
        ...hall,
        tables: hall.tables.filter((table) => {
          if (filter === 'open') return Boolean(table.order);
          if (filter === 'mine') return table.order?.waiter?.id === me?.id;
          return true;
        }),
      }))
      .filter((hall) => hall.tables.length > 0);
  }, [halls, filter, me?.id]);

  const items: SegmentItem<Filter>[] = [
    { value: 'all', label: 'Все', count: stats.open || undefined },
    { value: 'open', label: 'Открытые столы', count: stats.open || undefined },
    { value: 'mine', label: 'Мои заказы', count: stats.mine || undefined },
    ...(halls ?? []).map((hall) => ({
      value: `hall:${hall.id}` as Filter,
      label: hall.name,
      count: stats.perHall.get(hall.id) || undefined,
    })),
  ];

  const openFreeTable = (tableId: number) => {
    if (!canCreate) {
      toast.warning('У вас нет права создавать заказы');
      return;
    }
    if (!shift) {
      toast.warning('Смена не открыта. Откройте смену, чтобы принимать заказы');
      return;
    }
    navigate(`/pos/order/new?type=TABLE&tableId=${tableId}`);
  };

  if (isLoading) return <PageSpinner />;

  if (!halls?.length) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={<MapPin />}
        title="Залы и столы ещё не настроены"
        description="Создайте залы и добавьте в них столы — после этого они появятся здесь."
        action={
          canManageHalls && (
            <Link to="/halls/halls">
              <Button>Настроить залы</Button>
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ShiftBanner />
      <Segmented
        items={items}
        value={filter}
        onChange={(value) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              if (value === 'all') next.delete('filter');
              else next.set('filter', value);
              return next;
            },
            { replace: true },
          )
        }
      />

      {visibleHalls.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid />}
          title={filter === 'mine' ? 'У вас нет открытых заказов' : 'Нет занятых столов'}
          description="Все столы свободны."
        />
      ) : (
        visibleHalls.map((hall) => (
          <section key={hall.id}>
            <h2 className="mb-3 flex items-center gap-2.5 text-[13px] font-bold tracking-[0.06em] text-ink-700 uppercase">
              {hall.name}
              {(stats.perHall.get(hall.id) ?? 0) > 0 && (
                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-800 tabular">
                  {stats.perHall.get(hall.id)}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {hall.tables.map((table) =>
                table.order ? (
                  <OrderCard
                    key={table.id}
                    title={table.name}
                    number={table.order.number}
                    createdAt={table.order.createdAt}
                    total={table.order.total}
                    printCount={table.order.precheckCount}
                    footer={table.order.waiter?.fullName ?? 'Без официанта'}
                    actions={actionsFor({
                      id: table.order.id,
                      number: table.order.number,
                      type: 'TABLE',
                      total: table.order.total,
                      title: table.name,
                      tableId: table.id,
                      waiterId: table.order.waiter?.id ?? null,
                    })}
                  />
                ) : (
                  <FreeTableCard key={table.id} name={table.name} onClick={() => openFreeTable(table.id)} />
                ),
              )}
            </div>
          </section>
        ))
      )}
      {dialogs}
    </div>
  );
}
