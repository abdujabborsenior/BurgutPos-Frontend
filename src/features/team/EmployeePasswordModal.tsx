import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { usersApi } from '@/api/team.api';
import type { UserView } from '@/api/types';
import { Button, IconButton, Input, Modal } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth.store';

// Same rules as the API (users/dto/user.dto.ts) and the employee form.
const schema = z
  .object({
    password: z.string().min(6, 'Минимум 6 символов').max(128, 'Не более 128 символов'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * The 🔑 action of «Сотрудники»: an administrator sets a new password for an
 * employee without knowing the old one. The server ends the employee's
 * sessions, so they sign in again with the new password.
 */
export function EmployeePasswordModal({
  employee,
  onClose,
}: {
  employee: UserView | null;
  onClose: () => void;
}) {
  const meId = useAuthStore((state) => state.user?.id);
  // The last employee stays on screen while the window fades out; every
  // opening starts with the password hidden.
  const [shown, setShown] = useState(employee);
  const [previous, setPrevious] = useState(employee);
  const [visible, setVisible] = useState(false);
  if (employee !== previous) {
    setPrevious(employee);
    if (employee) {
      setShown(employee);
      setVisible(false);
    }
  }
  const isSelf = shown !== null && shown.id === meId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });
  useEffect(() => {
    if (employee) form.reset({ password: '', confirm: '' });
  }, [employee, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.update((shown as UserView).id, { password: values.password }),
    onSuccess: () => {
      toast.success(`Пароль «${shown?.fullName ?? ''}» изменён`, {
        description: isSelf
          ? 'Ваши сеансы на других устройствах завершены'
          : 'Сотруднику нужно войти заново',
      });
      invalidateScopes('team');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const { errors } = form.formState;
  const toggle = (
    <IconButton
      size="xs"
      label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      icon={visible ? <EyeOff /> : <Eye />}
      onClick={() => setVisible((value) => !value)}
    />
  );

  return (
    <Modal
      open={employee !== null}
      onClose={onClose}
      locked={mutation.isPending}
      size="sm"
      icon={<KeyRound />}
      title="Пароль"
      description={shown ? `${shown.fullName} · логин ${shown.login}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="employee-password" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="employee-password"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          type={visible ? 'text' : 'password'}
          label="Новый пароль"
          required
          maxLength={128}
          autoComplete="new-password"
          hint="Минимум 6 символов"
          error={errors.password?.message}
          rightSlot={toggle}
          {...form.register('password')}
        />
        <Input
          type={visible ? 'text' : 'password'}
          label="Повторите пароль"
          required
          maxLength={128}
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register('confirm')}
        />
      </form>
    </Modal>
  );
}
