import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { FolderTree } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { categoriesApi } from '@/api/menu.api';
import type { CategoryView } from '@/api/types';
import { Button, Input, Modal, NumericInput } from '@/components/ui';
import { invalidateScopes } from '@/lib/realtime';

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(100, 'Не более 100 символов'),
  sortOrder: z.number().int('Целое число').min(0, 'Не меньше 0').max(100000).nullable(),
});

type FormValues = z.infer<typeof schema>;

export function CategoryFormModal({
  open,
  category,
  onClose,
}: {
  open: boolean;
  /** null → create mode */
  category: CategoryView | null;
  onClose: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', sortOrder: null },
  });

  useEffect(() => {
    if (open) form.reset({ name: category?.name ?? '', sortOrder: category?.sortOrder ?? null });
  }, [open, category, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { name: values.name, sortOrder: values.sortOrder ?? undefined };
      return category ? categoriesApi.update(category.id, input) : categoriesApi.create(input);
    },
    onSuccess: () => {
      toast.success(category ? 'Категория сохранена' : 'Категория создана');
      invalidateScopes('menu');
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
      icon={<FolderTree />}
      title={category ? 'Редактирование категории' : 'Новая категория'}
      description="Категории группируют блюда в меню и на экране заказа."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="category-form" loading={mutation.isPending}>
            {category ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Input label="Название" required autoFocus placeholder="Например: ШАШЛИК" error={errors.name?.message} {...form.register('name')} />
        <Controller
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <NumericInput
              label="Порядок"
              hint="Чем меньше число, тем выше категория в списке. Пусто — в конец."
              value={field.value}
              onChange={field.onChange}
              min={0}
              max={100000}
              error={errors.sortOrder?.message}
            />
          )}
        />
      </form>
    </Modal>
  );
}
