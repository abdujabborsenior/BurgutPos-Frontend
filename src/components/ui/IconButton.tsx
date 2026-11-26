import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'plain' | 'outline' | 'ghost' | 'danger' | 'brand' | 'solid';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  plain: 'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
  outline:
    'border border-ink-200 bg-white text-ink-600 shadow-[0_1px_2px_rgb(18_16_72/0.05)] hover:border-ink-300 hover:text-ink-900',
  ghost: 'text-ink-500 hover:bg-white hover:text-ink-900 hover:shadow-card',
  danger: 'text-danger-600 hover:bg-danger-50 hover:text-danger-700',
  brand: 'text-brand-700 hover:bg-brand-50 hover:text-brand-900',
  solid: 'bg-brand-900 text-white hover:bg-brand-800',
};

const SIZES: Record<Size, string> = {
  xs: 'h-7 w-7 rounded-md [&_svg]:size-3.5',
  sm: 'h-8 w-8 rounded-lg [&_svg]:size-4',
  md: 'h-10 w-10 rounded-xl [&_svg]:size-[18px]',
  lg: 'h-12 w-12 rounded-xl [&_svg]:size-5',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  round?: boolean;
  loading?: boolean;
  badge?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Icon-only button. `label` is mandatory: it becomes aria-label and the tooltip. */
export function IconButton({
  label,
  icon,
  variant = 'plain',
  size = 'md',
  round,
  loading,
  badge,
  className,
  disabled,
  type = 'button',
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        round && 'rounded-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={16} /> : icon}
      {badge !== undefined && badge !== null && badge !== false && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-900 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
          {badge}
        </span>
      )}
    </button>
  );
}
