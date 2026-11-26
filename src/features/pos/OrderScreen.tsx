import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  ChefHat,
  ClipboardEdit,
  Minus,
  MoreHorizontal,
  Percent,
  Plus,
  Printer,
  RotateCcw,
  Send,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { getErrorCode, getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { ordersApi } from '@/api/pos.api';
import type { OrderDetail, OrderItemView, OrderType, PosDish } from '@/api/types';
import { Badge, Button, DropdownMenu, EmptyState, IconButton, PageSpinner, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { FRACTIONAL_DISH_UNITS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/labels';
import { formatDateTime, formatDuration, formatMoney, formatShortDateTime } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { printKitchenTickets } from '@/lib/print';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { cartKeyForNew, cartKeyForOrder, EMPTY_CART, useCartStore, type CartLine } from '@/stores/cart.store';
import { MenuPane } from './components/MenuPane';
import { CartLines, SentLines, TotalsBlock } from './components/OrderLines';
import { ShiftBanner } from './components/ShiftBanner';
import { CancelItemModal } from './modals/CancelItemModal';
import { CancelOrderModal } from './modals/CancelOrderModal';
import { DiscountModal } from './modals/DiscountModal';
import { OrderInfoFields, OrderInfoModal } from './modals/OrderInfoModal';
import { emptyOrderInfo, orderInfoSchema, type OrderInfoValues } from './modals/orderInfo';
import { PaymentModal } from './modals/PaymentModal';
import { QuantityModal, type QuantityRequest } from './modals/QuantityModal';
import { TransferModal, type TransferTarget } from './modals/TransferModal';
import { useOrderActions } from './useOrderActions';
import { useReopenOrder } from './useReopenOrder';
import { useBoard, usePosMenu, useSettings, useShiftStatus, useWaiters } from './usePosData';
import { usePrintOrder } from './usePrintOrder';

const ORDER_TYPES: OrderType[] = ['TABLE', 'TAKEAWAY', 'DELIVERY', 'HALL'];
const round2 = (value: number) => Math.round(value * 100) / 100;

const backPath = (type: OrderType) =>
  ({ TABLE: '/pos/tables', TAKEAWAY: '/pos/takeaway', DELIVERY: '/pos/delivery', HALL: '/pos/hall' })[type];

export default function OrderScreen() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  if (orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) return <Navigate to="/pos/tables" replace />;
    return <ExistingOrder key={id} orderId={id} />;
  }
  const type = params.get('type') as OrderType | null;
  const tableId = Number(params.get('tableId')) || null;
  if (!type || !ORDER_TYPES.includes(type) || (type === 'TABLE' && !tableId)) {
    return <Navigate to="/pos/tables" replace />;
  }
  return <NewOrder key={`${type}-${tableId}`} type={type} tableId={tableId} />;
}

// ─────────────────────────────── Shared cart logic ───────────────────────────────

function useCart(cartKey: string, allowNegative: boolean) {
  const lines = useCartStore((state) => state.carts[cartKey] ?? EMPTY_CART);
  const add = useCartStore((state) => state.add);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const setComment = useCartStore((state) => state.setComment);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);
  const { data: menu } = usePosMenu();
  const [quantityRequest, setQuantityRequest] = useState<(QuantityRequest & { onDone: (qty: number) => void }) | null>(null);

  const dishes = useMemo(() => new Map((menu ?? []).flatMap((c) => c.dishes).map((dish) => [dish.id, dish])), [menu]);
  const quantities = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of lines) map.set(line.dishId, round2((map.get(line.dishId) ?? 0) + line.quantity));
    return map;
  }, [lines]);
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));

  const available = (dishId: number, exceptLine?: CartLine) => {
    const dish = dishes.get(dishId);
    if (!dish?.trackStock || allowNegative) return Infinity;
    const inCart = (quantities.get(dishId) ?? 0) - (exceptLine?.quantity ?? 0);
    return round2(dish.saleQty - inCart);
  };

  const pick = (dish: PosDish) => {
    if (FRACTIONAL_DISH_UNITS.includes(dish.unit)) {
      setQuantityRequest({
        title: dish.name,
        unit: dish.unit,
        price: dish.price,
        max: Number.isFinite(available(dish.id)) ? available(dish.id) : undefined,
        onDone: (quantity) => add(cartKey, { dishId: dish.id, name: dish.name, price: dish.price, unit: dish.unit }, quantity),
      });
      return;
    }
    if (available(dish.id) < 1) {
      toast.warning(`«${dish.name}»: недостаточно остатка`);
      return;
    }
    add(cartKey, { dishId: dish.id, name: dish.name, price: dish.price, unit: dish.unit }, 1);
  };

  const changeQuantity = (line: CartLine, quantity: number) => {
    if (quantity > line.quantity && quantity > available(line.dishId, line)) {
      toast.warning(`«${line.name}»: недостаточно остатка`);
      return;
    }
    setQuantity(cartKey, line.key, quantity);
  };

  const editQuantity = (line: CartLine) => {
    const max = available(line.dishId, line);
    setQuantityRequest({
      title: line.name,
      unit: line.unit,
      price: line.price,
      initial: line.quantity,
      max: Number.isFinite(max) ? max : undefined,
      onDone: (quantity) => setQuantity(cartKey, line.key, quantity),
    });
  };

  const quantityModal = (
    <QuantityModal
      request={quantityRequest}
      onClose={() => setQuantityRequest(null)}
      onSubmit={(quantity) => quantityRequest?.onDone(quantity)}
    />
  );

  return {
    lines,
    quantities,
    subtotal,
    pick,
    changeQuantity,
    editQuantity,
    comment: (line: CartLine, value: string) => setComment(cartKey, line.key, value),
    remove: (line: CartLine) => remove(cartKey, line.key),
    clear: () => clear(cartKey),
    quantityModal,
  };
}

function PanelShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <aside
      className={cn(
        'flex min-h-0 w-full flex-col rounded-2xl border border-ink-150/80 bg-white shadow-card lg:w-[420px] lg:shrink-0 xl:w-[460px]',
        className,
      )}
    >
      {children}
    </aside>
  );
}

function PanelHeader({ title, subtitle, back, right }: { title: React.ReactNode; subtitle?: React.ReactNode; back: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
      <Link to={back} aria-label="Назад" className="mt-0.5 rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
        <ArrowLeft className="size-[18px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink-900 uppercase">{title}</h1>
        {subtitle && <div className="mt-0.5 text-xs text-ink-500">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
        <ShoppingCart className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-700">Заказ пуст</p>
      <p className="mt-1 max-w-[220px] text-xs text-ink-500">Выберите блюда в меню слева — они появятся здесь.</p>
    </div>
  );
}

// ─────────────────────────────── New order ───────────────────────────────

function NewOrder({ type, tableId }: { type: OrderType; tableId: number | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const canManageAll = useCan(Permission.OrdersManageAll);
  const iServe = Boolean(me && !me.isSuperadmin && me.permissions.includes(Permission.OrdersServe));
  const { data: settings } = useSettings();
  const { data: shift } = useShiftStatus();
  const board = useBoard();
  const menu = usePosMenu();
  const waiters = useWaiters(canManageAll);
  const cartKey = cartKeyForNew(type, tableId);
  const cart = useCart(cartKey, settings?.allowNegativeStock ?? false);
  const [waiterId, setWaiterId] = useState<number | null>(iServe ? (me?.id ?? null) : null);
  const [guests, setGuests] = useState<number | null>(null);
  const form = useForm<OrderInfoValues>({ resolver: zodResolver(orderInfoSchema(type)), defaultValues: emptyOrderInfo });

  let table: (NonNullable<typeof board.data>[number]['tables'][number] & { hallName: string }) | null = null;
  for (const hall of board.data ?? []) {
    const found = hall.tables.find((item) => item.id === tableId);
    if (found) {
      table = { ...found, hallName: hall.name };
      break;
    }
  }

  const servicePercent = settings?.serviceChargeOrderTypes.includes(type) ? settings.serviceChargePercent : 0;
  const watchedFee = useWatch({ control: form.control, name: 'deliveryFee' });
  const deliveryFee = type === 'DELIVERY' ? (watchedFee ?? 0) : 0;
  const service = round2((cart.subtotal * servicePercent) / 100);
  const total = round2(cart.subtotal + service + deliveryFee);

  const create = useMutation({
    mutationFn: (info: OrderInfoValues) =>
      ordersApi.create({
        type,
        tableId: tableId ?? undefined,
        waiterId: canManageAll ? (waiterId ?? undefined) : undefined,
        guests: (type === 'TABLE' ? guests : info.guests) ?? undefined,
        customerName: info.customerName || undefined,
        customerPhone: info.customerPhone || undefined,
        deliveryAddress: type === 'DELIVERY' ? info.deliveryAddress : undefined,
        deliveryFee: type === 'DELIVERY' ? (info.deliveryFee ?? 0) : undefined,
        comment: info.comment || undefined,
        items: cart.lines.map((line) => ({ dishId: line.dishId, quantity: line.quantity, comment: line.comment || undefined })),
      }),
    onSuccess: ({ order, addedItemIds }) => {
      cart.clear();
      queryClient.setQueryData(qk.order(order.id), order);
      invalidateScopes('board', 'counters', 'orders', 'stock');
      toast.success(`Заказ #${order.number} создан`);
      if (settings?.autoPrintKitchenTicket) printKitchenTickets(order, settings, addedItemIds, { completedBy: me?.fullName });
      navigate(`/pos/order/${order.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      if (getErrorCode(error) === 'SHIFT_CLOSED') invalidateScopes('shift');
      invalidateScopes('board', 'menu');
    },
  });

  if (type === 'TABLE' && board.data && !table) {
    return <EmptyState className="min-h-[60vh]" title="Стол не найден" description="Возможно, он был архивирован." action={<Link to="/pos/tables"><Button>К столам</Button></Link>} />;
  }
  if (table?.order) return <Navigate to={`/pos/order/${table.order.id}`} replace />;

  const title = type === 'TABLE' ? (table?.name ?? '…') : `Новый заказ · ${ORDER_TYPE_LABELS[type]}`;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-108px)]">
      <ShiftBanner />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <MenuPane
          categories={menu.data}
          loading={menu.isLoading}
          cartQuantities={cart.quantities}
          allowNegative={settings?.allowNegativeStock ?? false}
          onPick={cart.pick}
        />
        <PanelShell>
          <PanelHeader
            back={backPath(type)}
            title={title}
            subtitle={type === 'TABLE' && table ? `${table.hallName} · новый заказ` : 'Позиции ещё не отправлены'}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
            <div className="flex flex-col gap-4">
              {canManageAll && (
                <Select
                  label="Официант"
                  value={waiterId}
                  onChange={setWaiterId}
                  options={[
                    { value: null, label: 'Без официанта' },
                    ...(waiters.data ?? []).map((waiter) => ({ value: waiter.id, label: waiter.fullName })),
                  ]}
                />
              )}
              {type === 'TABLE' ? (
                <div className="flex items-center justify-between rounded-xl border border-ink-150 px-3.5 py-2.5">
                  <span className="text-[13px] font-medium text-ink-700">Гостей</span>
                  <div className="flex items-center gap-2">
                    <IconButton label="Меньше гостей" icon={<Minus />} size="sm" variant="outline" disabled={!guests} onClick={() => setGuests((g) => (g && g > 1 ? g - 1 : null))} />
                    <span className="w-8 text-center text-[15px] font-bold text-ink-900 tabular">{guests ?? '—'}</span>
                    <IconButton label="Больше гостей" icon={<Plus />} size="sm" variant="outline" onClick={() => setGuests((g) => Math.min((g ?? 0) + 1, 500))} />
                  </div>
                </div>
              ) : (
                <form id="new-order-info" onSubmit={(event) => event.preventDefault()}>
                  <OrderInfoFields type={type} form={form} />
                </form>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-500 uppercase">Новые позиции</p>
                {cart.lines.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <CartLines lines={cart.lines} onQuantity={cart.changeQuantity} onEditQuantity={cart.editQuantity} onComment={cart.comment} onRemove={cart.remove} />
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-ink-100 px-5 py-4">
            <TotalsBlock
              rows={[
                { label: 'Сумма позиций', value: formatMoney(cart.subtotal) },
                ...(servicePercent > 0 ? [{ label: `Обслуживание ${servicePercent}%`, value: formatMoney(service) }] : []),
                ...(deliveryFee > 0 ? [{ label: 'Доставка', value: formatMoney(deliveryFee) }] : []),
              ]}
              total={total}
              totalLabel="Итого"
            />
            <Button
              size="xl"
              fullWidth
              className="mt-4"
              leftIcon={<Send className="size-5" />}
              disabled={cart.lines.length === 0 || !shift}
              loading={create.isPending}
              onClick={form.handleSubmit((info) => create.mutate(info), () => toast.error('Заполните данные клиента'))}
            >
              {shift ? 'Создать заказ' : 'Смена не открыта'}
            </Button>
          </div>
        </PanelShell>
      </div>
      {cart.quantityModal}
    </div>
  );
}

// ─────────────────────────────── Existing order ───────────────────────────────

function ExistingOrder({ orderId }: { orderId: number }) {
  const { data: order, isLoading, error } = useQuery({
    queryKey: qk.order(orderId),
    queryFn: () => ordersApi.get(orderId),
  });
  if (isLoading) return <PageSpinner />;
  if (error || !order) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        title="Заказ не найден"
        description={getErrorMessage(error, 'Заказ не существует или был удалён.')}
        action={<Link to="/pos/tables"><Button>К столам</Button></Link>}
      />
    );
  }
  return order.status === 'OPEN' ? <OpenOrder order={order} /> : <ClosedOrder order={order} />;
}

function orderTitle(order: OrderDetail) {
  return order.type === 'TABLE' && order.table ? order.table.name : `${ORDER_TYPE_LABELS[order.type]} · #${order.number}`;
}

function OpenOrder({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const { data: settings } = useSettings();
  const { data: shift } = useShiftStatus();
  const menu = usePosMenu();
  const cart = useCart(cartKeyForOrder(order.id), settings?.allowNegativeStock ?? false);
  const { precheck } = useOrderActions();

  const canCreate = useCan(Permission.OrdersCreate);
  const canManageAll = useCan(Permission.OrdersManageAll);
  const owns = order.waiter?.id === me?.id || (!order.waiter && order.createdBy?.id === me?.id);
  const canModify = canManageAll || owns;
  const canCancelItems = useCan(Permission.OrdersCancelItems) && canModify;
  const canCancel = useCan(Permission.OrdersCancel) && canModify;
  const canTransfer = useCan(Permission.OrdersTransfer) && canModify;
  const canDiscount = useCan(Permission.OrdersDiscount) && canModify;
  const canPay = useCan(Permission.OrdersPay) && canModify;
  const editable = canCreate && canModify;

  const [cancelItem, setCancelItem] = useState<OrderItemView | null>(null);
  const [cancelOrder, setCancelOrder] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [transfer, setTransfer] = useState<TransferTarget | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const store = (updated: OrderDetail) => queryClient.setQueryData(qk.order(updated.id), updated);

  const send = useMutation({
    mutationFn: () =>
      ordersApi.addItems(
        order.id,
        cart.lines.map((line) => ({ dishId: line.dishId, quantity: line.quantity, comment: line.comment || undefined })),
      ),
    onSuccess: ({ order: updated, addedItemIds }) => {
      cart.clear();
      store(updated);
      invalidateScopes('board', 'counters', 'orders', 'stock');
      toast.success('Позиции отправлены');
      if (settings?.autoPrintKitchenTicket) printKitchenTickets(updated, settings, addedItemIds, { completedBy: me?.fullName });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      invalidateScopes('menu', 'orders');
    },
  });

  const activeItems = order.items.filter((item) => item.status === 'ACTIVE');
  const back = backPath(order.type);
  const hasCart = cart.lines.length > 0;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-108px)]">
      <ShiftBanner />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {editable ? (
          <MenuPane
            categories={menu.data}
            loading={menu.isLoading}
            cartQuantities={cart.quantities}
            allowNegative={settings?.allowNegativeStock ?? false}
            onPick={cart.pick}
          />
        ) : (
          <section className="flex flex-1 items-center justify-center rounded-2xl border border-ink-150/80 bg-white shadow-card">
            <EmptyState
              icon={<ChefHat />}
              title="Только просмотр"
              description={canCreate ? 'Это заказ другого официанта.' : 'У вашей роли нет права добавлять блюда.'}
            />
          </section>
        )}

        <PanelShell>
          <PanelHeader
            back={back}
            title={orderTitle(order)}
            subtitle={
              <>
                <span className="font-semibold text-ink-700">#{order.number}</span> · {formatShortDateTime(order.createdAt)} ·{' '}
                {formatDuration(order.createdAt)}
                {order.table?.hall ? ` · ${order.table.hall.name}` : ''}
              </>
            }
            right={
              <DropdownMenu
                trigger={<IconButton label="Действия с заказом" icon={<MoreHorizontal />} variant="outline" />}
                items={[
                  { label: 'Скидка', icon: <Percent />, onClick: () => setDiscountOpen(true), hidden: !canDiscount },
                  {
                    label: order.type === 'TABLE' ? 'Перенести / официант' : 'Сменить официанта',
                    icon: <ArrowLeftRight />,
                    onClick: () =>
                      setTransfer({ id: order.id, number: order.number, type: order.type, tableId: order.table?.id ?? null, waiterId: order.waiter?.id ?? null, title: orderTitle(order) }),
                    hidden: !canTransfer,
                  },
                  { label: 'Данные заказа', icon: <ClipboardEdit />, onClick: () => setInfoOpen(true), hidden: !editable },
                  { label: 'Печать для кухни', icon: <ChefHat />, onClick: () => printKitchenTickets(order, settings, undefined, { completedBy: me?.fullName }), hidden: activeItems.length === 0 },
                  { label: 'Отменить заказ', icon: <Ban />, onClick: () => setCancelOrder(true), danger: true, separatorBefore: true, hidden: !canCancel },
                ]}
              />
            }
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-2.5 text-xs">
            <Badge tone="brand" size="sm">
              {order.waiter ? order.waiter.fullName : 'Без официанта'}
            </Badge>
            {order.guests ? <Badge size="sm">Гостей: {order.guests}</Badge> : null}
            {order.precheckAt && (
              <Badge tone="warning" size="sm" dot>
                Счёт выдан {formatShortDateTime(order.precheckAt)}
              </Badge>
            )}
            {order.customerPhone && <Badge size="sm">{order.customerPhone}</Badge>}
            {order.deliveryAddress && <span className="w-full truncate text-ink-500">Адрес: {order.deliveryAddress}</span>}
            {order.comment && <span className="w-full truncate text-ink-500 italic">«{order.comment}»</span>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 scrollbar-thin">
            {activeItems.length === 0 && !hasCart && order.items.length === 0 ? (
              <EmptyCart />
            ) : (
              <SentLines items={order.items} canCancel={canCancelItems} onCancel={setCancelItem} />
            )}
            {hasCart && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-brand-800 uppercase">Новые позиции · не отправлены</p>
                <CartLines lines={cart.lines} onQuantity={cart.changeQuantity} onEditQuantity={cart.editQuantity} onComment={cart.comment} onRemove={cart.remove} />
              </div>
            )}
          </div>

          <div className="border-t border-ink-100 px-5 py-4">
            <TotalsBlock
              rows={[
                { label: 'Сумма позиций', value: formatMoney(order.subtotal) },
                ...(order.discountAmount > 0
                  ? [{ label: `Скидка${order.discountType === 'PERCENT' ? ` ${order.discountValue}%` : ''}`, value: `−${formatMoney(order.discountAmount)}`, tone: 'danger' as const }]
                  : []),
                ...(order.serviceAmount > 0 ? [{ label: `Обслуживание ${order.servicePercent}%`, value: formatMoney(order.serviceAmount) }] : []),
                ...(order.deliveryFee > 0 ? [{ label: 'Доставка', value: formatMoney(order.deliveryFee) }] : []),
              ]}
              total={order.total}
            />
            {hasCart ? (
              <Button
                size="xl"
                fullWidth
                className="mt-4"
                leftIcon={<Send className="size-5" />}
                loading={send.isPending}
                onClick={() => send.mutate()}
              >
                Отправить · {formatMoney(cart.subtotal)}
              </Button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Button
                  size="lg"
                  variant="secondary"
                  leftIcon={<Printer className="size-[18px]" />}
                  disabled={activeItems.length === 0 || !canModify}
                  loading={precheck.isPending}
                  onClick={() => precheck.mutate(order.id)}
                >
                  Счёт
                </Button>
                {canPay ? (
                  <Button
                    size="lg"
                    leftIcon={<Wallet className="size-[18px]" />}
                    disabled={activeItems.length === 0 || !shift}
                    onClick={() => setPaying(true)}
                  >
                    Оплата
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" onClick={() => navigate(back)}>
                    Готово
                  </Button>
                )}
              </div>
            )}
          </div>
        </PanelShell>
      </div>

      {cart.quantityModal}
      <CancelItemModal orderId={order.id} item={cancelItem} onClose={() => setCancelItem(null)} onCancelled={store} />
      <CancelOrderModal
        order={cancelOrder ? { id: order.id, number: order.number, total: order.total, title: orderTitle(order) } : null}
        onClose={() => setCancelOrder(false)}
        onCancelled={(cancelled) => {
          store(cancelled);
          cart.clear();
          navigate(back);
        }}
      />
      <DiscountModal order={discountOpen ? order : null} onClose={() => setDiscountOpen(false)} onApplied={store} />
      <TransferModal
        order={transfer}
        onClose={() => setTransfer(null)}
        onTransferred={(updated) => {
          store(updated);
          if (updated.id !== order.id) {
            cart.clear();
            navigate(`/pos/order/${updated.id}`, { replace: true });
          }
        }}
      />
      <OrderInfoModal order={infoOpen ? order : null} onClose={() => setInfoOpen(false)} onSaved={store} />
      <PaymentModal
        orderId={paying ? order.id : null}
        onClose={() => setPaying(false)}
        onPaid={(paid) => {
          store(paid);
          cart.clear();
          navigate(back);
        }}
      />
    </div>
  );
}

function ClosedOrder({ order }: { order: OrderDetail }) {
  const printing = usePrintOrder();
  const me = useAuthStore((state) => state.user);
  const clearCart = useCartStore((state) => state.clear);
  // Unsent lines of an order closed elsewhere can never be sent — drop them.
  useEffect(() => {
    clearCart(cartKeyForOrder(order.id));
  }, [clearCart, order.id]);
  const back = backPath(order.type);
  const tone = order.status === 'PAID' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'neutral';
  const active = order.items.filter((item) => item.status === 'ACTIVE');
  const canReopen = useCan(Permission.OrdersReopen) && order.status === 'PAID';
  const { reopen, pendingId } = useReopenOrder();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-150/80 bg-white px-6 py-5 shadow-card">
        <Link to={back} aria-label="Назад" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
          <ArrowLeft className="size-[18px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-ink-900">
            Заказ #{order.number} · {order.type === 'TABLE' && order.table ? order.table.name : ORDER_TYPE_LABELS[order.type]}
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Открыт {formatDateTime(order.createdAt)}
            {order.closedAt ? ` · закрыт ${formatDateTime(order.closedAt)}` : ''}
            {order.cancelledAt ? ` · отменён ${formatDateTime(order.cancelledAt)}` : ''}
          </p>
        </div>
        <Badge tone={tone} dot>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
        {canReopen && (
          <Button
            variant="secondary"
            leftIcon={<RotateCcw className="size-4" />}
            loading={pendingId === order.id}
            onClick={() => void reopen(order)}
          >
            Восстановить
          </Button>
        )}
        {order.status === 'PAID' && (
          <Button variant="secondary" leftIcon={<Printer className="size-4" />} onClick={() => void printing.receipt(order, me?.fullName)}>
            Печать чека
          </Button>
        )}
      </div>

      {order.reopenCount > 0 && order.reopenedAt && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3.5 text-sm text-warning-700">
          <span className="font-semibold">
            Возвращался в работу{order.reopenCount > 1 ? ` (${order.reopenCount} раза)` : ''}:
          </span>{' '}
          {formatDateTime(order.reopenedAt)}
          {order.reopenedBy ? ` · ${order.reopenedBy.fullName}` : ''}
          {order.reopenReason ? ` · ${order.reopenReason}` : ''}
        </div>
      )}

      {order.status === 'CANCELLED' && order.cancelReason && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-5 py-3.5 text-sm text-danger-700">
          <span className="font-semibold">Причина отмены:</span> {order.cancelReason}
          {order.cancelledBy ? ` · ${order.cancelledBy.fullName}` : ''}
        </div>
      )}
      {order.status === 'MERGED' && order.mergedIntoId && (
        <div className="rounded-2xl border border-ink-200 bg-white px-5 py-3.5 text-sm text-ink-700">
          Позиции перенесены в{' '}
          <Link to={`/pos/order/${order.mergedIntoId}`} className="font-semibold text-brand-700 hover:text-brand-900">
            заказ #{order.mergedIntoId}
          </Link>
          .
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-ink-150/80 bg-white p-5 shadow-card">
          <SentLines items={order.items} canCancel={false} onCancel={() => undefined} />
          {active.length > 0 && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <TotalsBlock
                rows={[
                  { label: 'Сумма позиций', value: formatMoney(order.subtotal) },
                  ...(order.discountAmount > 0 ? [{ label: 'Скидка', value: `−${formatMoney(order.discountAmount)}`, tone: 'danger' as const }] : []),
                  ...(order.serviceAmount > 0 ? [{ label: `Обслуживание ${order.servicePercent}%`, value: formatMoney(order.serviceAmount) }] : []),
                  ...(order.deliveryFee > 0 ? [{ label: 'Доставка', value: formatMoney(order.deliveryFee) }] : []),
                ]}
                total={order.total}
                totalLabel="Итого"
              />
            </div>
          )}
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-ink-150/80 bg-white p-5 text-sm shadow-card">
          <Info label="Официант" value={order.waiter?.fullName} />
          <Info label="Создал" value={order.createdBy?.fullName} />
          {order.closedBy && <Info label="Кассир" value={order.closedBy.fullName} />}
          {order.guests ? <Info label="Гостей" value={String(order.guests)} /> : null}
          {order.customerName && <Info label="Клиент" value={order.customerName} />}
          {order.customerPhone && <Info label="Телефон" value={order.customerPhone} />}
          {order.deliveryAddress && <Info label="Адрес" value={order.deliveryAddress} />}
          {order.payments.length > 0 && (
            <div className="mt-1 border-t border-ink-100 pt-3">
              <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-500 uppercase">Оплата</p>
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-3 py-0.5">
                  <span className={payment.isReversal ? 'text-danger-700' : 'text-ink-600'}>
                    {payment.isReversal ? `Сторно · ${payment.method.name}` : payment.method.name}
                  </span>
                  <span className={cn('font-semibold tabular', payment.isReversal ? 'text-danger-700' : 'text-ink-900')}>
                    {payment.isReversal ? `−${formatMoney(Math.abs(payment.amount))}` : formatMoney(payment.amount)}
                  </span>
                </div>
              ))}
              {order.changeAmount > 0 && (
                <div className="flex justify-between py-0.5 text-ink-500">
                  <span>Сдача</span>
                  <span className="tabular">{formatMoney(order.changeAmount)}</span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900">{value ?? '—'}</span>
    </div>
  );
}
