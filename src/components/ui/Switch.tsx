import { Checkbox as HCheckbox, Switch as HSwitch } from '@headlessui/react';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}) {
  const toggle = (
    <HSwitch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'group relative inline-flex shrink-0 cursor-pointer rounded-full bg-ink-200 p-0.5 transition-colors duration-200 data-checked:bg-brand-800 data-disabled:cursor-not-allowed data-disabled:opacity-45',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
      )}
    >
      <span
        className={cn(
          'rounded-full bg-white shadow-[0_1px_3px_rgb(18_16_72/0.3)] transition-transform duration-200',
          size === 'sm' ? 'size-4 group-data-checked:translate-x-4' : 'size-5 group-data-checked:translate-x-5',
        )}
      />
    </HSwitch>
  );
  if (!label) return <span className={className}>{toggle}</span>;
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed', className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
      {toggle}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
      <HCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="group mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-ink-300 bg-white transition-colors data-checked:border-brand-800 data-checked:bg-brand-800 data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-brand-500"
      >
        <Check className="size-3 text-white opacity-0 group-data-checked:opacity-100" strokeWidth={3} />
      </HCheckbox>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-ink-800">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
        </span>
      )}
    </label>
  );
}
