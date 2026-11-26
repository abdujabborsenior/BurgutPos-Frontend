import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { rolesApi } from '@/api/team.api';
import type { RoleView } from '@/api/types';
import { Button, Input, Modal, Skeleton } from '@/components/ui';
import { Permission } from '@/lib/permissions';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth.store';
import { PermissionMatrix } from './PermissionMatrix';
import { catalogKeys, effectivePermissions } from './permissions';
import { refreshOwnProfile } from './profile';

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название роли').max(64, 'Не более 64 символов'),
  description: z.string().trim().max(255, 'Не более 255 символов'),
  permissions: z.array(z.custom<Permission>()).min(1, 'Выберите хотя бы одно право доступа'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', description: '', permissions: [] };

export function RoleFormModal({
  open,
  role,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  role: RoleView | null;
  onClose: () => void;
}) {
  const me = useAuthStore((state) => state.user);
  const catalogQuery = useQuery({
    queryKey: qk.permissionCatalog,
    queryFn: rolesApi.permissions,
    staleTime: Infinity,
  });
  const catalog = catalogQuery.data;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) {
      form.reset(
        role ? { name: role.name, description: role.description ?? '', permissions: role.permissions } : EMPTY,
      );
    }
  }, [open, role, form]);

  const selected = useWatch({ control: form.control, name: 'permissions' });
  const effective = effectivePermissions(selected);
  const total = catalog ? catalogKeys(catalog).length : 0;
  const ownRole = Boolean(role && me && !me.isSuperadmin && me.role?.id === role.id);
  const losesTeamAccess = ownRole && !effective.has(Permission.TeamManage);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      // Send the normalised set (selection + implied), in catalog order.
      const granted = effectivePermissions(values.permissions);
      const ordered = catalog ? catalogKeys(catalog).filter((key) => granted.has(key)) : [...granted];
      const input = { name: values.name, description: values.description || null, permissions: ordered };
      return role ? rolesApi.update(role.id, input) : rolesApi.create(input);
    },
    onSuccess: () => {
      toast.success(role ? 'Роль сохранена' : 'Роль создана');
      invalidateScopes('team');
      if (ownRole) void refreshOwnProfile();
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const { errors } = form.formState;
  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={mutation.isPending}
      size="xl"
      icon={<ShieldCheck />}
      title={role ? 'Редактирование роли' : 'Новая роль'}
      description="Роль определяет, какие разделы и действия доступны сотрудникам."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="role-form" loading={mutation.isPending} disabled={!catalog}>
            {role ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="role-form"
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Input
            label="Название"
            required
            autoFocus
            maxLength={64}
            placeholder="Например: Старший кассир"
            error={errors.name?.message}
            {...form.register('name')}
          />
          <Input
            label="Описание"
            maxLength={255}
            placeholder="За что отвечают сотрудники с этой ролью"
            error={errors.description?.message}
            {...form.register('description')}
          />
        </div>

        {losesTeamAccess && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] leading-relaxed text-warning-700"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Это ваша роль. Без права «Управление командой» вы сразу после сохранения потеряете возможность изменять
              сотрудников и роли.
            </p>
          </div>
        )}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-ink-900">Права доступа</h4>
              <p className="mt-0.5 text-xs text-ink-500">
                Просмотр включается автоматически вместе с управлением, доступ к кассе — с любым действием над
                заказами.
              </p>
            </div>
            {catalog && (
              <span className="text-xs font-medium text-ink-600 tabular">
                Выбрано {effective.size} из {total}
              </span>
            )}
          </div>
          {errors.permissions?.message && (
            <p role="alert" className="mb-3 text-xs font-medium text-danger-600">
              {errors.permissions.message}
            </p>
          )}
          {catalog ? (
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <PermissionMatrix catalog={catalog} value={field.value} onChange={field.onChange} />
              )}
            />
          ) : catalogQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-ink-150 px-4 py-8 text-center">
              <p className="text-sm text-ink-600">{getErrorMessage(catalogQuery.error, 'Не удалось загрузить права доступа')}</p>
              <Button size="sm" variant="secondary" onClick={() => void catalogQuery.refetch()}>
                Повторить
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-40 rounded-xl" />
              ))}
            </div>
          )}
        </section>
      </form>
    </Modal>
  );
}
