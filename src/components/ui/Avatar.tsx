import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Avatar({ name, size = 'md', className }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-950 font-semibold text-white ring-2 ring-white',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-9 text-[13px]',
        size === 'lg' && 'size-12 text-base',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
