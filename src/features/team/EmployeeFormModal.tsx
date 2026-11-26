import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import { rolesApi, usersApi } from '@/api/team.api';
import type { UserView } from '@/api/types';
import { Button, IconButton, Input, Modal, Select, Switch } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth.store';
import { refreshOwnProfile } from './profile';

// Same rules as the API (users/dto/user.dto.ts).
const LOGIN_RE = /^[A-Za-z0-9._-]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

const fields = {
  fullName: z.string().trim().min(1, 'Укажите имя сотрудника').max(120, 'Не более 120 символов'),
  login: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа')
    .max(64, 'Не более 64 символов')
    .regex(LOGIN_RE, 'Только латинские буквы, цифры, «.», «-» и «_»'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || PHONE_RE.test(value.replace(/\s+/g, ' ')), 'Некорректный номер телефона'),
  roleId: z
    .number()
    .nullable()
    .refine((value) => value !== null, 'Выберите роль'),
  isActive: z.boolean(),
};

const createSchema = z.object({
  ...fields,
  password: z.string().min(1, 'Укажите пароль').min(6, 'Минимум 6 символов').max(128, 'Не более 128 символов'),
});

const editSchema = z.object({
  ...fields,
  password: z
    .string()
    .max(128, 'Не более 128 символов')
    .refine((value) => value === '' || value.length >= 6, 'Минимум 6 символов'),
});

type FormInput = z.input<typeof createSchema>;
type FormValues = z.output<typeof createSchema>;

const EMPTY: FormInput = { fullName: '', login: '', password: '', phone: '', roleId: null, isActive: true };

export function EmployeeFormModal({
  open,
  employee,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  employee: UserView | null;
  onClose: () => void;
}) {
  const meId = useAuthStore((state) => state.user?.id);
  const isSelf = employee !== null && employee.id === meId;
  const [showPassword, setShowPassword] = useState(false);
  const rolesQuery = useQuery({ queryKey: qk.roles(), queryFn: () => rolesApi.list() });
  const roles = rolesQuery.data?.items ?? [];

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(employee ? editSchema : createSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      employee
        ? {
            fullName: employee.fullName,
            login: employee.login,
            password: '',
            phone: employee.phone ?? '',
            roleId: employee.role?.id ?? null,
            isActive: employee.isActive,
          }
        : EMPTY,
    );
  }, [open, employee, form]);

  const close = () => {
    setShowPassword(false);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const { roleId } = values;
      if (employee) {
        return usersApi.update(employee.id, {
          fullName: values.fullName,
          login: values.login,
          phone: values.phone || null,
          roleId,
          ...(isSelf ? {} : { isActive: values.isActive }),
          ...(values.password ? { password: values.password } : {}),
        });
      }
      return usersApi.create({
        fullName: values.fullName,
        login: values.login,
        password: values.password,
        phone: values.phone || undefined,
        roleId,
        isActive: values.isActive,
      });
    },
    onSuccess: (_, values) => {
      if (!employee) {
        toast.success('Сотрудник создан');
      } else {
        // The server ends the employee's sessions when credentials change or access is revoked.
        const revoked = !isSelf && employee.isActive && !values.isActive;
        const credentials = values.password !== '' || values.login !== employee.login;
        toast.success('Сотрудник сохранён', {
          description: revoked
            ? 'Доступ отключён, все сеансы сотрудника завершены'
            : credentials
              ? isSelf
                ? 'Ваши сеансы на других устройствах завершены'
                : 'Сотруднику нужно войти заново'
              : undefined,
        });
      }
      invalidateScopes('team');
      if (isSelf) void refreshOwnProfile();
      close();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const { errors } = form.formState;
  return (
    <Modal
      open={open}
      onClose={close}
      locked={mutation.isPending}
      size="lg"
      icon={<UserRound />}
      title={employee ? 'Редактирование сотрудника' : 'Новый сотрудник'}
      description="Логин и пароль используются для входа в систему, роль определяет доступные разделы."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="employee-form" loading={mutation.isPending}>
            {employee ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="employee-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input
          containerClassName="sm:col-span-2"
          label="ФИО"
          required
          autoFocus
          maxLength={120}
          placeholder="Например: Азиз Каримов"
          error={errors.fullName?.message}
          {...form.register('fullName')}
        />
        <Input
          label="Логин"
          required
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          placeholder="aziz.karimov"
          hint="Латинские буквы, цифры, «.», «-», «_»"
          error={errors.login?.message}
          {...form.register('login')}
        />
        <Input
          label="Пароль"
          required={!employee}
          type={showPassword ? 'text' : 'password'}
          maxLength={128}
          autoComplete="new-password"
          placeholder={employee ? '••••••' : undefined}
          hint={employee ? 'Оставьте пустым, чтобы не менять' : 'Минимум 6 символов'}
          error={errors.password?.message}
          rightSlot={
            <IconButton
              size="xs"
              label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              icon={showPassword ? <EyeOff /> : <Eye />}
              onClick={() => setShowPassword((value) => !value)}
            />
          }
          {...form.register('password')}
        />
        <Input
          label="Телефон"
          type="tel"
          maxLength={20}
          autoComplete="off"
          placeholder="+998 90 123 45 67"
          error={errors.phone?.message}
          {...form.register('phone')}
        />
        <Controller
          control={form.control}
          name="roleId"
          render={({ field }) => (
            <Select
              label="Роль"
              required
              placeholder={rolesQuery.isLoading ? 'Загрузка…' : 'Выберите роль'}
              value={field.value}
              onChange={field.onChange}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name,
                hint: role.description ?? undefined,
              }))}
              hint={
                rolesQuery.isSuccess && roles.length === 0
                  ? 'Сначала создайте роль в разделе «Роли и доступ»'
                  : undefined
              }
              error={errors.roleId?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Switch
              className="rounded-xl border border-ink-150 px-4 py-3 sm:col-span-2"
              label="Доступ в систему"
              description={
                isSelf
                  ? 'Нельзя отключить собственную учётную запись'
                  : 'Отключённый сотрудник не сможет войти, а его текущие сеансы будут завершены'
              }
              checked={field.value}
              onChange={field.onChange}
              disabled={isSelf}
            />
          )}
        />
      </form>
    </Modal>
  );
}
