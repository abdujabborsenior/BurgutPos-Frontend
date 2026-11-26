import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  KeyRound,
  LayoutGrid,
  LogOut,
  Maximize,
  Menu,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  ShoppingBag,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { qk } from '@/api/keys';
import { posApi } from '@/api/pos.api';
import { shiftsApi } from '@/api/shifts.api';
import type { OrderType } from '@/api/types';
import { Avatar, CountChip, DropdownMenu, IconButton } from '@/components/ui';
import { ChangePasswordModal } from '@/features/auth/ChangePasswordModal';
import { signOut } from '@/features/auth/session';
import { useFullscreen } from '@/hooks/useFullscreen';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { Permission } from '@/lib/permissions';
import { useAuthStore, useCan } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useUiStore } from '@/stores/ui.store';
import { PresenceModal } from './PresenceModal';
import { Logo } from './Sidebar';

const CHANNELS: { type: OrderType; label: string; to: string; icon: React.ReactNode }[] = [
  { type: 'TABLE', label: 'Столы', to: '/pos/tables', icon: <LayoutGrid /> },
  { type: 'TAKEAWAY', label: 'С собой', to: '/pos/takeaway', icon: <ShoppingBag /> },
  { type: 'DELIVERY', label: 'Доставка', to: '/pos/delivery', icon: <Truck /> },
  { type: 'HALL', label: 'Зал', to: '/pos/hall', icon: <UtensilsCrossed /> },
];

function ChannelTabs() {
  const { data } = useQuery({ queryKey: qk.counters, queryFn: posApi.counters, refetchInterval: 60_000 });
  return (
    <nav aria-label="Каналы заказов" className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none">
      {CHANNELS.map((channel) => (
        <NavLink
          key={channel.type}
          to={channel.to}
          className={({ isActive }) =>
            cn(
              'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-semibold transition-colors duration-150 [&>svg]:size-4',
              isActive
                ? 'bg-brand-900 text-white shadow-[0_6px_16px_-8px_rgb(29_26_107/0.9)]'
                : 'text-ink-600 hover:bg-white hover:text-ink-900 hover:shadow-card',
            )
          }
        >
          {({ isActive }) => (
            <>
              {channel.icon}
              <span>{channel.label}</span>
              {(data?.[channel.type] ?? 0) > 0 && <CountChip value={data?.[channel.type] ?? 0} active={isActive} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function ShiftIndicator() {
  const navigate = useNavigate();
  const canView = useCan(Permission.ShiftsView);
  const { data: shift, isLoading } = useQuery({ queryKey: qk.shiftStatus, queryFn: shiftsApi.status, refetchInterval: 120_000 });
  if (isLoading) return null;
  const open = Boolean(shift);
  return (
    <button
      type="button"
      disabled={!canView}
      onClick={() => navigate('/shifts/current')}
      title={open ? `Смена №${shift?.id} открыта в ${formatTime(shift?.openedAt)}` : 'Смена не открыта'}
      className={cn(
        'hidden h-10 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors 2xl:inline-flex',
        open
          ? 'border-success-200 bg-success-50 text-success-700 hover:bg-success-100'
          : 'border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100',
        !canView && 'cursor-default',
      )}
    >
      <span className={cn('size-2 rounded-full', open ? 'bg-success-500' : 'animate-pulse bg-warning-500')} />
      {open ? `Смена №${shift?.id}` : 'Смена закрыта'}
    </button>
  );
}

function PresenceButton() {
  const users = usePresenceStore((state) => state.users);
  const connected = usePresenceStore((state) => state.connected);
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        label={connected ? 'Подключённые пользователи' : 'Нет связи с сервером в реальном времени'}
        icon={<Users />}
        variant="outline"
        round
        badge={connected ? users.length || undefined : '!'}
        className={cn(!connected && '[&>span]:bg-warning-500')}
        onClick={() => setOpen(true)}
      />
      <PresenceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function Topbar({ hasNavigation = true }: { hasNavigation?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setMobileSidebar = useUiStore((state) => state.setMobileSidebar);
  const canPos = useCan(Permission.PosAccess);
  const queryClient = useQueryClient();
  const fetching = useIsFetching();
  const fullscreen = useFullscreen();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 bg-ink-50/85 px-4 backdrop-blur-md lg:px-6">
      {hasNavigation ? (
        <>
      <IconButton
        className="lg:hidden"
        label="Открыть меню"
        icon={<Menu />}
        variant="outline"
        round
        onClick={() => setMobileSidebar(true)}
      />
      <IconButton
        className="hidden lg:inline-flex"
        label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        variant="outline"
        round
        onClick={toggleSidebar}
      />
        </>
      ) : (
        <span className="hidden sm:block">
          <Logo collapsed />
        </span>
      )}

      <div className="min-w-0 flex-1">{canPos && <ChannelTabs />}</div>

      <div className="flex shrink-0 items-center gap-2">
        {canPos && <ShiftIndicator />}
        <IconButton
          label="Обновить данные"
          icon={<RotateCw className={cn(fetching > 0 && 'animate-spin')} />}
          variant="outline"
          round
          onClick={() => void queryClient.invalidateQueries()}
        />
        {fullscreen.supported && (
          <IconButton
            className="hidden sm:inline-flex"
            label={fullscreen.active ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
            icon={fullscreen.active ? <Minimize /> : <Maximize />}
            variant="outline"
            round
            onClick={() => void fullscreen.toggle()}
          />
        )}
        <PresenceButton />

        <DropdownMenu
          trigger={
            <button
              type="button"
              className="ml-1 flex h-11 items-center gap-2.5 rounded-full border border-ink-150 bg-white py-1 pr-3 pl-1 shadow-card transition-colors hover:border-ink-300"
            >
              <Avatar name={user?.fullName} />
              <span className="hidden min-w-0 text-left md:block">
                <span className="block max-w-[150px] truncate text-[13px] leading-tight font-semibold text-ink-900">
                  {user?.fullName}
                </span>
                <span className="block max-w-[150px] truncate text-[11px] leading-tight text-ink-500">
                  {user?.isSuperadmin
                    ? user.fullName === 'Суперадмин'
                      ? user.login
                      : 'Суперадмин'
                    : (user?.role?.name ?? '—')}
                </span>
              </span>
              <ChevronDown className="hidden size-4 text-ink-400 md:block" />
            </button>
          }
          items={[
            {
              label: 'Сменить пароль',
              icon: <KeyRound />,
              onClick: () => setPasswordOpen(true),
              hidden: user?.isSuperadmin,
            },
            {
              label: 'Выйти из системы',
              icon: <LogOut />,
              onClick: () => void logout(),
              danger: true,
              separatorBefore: !user?.isSuperadmin,
            },
          ]}
        />
        <button
          type="button"
          onClick={() => void logout()}
          className="hidden h-11 items-center gap-2 rounded-full bg-danger-50 pr-1.5 pl-4 text-[13px] font-semibold text-danger-700 transition-colors hover:bg-danger-100 2xl:inline-flex"
        >
          Выход
          <span className="flex size-8 items-center justify-center rounded-full bg-danger-600 text-white">
            <LogOut className="size-4" />
          </span>
        </button>
      </div>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}
