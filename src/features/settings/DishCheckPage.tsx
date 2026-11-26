import { renderDishTicket } from '@/lib/receipt/render';
import { ReceiptDesigner, type PreviewTab } from './receipt/ReceiptDesigner';
import { SAMPLE_AT, SAMPLE_ITEMS, sampleOrder } from './receipt/sample';

type TicketCase = 'order' | 'cancel' | 'takeaway';

const TABS: PreviewTab<TicketCase>[] = [
  { value: 'order', label: 'Заказ' },
  { value: 'cancel', label: 'Отмена' },
  { value: 'takeaway', label: 'С собой' },
];

/** Чек блюда: what the kitchen ticket shows and how. */
export default function DishCheckPage() {
  return (
    <ReceiptDesigner
      kind="dishCheck"
      title="Чек блюда"
      description="Что отображать на кухонном чеке"
      tabs={TABS}
      renderPreview={(layout, ticket, settings) =>
        renderDishTicket({
          order: sampleOrder(ticket === 'takeaway' ? 'TAKEAWAY' : 'TABLE', false, 'СТОЛ 5'),
          items: SAMPLE_ITEMS.slice(0, 3),
          // The draft being edited, not what is saved.
          settings: { ...settings, dishCheck: layout },
          station: 'КУХНЯ',
          variant: ticket === 'cancel' ? 'cancel' : 'order',
          completedBy: 'Кассир',
          now: SAMPLE_AT,
        })
      }
    />
  );
}
