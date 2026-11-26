import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { ConfirmHost } from '@/components/ui';
import { bootstrapSession } from '@/features/auth/session';
import { queryClient } from './query-client';
import { router } from './router';

let bootstrapped = false;

export function App() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void bootstrapSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ConfirmHost />
      <Toaster
        position="top-right"
        offset={{ top: 84, right: 24 }}
        closeButton
        toastOptions={{
          classNames: {
            toast:
              '!rounded-2xl !border !border-ink-150 !bg-white !shadow-pop !text-ink-900 !font-sans !text-[13.5px]',
            description: '!text-ink-500',
            success: '[&_[data-icon]]:!text-success-600',
            error: '[&_[data-icon]]:!text-danger-600',
            warning: '[&_[data-icon]]:!text-warning-600',
          },
        }}
      />
    </QueryClientProvider>
  );
}
