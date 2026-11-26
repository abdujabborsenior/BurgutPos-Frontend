import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Eye, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { reportsApi } from '@/api/analytics.api';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { CategoryReportRow } from '@/api/report-types';
import {
  Button,
  DataTable,
  IconButton,
  Modal,
  Pagination,
  Panel,
  Skeleton,
  StatCard,
  type Column,
} from '@/components/ui';
import { useSettings } from '@/features/pos/usePosData';
import { formatMoney, formatQty } from '@/lib/format';
import { printCategoryDishes } from '@/lib/print';
import { KpiGrid, Pending, ReportEmpty, ReportError, StackedValue } from './components/ReportBits';
import { ReportHeader } from './components/ReportHeader';
import { countOf, formatCount } from './components/report-utils';
import { useClientTable } from './components/useClientTable';
import { useReportScope, type ReportScope } from './scope/useReportScope';

type Target = Pick<CategoryReportRow, 'categoryId' | 'name'>;

/** Dishes of one category for the period (the "eye" action). */
function CategoryDishesModal({
  target,
  scopeParams,
  subtitle,
  onClose,
  onPrint,
  printing,
}: {
  target: Target | null;
  scopeParams: ReportScope['params'];
  subtitle: string;
  onClose: () => void;
  onPrint: (target: Target) => void;
  printing: boolean;
}) {
  const params = { ...scopeParams, categoryId: target?.categoryId ?? undefined };
  const query = useQuery({
    queryKey: qk.report('category-dishes', params),
    queryFn: () => reportsApi.categoryDishes(params),
    enabled: Boolean(target?.categoryId),
  });
  const group = query.data?.categories[0];

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="lg"
      icon={<Eye />}
      title={target?.name ?? ''}
      description={subtitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            leftIcon={<Printer className="size-4" />}
            loading={printing}
            disabled={!group}
            onClick={() => target && onPrint(target)}
          >
            Печать
          </Button>
        </>
      }
    >
      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ReportError error={query.error} onRetry={() => void query.refetch()} />
      ) : !group ? (
        <ReportEmpty title="Нет продаж в категории" />
      ) : (
        <div className="table-frame">
          <table className="table-grid w-full text-sm">
            <thead>
              <tr>
                <th className="w-12 px-4 py-2.5 text-center">№</th>
                <th className="px-4 py-2.5 text-left">Блюдо</th>
                <th className="px-4 py-2.5 text-center">Кол-во</th>
                <th className="px-4 py-2.5 text-center">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {group.dishes.map((dish, index) => (
                <tr key={dish.dishId}>
                  <td className="text-ink-700 tabular px-4 py-2.5 text-center">{index + 1}</td>
                  <td className="text-ink-900 px-4 py-2.5 font-medium">{dish.name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StackedValue
                      value={dish.quantity}
                      pending={dish.pendingQuantity}
                      format={formatQty}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <StackedValue value={dish.revenue} pending={dish.pendingRevenue} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50/60 text-ink-900 font-semibold">
                <td colSpan={2} className="px-4 py-3">
                  Итого
                </td>
                <td className="tabular px-4 py-3 text-center">{formatQty(group.quantity)}</td>
                <td className="tabular px-4 py-3 text-center">{formatMoney(group.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function CategoriesReportPage() {
  const scope = useReportScope();
  const params = scope.params;
  const query = useQuery({
    enabled: scope.ready,
    queryKey: qk.report('categories', params),
    queryFn: () => reportsApi.categories(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = data?.totals;
  const loading = query.isLoading;
  const stale = query.isPlaceholderData;
  const [viewing, setViewing] = useState<Target | null>(null);

  const { data: settings } = useSettings();
  const print = useMutation({
    mutationFn: (categoryId: number | undefined) =>
      reportsApi.categoryDishes({ ...scope.params, categoryId }),
    onSuccess: (report) => {
      if (!report.categories.length) {
        toast.info('За период нет продаж для печати');
        return;
      }
      printCategoryDishes(report.categories, report, settings);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось подготовить печать')),
  });
  const printTarget = (target: Target) => print.mutate(target.categoryId ?? undefined);

  const table = useClientTable(data?.items, {
    sorters: {
      name: (row) => row.name,
      quantity: (row) => row.quantity,
      revenue: (row) => row.revenue,
    },
    defaultSort: { sortBy: 'revenue', sortOrder: 'DESC' },
  });

  const columns: Column<CategoryReportRow>[] = [
    {
      key: 'name',
      header: 'Категория',
      sortKey: 'name',
      cell: (row) => <span className="text-ink-900 font-medium">{row.name}</span>,
    },
    {
      key: 'quantity',
      header: 'Кол-во',
      sortKey: 'quantity',
      cell: (row) => (
        <StackedValue value={row.quantity} pending={row.pendingQuantity} format={formatQty} />
      ),
    },
    {
      key: 'revenue',
      header: 'Выручка',
      sortKey: 'revenue',
      cell: (row) => <StackedValue value={row.revenue} pending={row.pendingRevenue} />,
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
        <div className="flex items-center justify-center gap-0.5">
          <IconButton
            size="sm"
            label="Блюда категории"
            icon={<Eye />}
            disabled={row.categoryId === null}
            onClick={() => setViewing(row)}
          />
          <IconButton
            size="sm"
            label="Печать категории"
            icon={<Printer />}
            disabled={row.categoryId === null}
            loading={print.isPending && print.variables === row.categoryId}
            onClick={() => printTarget(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Отчёт по категориям"
        kind="categories"
        exportParams={params}
        facts={totals && countOf(totals.categoriesCount, ['категория', 'категории', 'категорий'])}
        onPrint={() => print.mutate(undefined)}
        printLabel="Печать всех"
        printing={print.isPending && print.variables === undefined}
        printDisabled={!totals?.categoriesCount}
      />
      {scope.ready && !(query.isError && !data) && (
        <KpiGrid stale={stale} columns={2}>
          <StatCard
            label="Выручка"
            loading={loading}
            value={totals ? formatMoney(totals.revenue) : '—'}
            hint={totals && <Pending value={totals.pendingRevenue} label="Ожидает оплаты" />}
          />
          <StatCard
            label="Категорий"
            loading={loading}
            value={totals ? formatCount(totals.categoriesCount) : '—'}
          />
        </KpiGrid>
      )}
      {scope.card()}
      {!scope.ready ? (
        scope.hint
      ) : (
        <Panel>
          {query.isError && !data ? (
            <ReportError error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div className="flex flex-col gap-4">
              <DataTable
                columns={columns}
                rows={table.rows}
                rowKey={(row) => row.categoryId ?? row.name}
                loading={loading}
                fetching={stale}
                numberedFrom={table.offset}
                sortBy={table.sortBy}
                sortOrder={table.sortOrder}
                onSortChange={table.onSortChange}
                empty={<ReportEmpty title="Нет продаж за период" />}
              />
              <Pagination
                page={table.page}
                limit={table.limit}
                total={table.total}
                onPageChange={table.setPage}
                onLimitChange={table.setLimit}
              />
            </div>
          )}
        </Panel>
      )}
      <CategoryDishesModal
        target={viewing}
        scopeParams={scope.params}
        subtitle={scope.label}
        onClose={() => setViewing(null)}
        onPrint={printTarget}
        printing={print.isPending && print.variables === viewing?.categoryId}
      />
    </div>
  );
}
