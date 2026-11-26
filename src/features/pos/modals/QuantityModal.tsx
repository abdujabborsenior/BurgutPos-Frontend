import { Scale } from 'lucide-react';
import { useState } from 'react';
import type { DishUnit } from '@/api/types';
import { Button, Modal, NumericInput } from '@/components/ui';
import { DISH_UNIT_LABELS, FRACTIONAL_DISH_UNITS } from '@/lib/labels';
import { formatMoney } from '@/lib/format';

export interface QuantityRequest {
  title: string;
  unit: DishUnit;
  price: number;
  initial?: number;
  max?: number;
}

function QuantityForm({ request, onSubmit, onCancel }: { request: QuantityRequest; onSubmit: (quantity: number) => void; onCancel: () => void }) {
  const fractional = FRACTIONAL_DISH_UNITS.includes(request.unit);
  const [value, setValue] = useState<number | null>(request.initial ?? null);
  const invalid = !value || value <= 0 || (request.max !== undefined && value > request.max);
  const presets = fractional ? [0.25, 0.5, 1, 1.5, 2] : [1, 2, 3, 5, 10];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid && value) onSubmit(value);
      }}
      className="flex flex-col gap-4"
    >
      <NumericInput
        label={`Количество, ${DISH_UNIT_LABELS[request.unit]}`}
        value={value}
        onChange={setValue}
        decimals={fractional ? 3 : 0}
        min={0}
        max={request.max}
        inputSize="lg"
        autoFocus
        hint={request.max !== undefined ? `Доступно: ${request.max}` : undefined}
      />
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setValue(preset)}
            className="h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 tabular hover:border-brand-300 hover:bg-brand-50"
          >
            {String(preset).replace('.', ',')}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
        <span className="text-ink-500">Сумма</span>
        <span className="font-semibold text-ink-900 tabular">{formatMoney((value ?? 0) * request.price)}</span>
      </div>
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={invalid}>
          Готово
        </Button>
      </div>
    </form>
  );
}

export function QuantityModal({
  request,
  onClose,
  onSubmit,
}: {
  request: QuantityRequest | null;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
}) {
  return (
    <Modal open={request !== null} onClose={onClose} size="sm" icon={<Scale />} title={request?.title}>
      {request && (
        <QuantityForm
          key={request.title}
          request={request}
          onCancel={onClose}
          onSubmit={(quantity) => {
            onSubmit(quantity);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
