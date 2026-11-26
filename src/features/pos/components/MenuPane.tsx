import { Search, UtensilsCrossed } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PosDish, PosMenuCategory } from '@/api/types';
import { EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DISH_UNIT_LABELS } from '@/lib/labels';
import { formatMoney, formatQty } from '@/lib/format';

function DishTile({
  dish,
  inCart,
  allowNegative,
  onPick,
}: {
  dish: PosDish;
  inCart: number;
  allowNegative: boolean;
  onPick: (dish: PosDish) => void;
}) {
  const left = dish.trackStock ? dish.saleQty - inCart : Infinity;
  const soldOut = dish.trackStock && left <= 0 && !allowNegative;
  const disabled = !dish.isAvailable || soldOut;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(dish)}
      className={cn(
        'group relative flex min-h-[112px] flex-col rounded-2xl border bg-white p-3 text-left shadow-card transition-all duration-150',
        disabled
          ? 'cursor-not-allowed border-ink-150 opacity-55'
          : 'border-ink-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-raised active:translate-y-0',
        inCart > 0 && 'border-brand-300 ring-1 ring-brand-300',
      )}
    >
      {dish.imageUrl && (
        <img
          src={dish.imageUrl}
          alt=""
          loading="lazy"
          className="mb-2 aspect-[16/10] w-full rounded-xl bg-ink-100 object-cover"
        />
      )}
      <span className="line-clamp-2 min-h-[38px] text-[13.5px] leading-snug font-semibold text-ink-900">{dish.name}</span>
      <span className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-[15px] font-bold text-brand-900 tabular">
          {formatMoney(dish.price)}
          {dish.unit !== 'PCS' && <span className="ml-1 text-[11px] font-medium text-ink-500">/ {DISH_UNIT_LABELS[dish.unit]}</span>}
        </span>
        {!dish.isAvailable ? (
          <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">Нет в наличии</span>
        ) : dish.trackStock ? (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular',
              left <= 0 ? 'bg-danger-50 text-danger-700' : left <= 5 ? 'bg-warning-50 text-warning-700' : 'bg-ink-100 text-ink-600',
            )}
          >
            {formatQty(Math.max(left, 0))} {DISH_UNIT_LABELS[dish.unit]}
          </span>
        ) : null}
      </span>
      {inCart > 0 && (
        <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-900 px-1.5 text-[11px] font-bold text-white ring-2 ring-white tabular">
          {formatQty(inCart)}
        </span>
      )}
    </button>
  );
}

export function MenuPane({
  categories,
  loading,
  cartQuantities,
  allowNegative,
  onPick,
  disabled,
}: {
  categories: PosMenuCategory[] | undefined;
  loading: boolean;
  cartQuantities: Map<number, number>;
  allowNegative: boolean;
  onPick: (dish: PosDish) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box, like in most POS terminals.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dishes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source =
      active === 'all' || needle ? (categories ?? []).flatMap((category) => category.dishes) : (categories?.find((c) => c.id === active)?.dishes ?? []);
    return needle ? source.filter((dish) => dish.name.toLowerCase().includes(needle)) : source;
  }, [categories, active, search]);

  return (
    <section className="flex min-h-[420px] min-w-0 flex-1 flex-col rounded-2xl border border-ink-150/80 bg-white shadow-card lg:min-h-0">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск блюда  ( / )"
            className="h-11 w-full rounded-xl border border-ink-200 bg-ink-25 pr-3 pl-10 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/12 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {[{ id: 'all' as const, name: 'Все' }, ...(categories ?? [])].map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setActive(category.id);
                setSearch('');
              }}
              className={cn(
                'h-9 shrink-0 rounded-xl border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
                active === category.id && !search
                  ? 'border-brand-900 bg-brand-900 text-white'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-900',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin', disabled && 'pointer-events-none opacity-50')}>
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-[112px] rounded-2xl" />
            ))}
          </div>
        ) : dishes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed />}
            title={search ? 'Ничего не найдено' : 'В категории нет блюд'}
            description={search ? 'Попробуйте изменить запрос.' : undefined}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {dishes.map((dish) => (
              <DishTile
                key={dish.id}
                dish={dish}
                inCart={cartQuantities.get(dish.id) ?? 0}
                allowNegative={allowNegative}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
