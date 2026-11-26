import { cn } from '@/lib/cn';
import { formatDateKey, formatMoney, formatPercent, todayKey } from '@/lib/format';

const SAMPLE_LINES = [
  { name: 'Плов чайханский', quantity: 2, price: 45_000 },
  { name: 'Чай зелёный', quantity: 1, price: 8_000 },
];

function Divider() {
  return <div className="my-3 border-t border-dashed border-ink-300" />;
}

/**
 * Paper-like preview of a guest receipt for a sample table order, rendered
 * from the settings form as the user types.
 */
export function ReceiptPreview({
  restaurantName,
  phone,
  address,
  header,
  footer,
  servicePercent,
  serviceApplies,
}: {
  restaurantName: string;
  phone: string;
  address: string;
  header: string;
  footer: string;
  servicePercent: number;
  /** Whether the service charge applies to table orders. */
  serviceApplies: boolean;
}) {
  const subtotal = SAMPLE_LINES.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const service = serviceApplies && servicePercent > 0 ? Math.round(subtotal * servicePercent) / 100 : 0;
  const total = subtotal + service;
  const name = restaurantName.trim();

  return (
    <div className="rounded-xl bg-ink-100/70 px-4 py-6">
      <div className="mx-auto w-full max-w-[300px] bg-white px-5 py-6 text-[12.5px] leading-relaxed text-ink-800 shadow-raised">
        <div className="text-center break-words">
          <p className={cn('text-[15px] font-semibold', name ? 'text-ink-900' : 'text-ink-300')}>
            {name || 'Название заведения'}
          </p>
          {phone.trim() && <p className="tabular">{phone.trim()}</p>}
          {address.trim() && <p>{address.trim()}</p>}
          {header.trim() && <p className="mt-1.5 whitespace-pre-line text-ink-600">{header.trim()}</p>}
        </div>

        <Divider />
        <div className="flex justify-between text-[11.5px] text-ink-500">
          <span>Чек № 1024</span>
          <span className="tabular">{formatDateKey(todayKey())}</span>
        </div>
        <p className="text-[11.5px] text-ink-500">Стол 5 · Официант: Азиз</p>

        <Divider />
        <div className="flex flex-col gap-1.5">
          {SAMPLE_LINES.map((line) => (
            <div key={line.name}>
              <p className="text-ink-900">{line.name}</p>
              <p className="flex justify-between text-ink-500 tabular">
                <span>
                  {line.quantity} × {formatMoney(line.price)}
                </span>
                <span className="text-ink-800">{formatMoney(line.quantity * line.price)}</span>
              </p>
            </div>
          ))}
        </div>

        <Divider />
        <p className="flex justify-between">
          <span>Подытог</span>
          <span className="tabular">{formatMoney(subtotal)}</span>
        </p>
        {service > 0 && (
          <p className="flex justify-between">
            <span>Обслуживание {formatPercent(servicePercent)}</span>
            <span className="tabular">{formatMoney(service)}</span>
          </p>
        )}
        <p className="mt-1.5 flex justify-between text-[15px] font-semibold text-ink-900">
          <span>ИТОГО</span>
          <span className="tabular">{formatMoney(total)}</span>
        </p>

        {footer.trim() && (
          <>
            <Divider />
            <p className="text-center break-words whitespace-pre-line text-ink-600">{footer.trim()}</p>
          </>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-ink-500">Пример: заказ за столом, суммы в сумах</p>
    </div>
  );
}
