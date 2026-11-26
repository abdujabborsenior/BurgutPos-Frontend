import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: keyof typeof SIZES;
  footer?: ReactNode;
  children?: ReactNode;
  /** Prevent closing by backdrop/Escape while a request is running. */
  locked?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  footer,
  children,
  locked,
  className,
  bodyClassName,
}: ModalProps) {
  return (
    <Dialog open={open} onClose={() => !locked && onClose()} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink-950/40 backdrop-blur-[2px] transition-opacity duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <DialogPanel
            transition
            className={cn(
              'flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-ink-950/5 transition duration-200 ease-out data-closed:translate-y-2 data-closed:scale-[0.98] data-closed:opacity-0',
              SIZES[size],
              className,
            )}
          >
            {(title || description) && (
              <div className="flex items-start gap-3 border-b border-ink-100 px-6 py-5">
                {icon && (
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 [&_svg]:size-[18px]">
                    {icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {title && <DialogTitle className="text-[17px] font-semibold text-ink-900">{title}</DialogTitle>}
                  {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={locked}
                  aria-label="Закрыть"
                  className="-mt-1 -mr-2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-40"
                >
                  <X className="size-[18px]" />
                </button>
              </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin', bodyClassName)}>{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
                {footer}
              </div>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  width = 'max-w-xl',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  width?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink-950/35 backdrop-blur-[2px] transition-opacity duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-y-0 right-0 flex w-full justify-end pl-10">
        <DialogPanel
          transition
          className={cn(
            'flex h-full w-full flex-col bg-white shadow-pop transition duration-250 ease-out data-closed:translate-x-8 data-closed:opacity-0',
            width,
          )}
        >
          <div className="flex items-start gap-3 border-b border-ink-100 px-6 py-5">
            <div className="min-w-0 flex-1">
              {title && <DialogTitle className="text-[17px] font-semibold text-ink-900">{title}</DialogTitle>}
              {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="-mt-1 -mr-2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-ink-100 bg-ink-25 px-6 py-4">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
