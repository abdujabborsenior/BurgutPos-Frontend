import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  anchor = 'bottom end',
}: {
  trigger: ReactNode;
  items: MenuAction[];
  anchor?: 'bottom end' | 'bottom start' | 'top end' | 'top start';
}) {
  const visible = items.filter((item) => !item.hidden);
  if (!visible.length) return null;
  return (
    <Menu>
      <MenuButton as="div" className="inline-flex">
        {trigger}
      </MenuButton>
      <MenuItems
        anchor={anchor}
        transition
        className="z-[60] min-w-52 rounded-xl border border-ink-150 bg-white p-1 shadow-pop [--anchor-gap:6px] focus:outline-none transition duration-100 ease-out data-closed:scale-[0.98] data-closed:opacity-0"
      >
        {visible.map((item) => (
          <div key={item.label}>
            {item.separatorBefore && <MenuSeparator className="my-1 h-px bg-ink-100" />}
            <MenuItem disabled={item.disabled}>
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium data-disabled:opacity-40 [&_svg]:size-4',
                  item.danger
                    ? 'text-danger-600 data-focus:bg-danger-50'
                    : 'text-ink-700 data-focus:bg-ink-50 data-focus:text-ink-900',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </MenuItem>
          </div>
        ))}
      </MenuItems>
    </Menu>
  );
}
