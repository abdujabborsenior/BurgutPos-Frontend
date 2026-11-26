import { useMutation, useQuery } from '@tanstack/react-query';
import { ArchiveRestore, FileText, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { printersApi, settingsApi } from '@/api/settings.api';
import type { ArchiveStatus, PrinterView } from '@/api/types';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  Toolbar,
  useConfirm,
  type Column,
} from '@/components/ui';
import { useListState } from '@/hooks/useListState';
import { printTestTicket } from '@/lib/print';
import { invalidateScopes } from '@/lib/realtime';
import { PrinterFormModal } from './PrinterFormModal';

type PrinterAction = 'archive' | 'restore' | 'delete';

/** Row actions read as in the reference: dark icons, colour only on hover. */
const ACTION_ICON = 'text-ink-700 hover:bg-brand-50 hover:text-brand-700';
const DANGER_ICON = 'text-ink-700 hover:bg-danger-50 hover:text-danger-600';

const SUCCESS: Record<PrinterAction, string> = {
  archive: 'Принтер удалён — он в архиве',
  restore: 'Принтер восстановлен',
  delete: 'Принтер удалён',
};

/**
 * Printers of the venue. A network (LAN) printer gets its paper from the
 * server at IP:port; a USB one is attached to a terminal and prints through
 * that terminal's browser. The default printer takes bills, receipts,
 * reports and dishes without their own printer.
 */
export default function PrintersPage() {
  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });
  const list = useListState({ filters: { status: 'active' } });
  const status = list.filters.status as ArchiveStatus;
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PrinterView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Small unpaginated catalog: load it whole, filter locally and get the counts for free.
  const query = useQuery({ queryKey: qk.printers('all'), queryFn: () => printersApi.list('all') });
  const printers = query.data;
  const counts = printers && {
    active: printers.filter((printer) => printer.isActive).length,
    archived: printers.filter((printer) => !printer.isActive).length,
  };
  const search = list.search.trim().toLowerCase();
  const rows = printers?.filter(
    (printer) =>
      (status === 'all' || printer.isActive === (status === 'active')) &&
      (!search ||
        printer.name.toLowerCase().includes(search) ||
        (printer.host ?? '').includes(search) ||
        printer.connection.toLowerCase().includes(search)),
  );

  const action = useMutation({
    mutationFn: async ({ kind, printer }: { kind: PrinterAction; printer: PrinterView }) => {
      if (kind === 'delete') await printersApi.remove(printer.id);
      else await printersApi.update(printer.id, { isActive: kind === 'restore' });
    },
    onSuccess: (_, { kind }) => {
      toast.success(SUCCESS[kind]);
      invalidateScopes('printers', 'menu');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openForm = (printer: PrinterView | null) => {
    setEditing(printer);
    setFormOpen(true);
  };

  /** Prints the test ticket on that very printer (USB — through this browser). */
  const testPrint = async (printer: PrinterView) => {
    setTestingId(printer.id);
    try {
      if (await printTestTicket(printer, settings))
        toast.success(`Пробный талон отправлен на «${printer.name}»`);
    } finally {
      setTestingId(null);
    }
  };

  const askArchive = async (printer: PrinterView) => {
    const ok = await confirm({
      title: `Удалить принтер «${printer.name}»?`,
      description:
        printer.dishesCount > 0
          ? `Принтер назначен блюдам (${printer.dishesCount}): их бегунки пойдут на принтер по умолчанию, пока вы не назначите другой. Принтер перейдёт в архив, его можно восстановить.`
          : 'Принтер перейдёт в архив и пропадёт из выбора в карточке блюда. Его можно восстановить в любой момент.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'archive', printer });
  };

  const askDelete = async (printer: PrinterView) => {
    const ok = await confirm({
      title: `Удалить принтер «${printer.name}» навсегда?`,
      description:
        'Удалить можно только принтер, не назначенный ни одному блюду, в том числе архивному. Действие необратимо.',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (ok) action.mutate({ kind: 'delete', printer });
  };

  const columns: Column<PrinterView>[] = [
    {
      key: 'name',
      header: 'Принтер',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <Printer className="text-ink-500 size-4 shrink-0" />
          <span className="text-ink-900 font-semibold">{row.name}</span>
        </span>
      ),
    },
    {
      key: 'connection',
      header: 'Тип',
      cell: (row) => (
        <Badge size="sm" tone={row.connection === 'USB' ? 'neutral' : 'brand'}>
          {row.connection}
        </Badge>
      ),
    },
    {
      key: 'address',
      header: 'IP : Port',
      cell: (row) =>
        row.connection === 'USB' ? (
          <span className="text-ink-700">USB</span>
        ) : row.host ? (
          <span className="text-ink-800 tabular whitespace-nowrap">
            {row.host}:{row.port ?? 9100}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'isDefault',
      header: 'По умолчанию',
      cell: (row) =>
        row.isDefault ? (
          <Badge size="sm" tone="brand">
            Да
          </Badge>
        ) : null,
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (row) => (
        <div className="flex items-center justify-center gap-1">
          {row.isActive && (
            <IconButton
              label="Тестовая печать"
              title="Напечатать пробный талон на этот принтер"
              icon={<FileText />}
              size="sm"
              className={ACTION_ICON}
              loading={testingId === row.id}
              onClick={() => void testPrint(row)}
            />
          )}
          <IconButton
            label="Редактировать"
            icon={<Pencil />}
            size="sm"
            className={ACTION_ICON}
            onClick={() => openForm(row)}
          />
          {row.isActive ? (
            <IconButton
              label="Удалить"
              icon={<Trash2 />}
              size="sm"
              className={DANGER_ICON}
              onClick={() => void askArchive(row)}
            />
          ) : (
            <>
              <IconButton
                label="Восстановить"
                icon={<ArchiveRestore />}
                size="sm"
                variant="brand"
                onClick={() => action.mutate({ kind: 'restore', printer: row })}
              />
              <IconButton
                label="Удалить навсегда"
                icon={<Trash2 />}
                size="sm"
                className={DANGER_ICON}
                onClick={() => void askDelete(row)}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Принтеры"
        subtitle={counts ? `${counts.active} активных · ${counts.archived} в архиве` : ' '}
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => openForm(null)}>
            Добавить
          </Button>
        }
      />
      <Panel>
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Поиск" />
          <Select
            value={status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'active', label: `Активные${counts ? ` (${counts.active})` : ''}` },
              { value: 'archived', label: `Архив${counts ? ` (${counts.archived})` : ''}` },
              { value: 'all', label: 'Все' },
            ]}
            className="w-44"
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => openForm(row)}
          loading={query.isLoading}
          fetching={query.isFetching}
          numberedFrom={0}
          skeletonRows={4}
          empty={
            printers?.length === 0 ? (
              <EmptyState
                compact
                icon={<Printer />}
                title="Принтеров пока нет"
                description="Добавьте принтеры кассы и кухни и назначьте их блюдам в меню."
              />
            ) : (
              <EmptyState
                compact
                icon={<Printer />}
                title={
                  search
                    ? 'Ничего не найдено'
                    : status === 'archived'
                      ? 'В архиве нет принтеров'
                      : 'Активных принтеров нет'
                }
                description={search ? 'Измените запрос поиска.' : 'Измените фильтр статуса.'}
              />
            )
          }
        />
      </Panel>
      <PrinterFormModal open={formOpen} printer={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
