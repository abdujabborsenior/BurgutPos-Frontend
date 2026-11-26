import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlState } from './Field';

/** Search box with built-in debounce; emits trimmed text. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск',
  delay = 300,
  className,
  autoFocus,
  size = 'md',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  autoFocus?: boolean;
  size?: 'sm' | 'md';
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // External value changed (e.g. back navigation): adopt it.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const emit = (next: string, immediate = false) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    const fire = () => {
      setSynced(next.trim());
      onChangeRef.current(next.trim());
    };
    if (immediate) fire();
    else timer.current = setTimeout(fire, delay);
  };

  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => emit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') emit(text, true);
          if (event.key === 'Escape' && text) emit('', true);
        }}
        className={cn(
          controlBase,
          controlState(false),
          size === 'sm' ? 'h-8 text-[13px]' : 'h-10',
          'pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {text && (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => emit('', true)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
