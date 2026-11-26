import { AlertOctagon } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken widget never blanks the whole POS. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <AlertOctagon className="size-7" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {chunkError ? 'Доступна новая версия приложения' : 'Что-то пошло не так'}
          </h2>
          <p className="mt-1 max-w-md text-sm text-ink-500">
            {chunkError
              ? 'Обновите страницу, чтобы загрузить актуальную версию.'
              : 'Произошла непредвиденная ошибка интерфейса. Данные не потеряны — обновите страницу.'}
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Обновить страницу</Button>
      </div>
    );
  }
}
