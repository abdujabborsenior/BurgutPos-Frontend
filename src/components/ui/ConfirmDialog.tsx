import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary';
  /** Ask for a free-text reason; the promise resolves with it. */
  reason?: { label: string; placeholder?: string; required?: boolean; minLength?: number };
}

type Resolution = { confirmed: boolean; reason: string };

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (result: Resolution) => void }) | null;
  open: (options: ConfirmOptions) => Promise<Resolution>;
  close: (result: Resolution) => void;
}

const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  open: (options) =>
    new Promise<Resolution>((resolve) => {
      get().request?.resolve({ confirmed: false, reason: '' });
      set({ request: { ...options, resolve } });
    }),
  close: (result) => {
    get().request?.resolve(result);
    set({ request: null });
  },
}));

/**
 * Imperative confirmation: `if (await confirm({ title })) …`.
 * With `reason`, resolves to the entered text (or null when cancelled).
 */
export function useConfirm() {
  const open = useConfirmStore((state) => state.open);
  return async (options: ConfirmOptions): Promise<boolean> => (await open(options)).confirmed;
}

export function usePrompt() {
  const open = useConfirmStore((state) => state.open);
  return async (options: ConfirmOptions & { reason: NonNullable<ConfirmOptions['reason']> }) => {
    const result = await open(options);
    return result.confirmed ? result.reason : null;
  };
}

export function ConfirmHost() {
  const request = useConfirmStore((state) => state.request);
  const close = useConfirmStore((state) => state.close);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const minLength = request?.reason?.minLength ?? (request?.reason?.required ? 1 : 0);
  const invalid = Boolean(request?.reason) && reason.trim().length < minLength;
  const danger = request?.tone === 'danger';

  const finish = (confirmed: boolean) => {
    if (confirmed && invalid) {
      setTouched(true);
      return;
    }
    close({ confirmed, reason: reason.trim() });
    setReason('');
    setTouched(false);
  };

  return (
    <Modal
      open={Boolean(request)}
      onClose={() => finish(false)}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => finish(false)}>
            {request?.cancelText ?? 'Отмена'}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => finish(true)}>
            {request?.confirmText ?? 'Подтвердить'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl',
            danger ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-800',
          )}
        >
          {danger ? <AlertTriangle className="size-5" /> : <HelpCircle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-base font-semibold text-ink-900">{request?.title}</h3>
          {request?.description && <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{request.description}</p>}
          {request?.reason && (
            <Textarea
              containerClassName="mt-4"
              label={request.reason.label}
              placeholder={request.reason.placeholder}
              required={request.reason.required}
              value={reason}
              autoFocus
              rows={3}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              error={
                touched && invalid
                  ? minLength > 1
                    ? `Минимум ${minLength} символа`
                    : 'Заполните поле'
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
