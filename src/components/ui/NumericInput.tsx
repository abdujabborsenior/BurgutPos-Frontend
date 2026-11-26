import { useId, useState, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlState, Field } from './Field';

export interface NumericInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  /** Maximum fraction digits accepted (0 = integers only). */
  decimals?: number;
  /** "132 000" when idle; turn off for codes and ports ("9100", not "9 100"). */
  grouping?: boolean;
  min?: number;
  max?: number;
  suffix?: ReactNode;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  className?: string;
  containerClassName?: string;
  name?: string;
  id?: string;
  align?: 'left' | 'right' | 'center';
  ref?: Ref<HTMLInputElement>;
}

const HEIGHTS = { sm: 'h-8 text-[13px]', md: 'h-10', lg: 'h-12 text-[15px]' } as const;

function format(value: number | null | undefined, decimals: number, grouping: boolean): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: decimals, useGrouping: grouping })
    .format(value)
    .replace(/[\u202f\u00a0]/g, ' ');
}

function parse(text: string): number | null {
  const normalised = text.replace(/\s/g, '').replace(',', '.');
  if (normalised === '' || normalised === '.' || normalised === '-') return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

/**
 * Number field for money and quantities. Shows "132 000" when idle and the
 * raw value while editing; accepts both "," and "." as decimal separator.
 */
export function NumericInput({
  value,
  onChange,
  onBlur,
  decimals = 0,
  grouping = true,
  min,
  max,
  suffix,
  label,
  hint,
  error,
  placeholder,
  required,
  disabled,
  autoFocus,
  inputSize = 'md',
  className,
  containerClassName,
  name,
  id,
  align = 'left',
  ref,
}: NumericInputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  // While idle the field mirrors the value; while editing it shows the raw text.
  const display = focused ? text : format(value, decimals, grouping);

  const pattern = decimals > 0 ? new RegExp(`^-?\\d*(?:[.,]\\d{0,${decimals}})?$`) : /^-?\d*$/;

  const control = (
    <div className="relative">
      <input
        ref={ref}
        id={inputId}
        name={name}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        value={display}
        onFocus={(event) => {
          setFocused(true);
          setText(value === null || value === undefined ? '' : String(value).replace('.', ','));
          requestAnimationFrame(() => event.target.select());
        }}
        onBlur={() => {
          setFocused(false);
          let next = parse(text);
          if (next !== null) {
            if (min !== undefined && next < min) next = min;
            if (max !== undefined && next > max) next = max;
          }
          if (next !== value) onChange(next);
          onBlur?.();
        }}
        onChange={(event) => {
          const raw = event.target.value.replace(/\s/g, '');
          if (!pattern.test(raw)) return;
          if (min !== undefined && min >= 0 && raw.startsWith('-')) return;
          setText(raw);
          onChange(parse(raw));
        }}
        className={cn(
          controlBase,
          controlState(Boolean(error)),
          HEIGHTS[inputSize],
          'tabular px-3.5',
          suffix ? 'pr-12' : '',
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
          className,
        )}
      />
      {suffix && (
        <span className="text-ink-400 pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-medium">
          {suffix}
        </span>
      )}
    </div>
  );

  if (!label && !hint && !error) return <div className={containerClassName}>{control}</div>;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      {control}
    </Field>
  );
}
