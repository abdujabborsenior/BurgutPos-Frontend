import type { ReactNode } from 'react';
import { Panel, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

export interface AmountRow {
  key: string | number;
  label: ReactNode;
  value: number;
  /** Small muted note next to the label (an order count). */
  note?: ReactNode;
  tone?: 'danger';
}

/**
 * Card of labelled amounts (payment methods, order types) with an optional
 * "Итого" and "Ожидает оплаты" footer — the blocks of the reference reports.
 */
export function AmountCard({
  title,
  rows,
  total,
  pending,
  loading,
  className,
}: {
  title: string;
  rows: AmountRow[] | undefined;
  total?: number;
  pending?: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <h2 className="text-ink-900 text-[15px] font-semibold">{title}</h2>
      {loading || !rows ? (
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <>
          <dl className="divide-ink-100 mt-2 flex-1 divide-y">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-ink-700 min-w-0 truncate">
                  {row.label}
                  {row.note !== undefined && (
                    <span className="text-ink-400 ml-1.5 text-xs">{row.note}</span>
                  )}
                </dt>
                <dd
                  className={cn(
                    'tabular shrink-0 font-medium',
                    row.tone === 'danger' && row.value > 0 ? 'text-danger-700' : 'text-ink-900',
                  )}
                >
                  {formatMoney(row.value)}
                </dd>
              </div>
            ))}
          </dl>
          {total !== undefined && (
            <div className="border-ink-200 mt-1 flex items-center justify-between gap-4 border-t pt-3">
              <span className="text-ink-900 text-[15px] font-semibold">Итого</span>
              <span className="text-ink-900 tabular text-[17px] font-bold">
                {formatMoney(total)}
              </span>
            </div>
          )}
          {pending !== undefined && (
            <div className="text-warning-600 mt-1.5 flex items-center justify-between gap-4">
              <span className="text-[15px] font-semibold">Ожидает оплаты</span>
              <span className="tabular text-[15px] font-semibold">
                {pending > 0 ? `+${formatMoney(pending)}` : formatMoney(0)}
              </span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** Light ranked list (№ · name · value) used for "Топ блюд" and "Официанты". */
export function RankedList<T>({
  title,
  rows,
  rowKey,
  name,
  columns,
  loading,
  empty = 'Нет данных за период',
}: {
  title: string;
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  name: (row: T) => ReactNode;
  columns: { header: ReactNode; cell: (row: T) => ReactNode; className?: string }[];
  loading?: boolean;
  empty?: string;
}) {
  return (
    <Panel>
      <h2 className="text-ink-900 text-[15px] font-semibold">{title}</h2>
      {loading || !rows ? (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-ink-500 mt-4 text-sm">{empty}</p>
      ) : (
        <div className="table-frame mt-3">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="table-grid w-full text-sm">
              <thead>
                <tr>
                  <th className="w-12 px-3 py-2.5 text-center">№</th>
                  <th className="px-3 py-2.5 text-left">Название</th>
                  {columns.map((column, index) => (
                    <th key={index} className="px-3 py-2.5 text-right whitespace-nowrap">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={rowKey(row)}>
                    <td className="text-ink-700 tabular px-3 py-2.5 text-center">{index + 1}</td>
                    <td className="text-ink-900 px-3 py-2.5 font-medium">{name(row)}</td>
                    {columns.map((column, columnIndex) => (
                      <td
                        key={columnIndex}
                        className={cn(
                          'tabular px-3 py-2.5 text-right whitespace-nowrap',
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
