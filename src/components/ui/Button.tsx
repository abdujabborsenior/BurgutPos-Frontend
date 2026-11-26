import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-soft'
  | 'success'
  | 'brand-soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-900 text-white shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(18_16_72/0.25)] hover:bg-brand-800 active:bg-brand-950 disabled:bg-brand-900/45',
  secondary:
    'border border-ink-200 bg-white text-ink-800 shadow-[0_1px_2px_rgb(18_16_72/0.05)] hover:border-ink-300 hover:bg-ink-25 active:bg-ink-50 disabled:text-ink-400',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-150 disabled:text-ink-400',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-600/45',
  'danger-soft':
    'bg-danger-50 text-danger-700 hover:bg-danger-100 active:bg-danger-100 disabled:text-danger-700/50',
  success: 'bg-success-600 text-white hover:bg-success-700 disabled:bg-success-600/45',
  'brand-soft': 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-100 disabled:text-brand-800/50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
  xl: 'h-14 gap-2.5 rounded-2xl px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed [&_svg]:shrink-0',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
