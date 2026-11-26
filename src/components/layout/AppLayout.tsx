import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { PageSpinner } from '@/components/ui';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { useUiStore } from '@/stores/ui.store';
import { Sidebar } from './Sidebar';
import { useNavigationGroups } from './useNavigationGroups';
import { Topbar } from './Topbar';

export function AppLayout() {
  const mobileOpen = useUiStore((state) => state.mobileSidebarOpen);
  const setMobileSidebar = useUiStore((state) => state.setMobileSidebar);
  // Roles without any back-office section (e.g. waiters) get a full-width POS.
  const hasNavigation = useNavigationGroups().length > 0;

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-50">
      {hasNavigation && (
        <div className="hidden lg:flex">
          <Sidebar />
        </div>
      )}
      <Dialog open={hasNavigation && mobileOpen} onClose={() => setMobileSidebar(false)} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-ink-950/40 transition-opacity duration-200 data-closed:opacity-0"
        />
        <DialogPanel
          transition
          className="fixed inset-y-0 left-0 flex shadow-pop transition duration-200 ease-out data-closed:-translate-x-full"
        >
          <Sidebar mobile />
        </DialogPanel>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar hasNavigation={hasNavigation} />
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" id="main">
          <div className="mx-auto flex min-h-full w-full max-w-[1920px] flex-col px-4 pt-1 pb-8 lg:px-6">
            <ErrorBoundary>
              <Suspense fallback={<PageSpinner />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
