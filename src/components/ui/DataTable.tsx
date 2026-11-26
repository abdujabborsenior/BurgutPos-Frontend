import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SortOrder } from '@/api/types';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Server sort key; makes the header clickable. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  /** Background refetch: dims the rows instead of showing skeletons. */
  fetching?: boolean;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (sortBy: string | undefined, sortOrder: SortOrder | undefined) => void;
  /** Adds a leading "№" column numbered from offset + 1. */
  numberedFrom?: number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  skeletonRows?: number;
  className?: string;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  fetching,
  sortBy,
  sortOrder,
  onSortChange,
  numberedFrom,
  empty,
  onRowClick,
  rowClassName,
  footer,
  skeletonRows = 8,
  className,
}: DataTableProps<T>) {
  const numbered = numberedFrom !== undefined;

  const cycleSort = (key: string) => {
    if (!onSortChange) return;
    if (sortBy !== key) onSortChange(key, 'ASC');
    else if (sortOrder === 'ASC') onSortChange(key, 'DESC');
    else onSortChange(undefined, undefined);
  };

  return (
    <div className={cn('table-frame', className)}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="table-grid w-full min-w-max text-sm">
          <thead>
            <tr>
              {numbered && <th className="w-14 px-4 py-3 text-center">№</th>}
              {columns.map((column) => {
                const align = column.align ?? 'center';
                const active = column.sortKey && sortBy === column.sortKey;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (sortOrder === 'ASC' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'px-4 py-3 whitespace-nowrap',
                      ALIGN[align],
                      column.headerClassName,
                    )}
                  >
                    {column.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(column.sortKey as string)}
                        className={cn(
                          'group hover:text-ink-900 inline-flex items-center gap-1.5 rounded-md transition-colors',
                          JUSTIFY[align],
                          active && 'text-brand-900',
                        )}
                      >
                        {column.header}
                        {active ? (
                          sortOrder === 'ASC' ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="text-ink-400 group-hover:text-ink-600 size-3.5" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            className={cn('transition-opacity duration-150', fetching && !loading && 'opacity-60')}
          >
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={index}>
                    {numbered && (
                      <td className="px-4 py-4">
                        <Skeleton className="mx-auto h-4 w-6" />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-4">
                        <Skeleton
                          className={cn('h-4', column.align === 'left' ? 'w-3/4' : 'mx-auto w-2/3')}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row, index) => (
                  <tr
                    key={rowKey(row)}
                    onClick={
                      onRowClick
                        ? (event) => {
                            // A click that landed on a control inside the row
                            // belongs to that control, not to the row.
                            if (
                              (event.target as HTMLElement).closest(
                                'button, a, input, select, textarea, label',
                              )
                            ) {
                              return;
                            }
                            onRowClick(row);
                          }
                        : undefined
                    }
                    className={cn(
                      'hover:bg-ink-25 transition-colors duration-100',
                      onRowClick && 'cursor-pointer',
                      rowClassName?.(row),
                    )}
                  >
                    {numbered && (
                      <td className="text-ink-700 tabular px-4 py-3.5 text-center text-[13px]">
                        {(numberedFrom ?? 0) + index + 1}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'text-ink-800 px-4 py-3.5',
                          ALIGN[column.align ?? 'center'],
                          column.className,
                        )}
                      >
                        {column.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
          {footer && !loading && rows && rows.length > 0 && (
            <tfoot className="bg-ink-50/60 font-semibold">{footer}</tfoot>
          )}
        </table>
      </div>
      {!loading && rows && rows.length === 0 && (
        <div className="border-ink-200 border-t">
          {empty ?? (
            <EmptyState
              title="Ничего не найдено"
              description="Измените условия поиска или фильтры"
              compact
            />
          )}
        </div>
      )}
    </div>
  );
}
