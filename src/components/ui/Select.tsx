import {
  Combobox as HCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlState, Field } from './Field';

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: ReactNode;
  disabled?: boolean;
}

const HEIGHTS = { sm: 'h-8 text-[13px]', md: 'h-10', lg: 'h-12 text-[15px]' } as const;

const panel =
  'z-[60] w-(--button-width) min-w-52 overflow-auto rounded-xl border border-ink-150 bg-white p-1 shadow-pop [--anchor-gap:6px] [--anchor-max-height:320px] scrollbar-thin focus:outline-none transition duration-100 ease-out data-closed:scale-[0.98] data-closed:opacity-0';

const optionClass =
  'group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-800 select-none data-disabled:cursor-not-allowed data-disabled:opacity-40 data-focus:bg-ink-50 data-selected:font-semibold data-selected:text-brand-900';

export interface SelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Text shown as the value (not greyed like a placeholder) when `value` matches no option. */
  displayLabel?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  buttonClassName?: string;
  icon?: ReactNode;
  /** For a select without a visible label (a toolbar or a table row). */
  'aria-label'?: string;
}

export function Select<T extends string | number | boolean | null>({
  value,
  onChange,
  options,
  placeholder = 'Выберите',
  displayLabel,
  label,
  hint,
  error,
  required,
  disabled,
  size = 'md',
  className,
  buttonClassName,
  icon,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const selected = options.find((option) => option.value === value);
  const control = (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          controlState(Boolean(error)),
          HEIGHTS[size],
          'flex items-center gap-2 pr-2.5 pl-3.5 text-left data-open:border-brand-500 data-open:ring-4 data-open:ring-brand-500/12',
          buttonClassName,
        )}
      >
        {icon && <span className="text-ink-400 [&_svg]:size-4">{icon}</span>}
        <span className={cn('flex-1 truncate', !selected && !displayLabel && 'text-ink-400')}>
          {selected?.label ?? displayLabel ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-400" aria-hidden />
      </ListboxButton>
      <ListboxOptions anchor="bottom start" transition className={panel}>
        {options.map((option) => (
          <ListboxOption
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
            className={optionClass}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{option.label}</span>
              {option.hint && <span className="block truncate text-xs font-normal text-ink-500">{option.hint}</span>}
            </span>
            <Check className="invisible size-4 shrink-0 text-brand-700 group-data-selected:visible" aria-hidden />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
  if (!label && !hint && !error) return <div className={className}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {control}
    </Field>
  );
}

export interface ComboboxProps<T> {
  value: T | null;
  onChange: (value: T | null) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clearable?: boolean;
  className?: string;
  emptyText?: string;
  autoFocus?: boolean;
}

const MAX_VISIBLE = 80;

/** Searchable select. Filters by label (case-insensitive, substring). */
export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Начните вводить…',
  label,
  hint,
  error,
  required,
  disabled,
  size = 'md',
  clearable,
  className,
  emptyText = 'Ничего не найдено',
  autoFocus,
}: ComboboxProps<T>) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
    return list.slice(0, MAX_VISIBLE);
  }, [options, query]);
  const labelOf = (item: T | null) => options.find((option) => option.value === item)?.label ?? '';

  const control = (
    <HCombobox value={value} onChange={onChange} onClose={() => setQuery('')} disabled={disabled} immediate>
      <div className="relative">
        <ComboboxInput
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          displayValue={labelOf}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(controlBase, controlState(Boolean(error)), HEIGHTS[size], 'pr-16 pl-3.5')}
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {clearable && value !== null && !disabled && (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => onChange(null)}
              className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ComboboxButton className="rounded-md p-1 text-ink-400 hover:text-ink-700">
            <ChevronsUpDown className="size-4" />
          </ComboboxButton>
        </div>
      </div>
      <ComboboxOptions anchor="bottom start" transition className={cn(panel, 'w-(--input-width)')}>
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-ink-500">{emptyText}</div>
        ) : (
          filtered.map((option) => (
            <ComboboxOption key={String(option.value)} value={option.value} disabled={option.disabled} className={optionClass}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.hint && <span className="block truncate text-xs font-normal text-ink-500">{option.hint}</span>}
              </span>
              <Check className="invisible size-4 shrink-0 text-brand-700 group-data-selected:visible" aria-hidden />
            </ComboboxOption>
          ))
        )}
      </ComboboxOptions>
    </HCombobox>
  );
  if (!label && !hint && !error) return <div className={className}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {control}
    </Field>
  );
}
