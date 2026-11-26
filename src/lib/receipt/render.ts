import type { OrderDetail, OrderItemView, Settings } from '@/api/types';
import { formatDateTime, formatMoney, formatQty, formatReceiptDateTime } from '../format';
import { DISH_UNIT_LABELS, ORDER_TYPE_LABELS } from '../labels';
import { attr, isOn, lineStyle, styleCss, type ReceiptLayout } from './layout';

export const escapeHtml = (value: string | null | undefined): string =>
  (value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

/**
 * Paper styles. Sizes come from the receipt designer, so the rules here only
 * cover layout — never font size or weight of a configurable line.
 */
export const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  :root { --sans: 'DejaVu Sans', 'Inter', 'Segoe UI', Arial, sans-serif; --mono: 'DejaVu Sans Mono', 'Menlo', monospace; }
  body { margin: 0; font-family: var(--sans); color: #000; line-height: 1.3; }
  .doc { width: 72mm; padding: 4mm 3mm 6mm; margin: 0 auto; background: #fff; }
  .doc + .doc { page-break-before: always; }
  .center { text-align: center; }
  .muted { color: #333; font-size: 11px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .row > span:last-child { text-align: right; white-space: nowrap; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  .line { margin: 1px 0; }
  .items { width: 100%; border-collapse: collapse; }
  /* Headings follow the lines, but never grow past 12px: a big «Наименование»
     would push the figure columns off the paper. */
  .items th { font-weight: 400; font-size: min(1em, 12px); text-align: right; padding: 1px 0 12px; }
  .items th:first-child { text-align: left; }
  .items td { padding: 3px 0; vertical-align: top; text-align: right; white-space: nowrap; }
  .items th + th, .items td + td { padding-left: 5px; }
  .items td:first-child { text-align: left; white-space: normal; word-break: break-word; }
  /* On the row, not the cells: one unbroken dotted line across the paper. */
  .items tbody tr + tr { border-top: 1px dotted #000; }
  .note { font-size: 11px; font-style: italic; }
  .pre { white-space: pre-line; }
  .logo { display: block; max-width: 44mm; max-height: 22mm; margin: 0 auto 3px; }
  .kitchen .row { margin: 2px 0; }
  .bill { line-height: 1.25; }
  /* The guest bill spends the whole printable strip on text, so a 7-digit
     «Итого к оплате» stays on one line, as in the reference. The LAN raster
     scales the page to the printer's dots anyway; browser printing shrinks it
     back to the 72 mm a thermal printer can reach. */
  .doc.bill { width: 75mm; padding-left: 0; padding-right: 0; }
  @media print { .doc.bill { zoom: 0.96; } }
  .bill .line { margin: 0; }
  /* Label keeps its words up to 60% of the paper; a long value (a hall and
     table name) wraps on the right instead of running off the paper. */
  .bill .pair { display: grid; grid-template-columns: fit-content(60%) 1fr; }
  .bill .pair > span:last-child { white-space: normal; overflow-wrap: break-word; }
  .rule { border-top: 1px solid #000; margin: 4px 0; }
  .footer { text-align: center; font-weight: 700; font-size: 11.5px; }
`;

/** Sections of the guest bill are divided by a solid rule; empty ones vanish. */
const RULE = '<div class="rule"></div>';
const sections = (...parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(RULE);

const line = (layout: ReceiptLayout | undefined, key: string, html: string, className = 'line') =>
  isOn(layout, key) ? `<div class="${className}"${attr(layout, key)}>${html}</div>` : '';

const pair = (layout: ReceiptLayout | undefined, key: string, label: string, value: string) =>
  isOn(layout, key) && value
    ? `<div class="row line pair"${attr(layout, key)}><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
    : '';

/** Where the order was served, in the words the guest knows. */
function placeOf(order: OrderDetail): string {
  if (order.type === 'TABLE' && order.table) {
    return order.table.hall ? `${order.table.hall.name} • ${order.table.name}` : order.table.name;
  }
  return ORDER_TYPE_LABELS[order.type];
}

/** Same dish + price + comment are one line on paper. */
function groupLines(items: OrderItemView[]) {
  const groups = new Map<
    string,
    {
      name: string;
      unit: OrderItemView['unit'];
      price: number;
      quantity: number;
      total: number;
      comment: string | null;
    }
  >();
  for (const item of items) {
    if (item.status !== 'ACTIVE') continue;
    const key = `${item.dishId}|${item.price}|${item.comment ?? ''}`;
    const group = groups.get(key);
    if (group) {
      group.quantity += item.quantity;
      group.total += item.total;
    } else {
      groups.set(key, {
        name: item.name,
        unit: item.unit,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        comment: item.comment,
      });
    }
  }
  return [...groups.values()];
}

export interface OrderCheckOptions {
  order: OrderDetail;
  settings: Settings | undefined;
  /** Bill before payment (счёт) or the receipt of a paid order (чек). */
  variant: 'bill' | 'receipt';
  /** Who pressed print — the "Напечатал" line. */
  printedBy?: string | null;
  /** Fixed moment for the preview; defaults to now. */
  now?: Date;
}

/**
 * Гостевой чек. Every configurable line asks the layout first, so what the
 * designer shows is exactly what the printer puts on paper.
 */
export function renderOrderCheck({
  order,
  settings,
  variant,
  printedBy,
  now,
}: OrderCheckOptions): string {
  const layout = settings?.orderCheck;
  const stamp =
    now ?? (variant === 'receipt' && order.closedAt ? new Date(order.closedAt) : new Date());
  const itemsStyle = lineStyle(layout, 'items');

  const venue = isOn(layout, 'restaurantName')
    ? `
      ${settings?.logoUrl ? `<img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="">` : ''}
      ${settings?.restaurantName ? `<div class="center line"${attr(layout, 'restaurantName')}>${escapeHtml(settings.restaurantName)}</div>` : ''}
      ${settings?.address ? `<div class="center muted">${escapeHtml(settings.address)}</div>` : ''}
      ${settings?.phone ? `<div class="center muted">${escapeHtml(settings.phone)}</div>` : ''}
      ${settings?.receiptHeader ? `<div class="center muted pre">${escapeHtml(settings.receiptHeader)}</div>` : ''}`
    : '';

  const rows = groupLines(order.items)
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}${item.comment ? `<div class="note">${escapeHtml(item.comment)}</div>` : ''}</td>
        <td>${formatQty(item.quantity)}</td>
        <td>${formatMoney(item.price)}</td>
        <td>${formatMoney(item.total)}</td>
      </tr>`,
    )
    .join('');

  // Подытог only makes sense when something stands between it and the total.
  const adjustments = [
    order.discountAmount > 0
      ? pair(
          layout,
          'subtotal',
          `Скидка${order.discountType === 'PERCENT' ? ` ${formatMoney(order.discountValue)}%` : ''}`,
          `−${formatMoney(order.discountAmount)}`,
        )
      : '',
    order.serviceAmount > 0
      ? pair(
          layout,
          'subtotal',
          `Обслуживание ${formatMoney(order.servicePercent)}%`,
          formatMoney(order.serviceAmount),
        )
      : '',
    order.deliveryFee > 0
      ? pair(layout, 'subtotal', 'Доставка', formatMoney(order.deliveryFee))
      : '',
  ].join('');
  const totals = adjustments
    ? pair(layout, 'subtotal', 'Подытог:', formatMoney(order.subtotal)) + adjustments
    : '';

  const payments =
    variant === 'receipt'
      ? (() => {
          const held = new Map<number, { name: string; amount: number }>();
          for (const payment of order.payments) {
            const entry = held.get(payment.method.id) ?? { name: payment.method.name, amount: 0 };
            entry.amount = Math.round((entry.amount + payment.amount) * 100) / 100;
            held.set(payment.method.id, entry);
          }
          const lines = [...held.values()]
            .filter((entry) => entry.amount > 0)
            .map((entry) => pair(layout, 'subtotal', entry.name, formatMoney(entry.amount)))
            .join('');
          const change =
            order.changeAmount > 0
              ? pair(layout, 'subtotal', 'Получено', formatMoney(order.receivedAmount)) +
                pair(layout, 'subtotal', 'Сдача', formatMoney(order.changeAmount))
              : '';
          return lines + change;
        })()
      : '';

  const header = `
      ${pair(layout, 'table', 'Тип заказа', order.type === 'TABLE' ? 'На стол' : ORDER_TYPE_LABELS[order.type])}
      ${order.type === 'TABLE' ? pair(layout, 'table', 'Номер стола', placeOf(order)) : ''}
      ${pair(layout, 'waiter', 'Официант', order.waiter?.fullName ?? '—')}
      ${pair(layout, 'printedBy', 'Напечатал', printedBy ?? order.closedBy?.fullName ?? '')}
      ${pair(layout, 'orderNumber', 'Номер заказа', `№ ${order.number}`)}
      ${pair(layout, 'dateTime', 'Дата', formatReceiptDateTime(stamp))}
      ${order.customerName ? pair(layout, 'waiter', 'Клиент', order.customerName) : ''}
      ${order.customerPhone ? pair(layout, 'waiter', 'Телефон', order.customerPhone) : ''}
      ${order.deliveryAddress ? `<div class="line"${attr(layout, 'waiter')}>${escapeHtml(order.deliveryAddress)}</div>` : ''}`;

  const table = `
      <table class="items" style="${styleCss(itemsStyle)}">
        <thead>
          <tr><th>Наименование</th><th>Кл</th><th>Цена</th><th>Итого</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

  return `
    <div class="doc bill">
      ${sections(
        venue,
        header,
        table,
        totals,
        line(
          layout,
          'total',
          `<div class="row"><span>Итого к оплате:</span><span>${formatMoney(order.total)}</span></div>`,
        ),
        payments,
        settings?.receiptFooter
          ? `<div class="footer pre">${escapeHtml(settings.receiptFooter)}</div>`
          : '',
      )}
    </div>`;
}

export interface DishTicketOptions {
  order: OrderDetail;
  items: OrderItemView[];
  settings: Settings | undefined;
  /** The station this page goes to; printed small when there is one. */
  station?: string | null;
  /** A cancellation ticket carries the "ОТМЕНЕНО" heading. */
  variant: 'order' | 'cancel';
  /** Who sent the lines to the kitchen. */
  completedBy?: string | null;
  now?: Date;
}

/** Кухонный чек: one page per preparation station. */
export function renderDishTicket({
  order,
  items,
  settings,
  station,
  variant,
  completedBy,
  now,
}: DishTicketOptions): string {
  const layout = settings?.dishCheck;
  const stamp = now ?? new Date();
  const title =
    order.type === 'TABLE' && order.table ? order.table.name : ORDER_TYPE_LABELS[order.type];
  const takeaway = order.type === 'TAKEAWAY' || order.type === 'DELIVERY';

  const rows = items
    .map(
      (item) => `
      <div class="row"${attr(layout, 'items')}>
        <span>${escapeHtml(item.name)}${item.comment ? `<div class="note">${escapeHtml(item.comment)}</div>` : ''}</span>
        <span>${formatQty(item.quantity)}${item.unit === 'PCS' ? '' : ` ${DISH_UNIT_LABELS[item.unit]}`}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="doc kitchen">
      ${station ? `<div class="center muted">${escapeHtml(station)}</div>` : ''}
      ${variant === 'cancel' ? `<div class="center line"${attr(layout, 'cancelled')}>ОТМЕНЕНО</div>` : ''}
      ${takeaway ? `<div class="center line"${attr(layout, 'takeaway')}>С СОБОЙ</div>` : ''}
      ${line(layout, 'title', escapeHtml(title.toUpperCase()), 'center line')}
      <div class="sep"></div>
      ${pair(layout, 'orderNumber', 'Заказ', `№ ${order.number}`)}
      ${line(layout, 'completedBy', `Выполнен: ${escapeHtml(completedBy ?? order.createdBy?.fullName ?? '—')}`)}
      ${line(layout, 'waiter', `Официант: ${escapeHtml(order.waiter?.fullName ?? '—')}`)}
      ${line(layout, 'dateTime', escapeHtml(formatDateTime(stamp)))}
      <div class="sep"></div>
      ${rows}
      ${order.comment ? `<div class="sep"></div><div class="note">${escapeHtml(order.comment)}</div>` : ''}
    </div>`;
}
