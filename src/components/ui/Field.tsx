import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, with consistent spacing everywhere. */
export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const controlBase =
  'w-full rounded-xl border bg-white text-sm text-ink-900 shadow-[0_1px_2px_rgb(18_16_72/0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-ink-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

export const controlState = (invalid?: boolean) =>
  invalid
    ? 'border-danger-500 focus:border-danger-500 focus:ring-4 focus:ring-danger-500/12'
    : 'border-ink-200 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12';
