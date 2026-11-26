import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { getErrorMessage } from '@/api/http';
import { Button, Input, Modal } from '@/components/ui';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newPassword: z.string().min(6, 'Минимум 6 символов').max(128, 'Не более 128 символов'),
    confirm: z.string(),
  })
  .refine((data) => data.newPassword === data.confirm, { message: 'Пароли не совпадают', path: ['confirm'] });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('Пароль изменён. Другие устройства выйдут из системы');
      form.reset();
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
      size="sm"
      icon={<KeyRound />}
      title="Смена пароля"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="change-password" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id="change-password"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          type="password"
          label="Текущий пароль"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
        <Input
          type="password"
          label="Новый пароль"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...form.register('newPassword')}
        />
        <Input
          type="password"
          label="Повторите новый пароль"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register('confirm')}
        />
      </form>
    </Modal>
  );
}
