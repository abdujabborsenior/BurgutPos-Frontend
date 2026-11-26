import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { getErrorMessage } from '@/api/http';
import { Logo } from '@/components/layout/Sidebar';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { signIn } from './session';

const schema = z.object({
  login: z.string().trim().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const status = useAuthStore((state) => state.status);
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { login: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signIn(values.login, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error, 'Не удалось войти'));
      form.setValue('password', '');
      form.setFocus('password');
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.55]"
          style={{
            background:
              'radial-gradient(1000px 520px at 15% 0%, rgb(94 95 218 / 0.45), transparent 60%), radial-gradient(800px 480px at 100% 100%, rgb(51 48 168 / 0.55), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-bold text-brand-950">
            B
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-warning-500" />
          </span>
          <span className="text-xl font-bold tracking-[-0.02em] text-white">BurgutPOS</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em] text-white">
            Касса, зал и склад ресторана — в одной системе.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-brand-200">
            Заказы по столам, на вынос и доставку, смены и отчёты в реальном времени на каждом
            терминале.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-4 text-brand-100">
          {[
            ['Столы', 'занятость и счёт онлайн'],
            ['Склад', 'остатки и техкарты'],
            ['Отчёты', 'выручка и сотрудники'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs text-brand-200">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">Вход в систему</h2>
          <p className="mt-2 text-sm text-ink-500">Введите логин и пароль, выданные администратором.</p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            {serverError && (
              <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                {serverError}
              </div>
            )}
            <Input
              label="Логин"
              inputSize="lg"
              autoComplete="username"
              autoFocus
              leftIcon={<User />}
              error={errors.login?.message}
              {...form.register('login')}
            />
            <Input
              label="Пароль"
              inputSize="lg"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              leftIcon={<Lock />}
              error={errors.password?.message}
              rightSlot={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
              {...form.register('password')}
            />
            <Button type="submit" size="lg" fullWidth loading={isSubmitting} rightIcon={<LogIn className="size-[18px]" />}>
              Войти
            </Button>
          </form>
          <p className="mt-10 text-center text-xs text-ink-400">© {new Date().getFullYear()} BurgutPOS</p>
        </div>
      </section>
    </div>
  );
}
