import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlState, Field } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

const HEIGHTS = { sm: 'h-8 text-[13px]', md: 'h-10', lg: 'h-12 text-[15px]' } as const;

export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightSlot,
  inputSize = 'md',
  className,
  containerClassName,
  required,
  id,
  ref,
  ...props
}: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const control = (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400 [&_svg]:size-4">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          controlState(Boolean(error)),
          HEIGHTS[inputSize],
          leftIcon ? 'pl-9' : 'pl-3.5',
          rightSlot ? 'pr-10' : 'pr-3.5',
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">{rightSlot}</span>
      )}
    </div>
  );
  if (!label && !hint && !error) return <div className={containerClassName}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      {control}
    </Field>
  );
}
