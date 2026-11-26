import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { settingsApi } from '@/api/settings.api';
import type { OrderType, Settings } from '@/api/types';
import { Button, Field, Input, Panel, Skeleton, useConfirm } from '@/components/ui';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { renderOrderCheck } from '@/lib/receipt/render';
import { useCan } from '@/stores/auth.store';
import { ReceiptDesigner, type PreviewTab } from './receipt/ReceiptDesigner';
import { sampleOrder } from './receipt/sample';

const TABS: PreviewTab<OrderType>[] = [
  { value: 'TABLE', label: 'Столы' },
  { value: 'TAKEAWAY', label: 'С собой' },
  { value: 'DELIVERY', label: 'Доставка' },
  { value: 'HALL', label: 'Зал' },
];

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Venue block of the bill: the name on top and the logo above it. */
function VenueCard({ settings }: { settings: Settings | undefined }) {
  const canManage = useCan(Permission.SettingsManage);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const value = name ?? settings?.restaurantName ?? '';
  const dirty = name !== null && name !== settings?.restaurantName;

  const store = (updated: Settings) => {
    queryClient.setQueryData(qk.settings, updated);
    invalidateScopes('settings');
  };

  const saveName = useMutation({
    mutationFn: (restaurantName: string) => settingsApi.update({ restaurantName }),
    onSuccess: (updated) => {
      store(updated);
      setName(null);
      toast.success('Название сохранено');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const logo = useMutation({
    mutationFn: (file: File | null) =>
      file ? settingsApi.uploadLogo(file) : settingsApi.removeLogo(),
    onSuccess: (updated, file) => {
      store(updated);
      toast.success(file ? 'Логотип загружен' : 'Логотип удалён');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Не удалось сохранить логотип')),
  });

  if (!settings) {
    return (
      <Panel>
        <Skeleton className="h-28 w-full" />
      </Panel>
    );
  }

  return (
    <Panel className="flex flex-col gap-4">
      <Field label="Название ресторана" hint="Печатается первой строкой, если строка включена ниже">
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            value={value}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            disabled={!canManage || saveName.isPending}
            containerClassName="min-w-0 flex-1"
            placeholder="Например: Burgut"
          />
          {dirty && (
            <Button onClick={() => saveName.mutate(value.trim())} loading={saveName.isPending}>
              Сохранить
            </Button>
          )}
        </div>
      </Field>

      <Field
        label="Логотип"
        hint="PNG, JPG или WebP до 5 МБ. Печатается чёрно-белым, поэтому лучше контрастный."
      >
        <div className="flex flex-wrap items-center gap-3">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Логотип"
              className="border-ink-150 h-16 w-28 rounded-lg border bg-white object-contain p-1"
            />
          )}
          {canManage && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_TYPES}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) logo.mutate(file);
                }}
              />
              <Button
                variant="secondary"
                leftIcon={<ImagePlus className="size-4" />}
                loading={logo.isPending && logo.variables !== null}
                onClick={() => fileInput.current?.click()}
              >
                {settings.logoUrl ? 'Заменить' : 'Загрузить'}
              </Button>
              {settings.logoUrl && (
                <Button
                  variant="ghost"
                  leftIcon={<Trash2 className="size-4" />}
                  loading={logo.isPending && logo.variables === null}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Удалить логотип?',
                      description: 'Чеки будут печататься без него.',
                      confirmText: 'Удалить',
                      tone: 'danger',
                    });
                    if (ok) logo.mutate(null);
                  }}
                >
                  Удалить
                </Button>
              )}
            </>
          )}
        </div>
      </Field>
    </Panel>
  );
}

/** Чек стола: what the guest bill shows and how. */
export default function OrderCheckPage() {
  const settingsQuery = useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });

  return (
    <ReceiptDesigner
      kind="orderCheck"
      title="Чек стола"
      description="Что отображать на чеке стола"
      tabs={TABS}
      before={<VenueCard settings={settingsQuery.data} />}
      renderPreview={(layout, type, settings) =>
        renderOrderCheck({
          order: sampleOrder(type),
          // The draft being edited, not what is saved.
          settings: { ...settings, orderCheck: layout },
          variant: 'bill',
          printedBy: 'Озода',
          // The moment it would be printed, as on paper.
          now: new Date(),
        })
      }
    />
  );
}
