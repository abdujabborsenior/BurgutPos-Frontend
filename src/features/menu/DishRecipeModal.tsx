import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { dishesApi } from '@/api/menu.api';
import { Button, Modal, Skeleton } from '@/components/ui';
import { formatMoney, formatQty } from '@/lib/format';
import { INGREDIENT_UNIT_LABELS } from '@/lib/labels';

/**
 * «<Блюдо> — рецепт»: что списывается со склада при каждой продаже. Окно
 * только показывает — меняется техкарта там же, где всё остальное про блюдо.
 */
export function DishRecipeModal({
  dish,
  onClose,
  onEdit,
}: {
  dish: { id: number; name: string } | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const query = useQuery({
    queryKey: qk.dish(dish?.id ?? 0),
    queryFn: () => dishesApi.get(dish?.id as number),
    enabled: Boolean(dish),
  });
  const lines = query.data?.ingredients ?? [];

  return (
    <Modal
      open={Boolean(dish)}
      onClose={onClose}
      size="md"
      title={dish ? `${dish.name} — рецепт` : 'Рецепт'}
      footer={
        <>
          {onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              Изменить техкарту
            </Button>
          )}
          <Button onClick={onClose}>Закрыть</Button>
        </>
      }
    >
      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : query.isError ? (
        <p className="text-danger-600 py-6 text-center text-sm">{getErrorMessage(query.error)}</p>
      ) : lines.length === 0 ? (
        <p className="text-ink-500 py-6 text-center text-sm">Ингредиенты не привязаны</p>
      ) : (
        <div className="table-frame">
          <table className="table-grid w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left">Ингредиент</th>
                <th className="px-3 py-2.5 text-right">Расход</th>
                <th className="px-3 py-2.5 text-right">Стоимость</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.ingredientId}>
                  <td className="px-3 py-2.5">
                    <span className={line.isActive ? 'text-ink-900' : 'text-ink-400'}>
                      {line.name}
                    </span>
                    {!line.isActive && <span className="text-ink-400 ml-2 text-xs">в архиве</span>}
                  </td>
                  <td className="text-ink-700 tabular px-3 py-2.5 text-right whitespace-nowrap">
                    {formatQty(line.quantity)} {INGREDIENT_UNIT_LABELS[line.unit]}
                  </td>
                  <td className="text-ink-700 tabular px-3 py-2.5 text-right whitespace-nowrap">
                    {formatMoney(line.quantity * line.costPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50/60">
                <td className="text-ink-900 px-3 py-2.5 text-[13px] font-semibold" colSpan={2}>
                  Себестоимость
                </td>
                <td className="text-ink-900 tabular px-3 py-2.5 text-right text-[13px] font-semibold">
                  {formatMoney(query.data?.recipeCost ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
