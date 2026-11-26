import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { settingsApi } from '@/api/settings.api';
import type {
  ReceiptKind,
  ReceiptLayout,
  ReceiptLineSpec,
  ReceiptLineStyle,
  Settings,
} from '@/api/types';
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Segmented,
  Select,
  Skeleton,
  Switch,
  type SelectOption,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { Permission } from '@/lib/permissions';
import {
  FONT_LABELS,
  RECEIPT_SIZES,
  WEIGHT_LABELS,
  type ReceiptFont,
  type ReceiptWeight,
} from '@/lib/receipt/layout';
import { invalidateScopes } from '@/lib/realtime';
import { useCan } from '@/stores/auth.store';
import { ReceiptPreview } from './ReceiptPreview';

const FONT_OPTIONS: SelectOption<ReceiptFont>[] = (['SANS', 'MONO'] as const).map((value) => ({
  value,
  label: FONT_LABELS[value],
}));
const WEIGHT_OPTIONS: SelectOption<ReceiptWeight>[] = (['BOLD', 'NORMAL'] as const).map(
  (value) => ({
    value,
    label: WEIGHT_LABELS[value],
  }),
);
const SIZE_OPTIONS: SelectOption<number>[] = RECEIPT_SIZES.map((value) => ({
  value,
  label: String(value),
}));

function LineRow({
  spec,
  style,
  disabled,
  onChange,
}: {
  spec: ReceiptLineSpec;
  style: ReceiptLineStyle;
  disabled: boolean;
  onChange: (next: ReceiptLineStyle) => void;
}) {
  const off = spec.toggleable && !style.enabled;
  const set = <K extends keyof ReceiptLineStyle>(key: K, value: ReceiptLineStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <div className="border-ink-100 flex flex-wrap items-center gap-3 border-b px-1 py-3 last:border-b-0 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {spec.toggleable ? (
          <Switch
            checked={style.enabled}
            onChange={(checked) => set('enabled', checked)}
            disabled={disabled}
            label=""
            aria-label={spec.label}
          />
        ) : (
          // A line that is always printed keeps the column aligned.
          <span className="w-9 shrink-0" aria-hidden />
        )}
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-medium', off ? 'text-ink-400' : 'text-ink-900')}>
            {spec.label}
          </p>
          {spec.hint && <p className="text-ink-500 truncate text-xs">{spec.hint}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Select
          size="sm"
          value={style.font}
          onChange={(value) => set('font', value)}
          options={FONT_OPTIONS}
          disabled={disabled || off}
          buttonClassName="w-[172px]"
          aria-label={`${spec.label}: шрифт`}
        />
        <Select
          size="sm"
          value={style.weight}
          onChange={(value) => set('weight', value)}
          options={WEIGHT_OPTIONS}
          disabled={disabled || off}
          buttonClassName="w-[118px]"
          aria-label={`${spec.label}: начертание`}
        />
        <Select
          size="sm"
          value={style.size}
          onChange={(value) => set('size', value)}
          options={SIZE_OPTIONS}
          disabled={disabled || off}
          buttonClassName="w-[76px]"
          aria-label={`${spec.label}: размер`}
        />
      </div>
    </div>
  );
}

export interface PreviewTab<T extends string> {
  value: T;
  label: string;
}

/**
 * Editor of one printed document: which lines it shows and how, with a live
 * preview drawn by the very same renderer the printer uses.
 */
export function ReceiptDesigner<T extends string>({
  kind,
  title,
  description,
  tabs,
  renderPreview,
  before,
}: {
  kind: ReceiptKind;
  title: string;
  description: string;
  tabs: PreviewTab<T>[];
  /** Receipt HTML for the chosen tab and the layout being edited. */
  renderPreview: (layout: ReceiptLayout, tab: T, settings: Settings) => string;
  /** Extra card above the lines (the bill puts the venue block there). */
  before?: ReactNode;
}) {
  const canManage = useCan(Permission.SettingsManage);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<T>(tabs[0].value);
  const [draft, setDraft] = useState<ReceiptLayout | null>(null);

  const settingsQuery = useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });
  const catalogQuery = useQuery({
    queryKey: qk.receiptLines,
    queryFn: settingsApi.receiptLines,
    staleTime: Infinity,
  });
  const settings = settingsQuery.data;
  const specs = catalogQuery.data?.[kind];
  const saved = settings?.[kind];
  const layout = draft ?? saved;
  const dirty =
    draft !== null && saved !== undefined && JSON.stringify(draft) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: (next: ReceiptLayout) => settingsApi.update({ [kind]: next }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.settings, updated);
      setDraft(null);
      toast.success('Настройки чека сохранены');
      invalidateScopes('settings');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (settingsQuery.isError || catalogQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} subtitle={description} />
        <Panel>
          <EmptyState
            title="Не удалось загрузить настройки"
            description={getErrorMessage(settingsQuery.error ?? catalogQuery.error)}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  void settingsQuery.refetch();
                  void catalogQuery.refetch();
                }}
              >
                Повторить
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} subtitle={description} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {before}
          <Panel>
            {!layout || !specs ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-col">
                  {specs.map((spec) => (
                    <LineRow
                      key={spec.key}
                      spec={spec}
                      style={layout[spec.key] ?? spec.default}
                      disabled={!canManage || save.isPending}
                      onChange={(next) => setDraft({ ...layout, [spec.key]: next })}
                    />
                  ))}
                </div>
                {canManage && (
                  <div className="mt-4 flex items-center justify-end gap-2.5">
                    {dirty && (
                      <Button
                        variant="ghost"
                        onClick={() => setDraft(null)}
                        disabled={save.isPending}
                      >
                        Отменить
                      </Button>
                    )}
                    <Button
                      onClick={() => save.mutate(layout)}
                      loading={save.isPending}
                      disabled={!dirty}
                    >
                      Сохранить
                    </Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        <Panel className="flex h-fit flex-col gap-3 xl:sticky xl:top-4">
          <h2 className="text-ink-900 text-[15px] font-semibold">Предпросмотр</h2>
          <Segmented size="sm" variant="track" value={tab} onChange={setTab} items={tabs} />
          {layout && settings ? (
            <ReceiptPreview
              html={renderPreview(layout, tab, settings)}
              className="border-ink-150 block min-h-40 w-full rounded-xl border bg-white"
            />
          ) : (
            <Skeleton className="h-80 w-full rounded-xl" />
          )}
        </Panel>
      </div>
    </div>
  );
}
