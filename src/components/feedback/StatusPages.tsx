import { Compass, ShieldOff } from 'lucide-react';
import { Link } from 'react-router';
import { Button, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<Compass />}
      title="Страница не найдена"
      description="Возможно, ссылка устарела или страница была перемещена."
      action={
        <Link to="/">
          <Button>На главную</Button>
        </Link>
      }
    />
  );
}

export function ForbiddenPage() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<ShieldOff />}
      title="Нет доступа"
      description="У вашей роли нет прав на этот раздел. Обратитесь к администратору."
      action={
        <Link to="/">
          <Button variant="secondary">На главную</Button>
        </Link>
      }
    />
  );
}
