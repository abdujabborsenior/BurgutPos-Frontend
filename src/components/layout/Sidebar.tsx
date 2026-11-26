import { ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui.store';
import { withKeptSearch, type NavGroup } from './navigation';
import { useNavigationGroups } from './useNavigationGroups';

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgb(29_26_107/0.8)]">
        B
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning-500" />
      </span>
      {!collapsed && (
        <span className="text-[17px] font-bold tracking-[-0.02em] text-ink-900">
          Burgut<span className="text-brand-700">POS</span>
        </span>
      )}
    </div>
  );
}

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const collapsedSetting = useUiStore((state) => state.sidebarCollapsed);
  const openGroups = useUiStore((state) => state.openGroups);
  const toggleGroup = useUiStore((state) => state.toggleGroup);
  const openGroup = useUiStore((state) => state.openGroup);
  const setMobileSidebar = useUiStore((state) => state.setMobileSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = mobile ? false : collapsedSetting;

  const groups = useNavigationGroups();

  // Keep the group of the current page expanded.
  useEffect(() => {
    const active = groups.find((group) => group.children?.some((child) => location.pathname.startsWith(child.to)));
    if (active) openGroup(active.key);
  }, [groups, location.pathname, openGroup]);

  const isGroupActive = (group: NavGroup) =>
    group.to ? location.pathname.startsWith(group.to) : Boolean(group.children?.some((c) => location.pathname.startsWith(c.to)));

  /** A top-level row: icon, label and — for a group — a chevron. */
  const itemBase =
    'group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14.5px] transition-colors duration-150 [&>svg]:size-[18px] [&>svg]:shrink-0';
  /** The section of the current page: a solid brand pill. */
  const itemActive =
    'bg-brand-900 font-semibold text-white shadow-[0_8px_18px_-10px_rgb(29_26_107/0.75)] hover:bg-brand-800 [&>svg]:text-white';
  const itemIdle = 'font-medium text-ink-900 hover:bg-ink-50 [&>svg]:text-ink-500 hover:[&>svg]:text-ink-800';

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-ink-150 bg-white',
        mobile ? 'w-72' : collapsed ? 'w-[84px]' : 'w-64',
        'transition-[width] duration-200',
      )}
    >
      <div className={cn('flex h-[72px] shrink-0 items-center', collapsed ? 'justify-center' : 'px-6')}>
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-6 scrollbar-thin" aria-label="Основное меню">
        <ul className="flex flex-col gap-1">
          {groups.map((group) => {
            const active = isGroupActive(group);
            const open = openGroups.includes(group.key);
            if (!group.children) {
              return (
                <li key={group.key}>
                  <NavLink
                    to={group.to as string}
                    title={collapsed ? group.label : undefined}
                    onClick={() => mobile && setMobileSidebar(false)}
                    className={cn(itemBase, collapsed && 'justify-center px-0', active ? itemActive : itemIdle)}
                  >
                    {group.icon}
                    {!collapsed && <span className="truncate">{group.label}</span>}
                  </NavLink>
                </li>
              );
            }
            return (
              <li key={group.key}>
                <button
                  type="button"
                  title={collapsed ? group.label : undefined}
                  aria-expanded={collapsed ? undefined : open}
                  onClick={() => {
                    if (collapsed) {
                      const first = group.children?.[0];
                      if (first) navigate(first.to);
                    } else toggleGroup(group.key);
                  }}
                  className={cn(itemBase, collapsed && 'justify-center px-0', active ? itemActive : itemIdle)}
                >
                  {group.icon}
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{group.label}</span>
                      {/* Wrapped: the row's `[&>svg]` icon sizing must not reach the chevron. */}
                      <span className="flex shrink-0" aria-hidden>
                        <ChevronRight
                          className={cn(
                            'size-4 transition-transform duration-200',
                            open && 'rotate-90',
                            active ? 'text-white/80' : 'text-ink-400 group-hover:text-ink-600',
                          )}
                        />
                      </span>
                    </>
                  )}
                </button>
                {!collapsed && open && (
                  <ul className="relative mt-1 mb-1.5 ml-[21px] flex flex-col gap-0.5 border-l border-ink-200 pl-3">
                    {group.children.map((child) => (
                      <li key={child.to}>
                        <NavLink
                          to={withKeptSearch(child, location.pathname, location.search)}
                          onClick={() => mobile && setMobileSidebar(false)}
                          className={({ isActive }) =>
                            cn(
                              'relative flex h-9 items-center rounded-lg px-3 text-[14px] transition-colors duration-150',
                              isActive
                                ? 'bg-brand-100 font-semibold text-brand-900 before:absolute before:top-1/2 before:-left-[13px] before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-800'
                                : 'font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900',
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
