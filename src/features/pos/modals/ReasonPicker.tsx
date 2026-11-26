import { Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';

const CANCEL_REASONS = [
  'Гость отказался',
  'Ошибка официанта',
  'Долгое ожидание',
  'Нет в наличии',
  'Жалоба на качество',
  'Тестовый заказ',
];

/** Quick reason chips + free text (min 3 characters, enforced by the API). */
export function ReasonPicker({
  value,
  onChange,
  error,
  label = 'Причина',
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {CANCEL_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => onChange(reason)}
            className={cn(
              'h-8 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
              value === reason
                ? 'border-brand-800 bg-brand-50 text-brand-900'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
            )}
          >
            {reason}
          </button>
        ))}
      </div>
      <Textarea
        label={label}
        required
        rows={2}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Опишите причину"
        error={error}
      />
    </div>
  );
}
