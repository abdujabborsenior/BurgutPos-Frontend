import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';
import { qk } from '@/api/keys';
import type { CategoryDishesGroup, SummaryReport } from '@/api/report-types';
import { printersApi, type PrinterOption } from '@/api/settings.api';
import type { OrderDetail, OrderItemView, Settings } from '@/api/types';
import { queryClient } from '@/app/query-client';
import { formatDateKey, formatDateTime, formatMoney, formatQty } from './format';
import { DISH_UNIT_LABELS, ORDER_TYPE_LABELS } from './labels';
import { renderPagesToPng } from './receipt/raster';
import {
  escapeHtml as escape,
  RECEIPT_CSS,
  renderDishTicket,
  renderOrderCheck,
} from './receipt/render';

// ─────────────────────────────── Delivery ───────────────────────────────
//
// Where paper goes:
//  • a network (LAN) printer — the page is drawn here as a picture and the
//    server sends it to the printer's IP:port (ESC/POS raster);
//  • a USB printer, or no printer at all — this terminal's browser prints
//    (the USB printer is the terminal's own; in kiosk mode there is no dialog).
// Bills, receipts and reports go to the default printer; kitchen tickets go
// to each dish's printer (the default one when the dish has none).

/** Active printers, cached briefly: a burst of tickets asks the server once. */
async function printerOptions(): Promise<PrinterOption[]> {
  try {
    return await queryClient.fetchQuery({
      queryKey: qk.printerOptions,
      queryFn: printersApi.options,
      staleTime: 30_000,
    });
  } catch {
    // Without the list the terminal still prints — through its browser.
    return [];
  }
}

const defaultOf = (printers: PrinterOption[]) =>
  printers.find((printer) => printer.isDefault) ?? null;

/**
 * Prints on one printer. A network printer that fails (off, unplugged, wrong
 * IP) is reported with a way out: print the same paper through the browser.
 * Returns true when the paper was handed to a network printer.
 */
async function deliver(
  printer: PrinterOption | null,
  body: string,
  title: string,
): Promise<boolean> {
  if (!printer || printer.connection !== 'LAN') {
    printHtml(body, title);
    return false;
  }
  try {
    const pages = await renderPagesToPng(body, PAPER_CSS);
    if (pages.length === 0) return false;
    await printersApi.print(printer.id, pages);
    return true;
  } catch (error) {
    toast.error(getErrorMessage(error, `Не удалось напечатать на «${printer.name}»`), {
      duration: 12_000,
      action: { label: 'Печать через браузер', onClick: () => printHtml(body, title) },
    });
    return false;
  }
}

/** Paper for the default printer: bills, receipts, reports. */
async function deliverToDefault(body: string, title: string): Promise<boolean> {
  return deliver(defaultOf(await printerOptions()), body, title);
}

/** Prints HTML through a hidden iframe (no pop-ups, works in kiosk mode). */
function printHtml(body: string, title: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${PAPER_CSS}</style></head><body>${body}</body></html>`,
  );
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    frame.contentWindow?.focus();
    // Images (the logo) must be on the page before the dialog opens.
    const images = [...doc.images].filter((image) => !image.complete);
    const start = () => frame.contentWindow?.print();
    if (images.length === 0) start();
    else {
      let left = images.length;
      const done = () => {
        left -= 1;
        if (left === 0) start();
      };
      for (const image of images) {
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      }
      // Never wait for a stuck image.
      setTimeout(() => left > 0 && ((left = 0), start()), 2000);
    }
    // Browsers without afterprint support.
    setTimeout(cleanup, 60_000);
  }, 120);
}

// ─────────────────────────────── Receipts ───────────────────────────────

/** Guest bill before payment (счёт) — on the default printer. */
export function printPrecheck(
  order: OrderDetail,
  settings: Settings | undefined,
  printedBy?: string | null,
): Promise<boolean> {
  return deliverToDefault(
    renderOrderCheck({ order, settings, variant: 'bill', printedBy }),
    `Счёт №${order.number}`,
  );
}

/** Final receipt of a paid order — on the default printer. */
export function printReceipt(
  order: OrderDetail,
  settings: Settings | undefined,
  printedBy?: string | null,
): Promise<boolean> {
  return deliverToDefault(
    renderOrderCheck({ order, settings, variant: 'receipt', printedBy }),
    `Чек №${order.number}`,
  );
}

/**
 * Kitchen tickets for the given lines (all active lines when `itemIds` is
 * omitted): one page per printer, each on its own printer. A dish without a
 * printer — or whose printer was archived — goes to the default printer.
 * Network printers get their pages from the server; the rest are printed
 * together through this terminal's browser.
 */
export async function printKitchenTickets(
  order: OrderDetail,
  settings: Settings | undefined,
  itemIds?: number[],
  options: { variant?: 'order' | 'cancel'; completedBy?: string | null } = {},
): Promise<void> {
  const selected = order.items.filter(
    (item) =>
      (options.variant === 'cancel' ? item.status === 'CANCELLED' : item.status === 'ACTIVE') &&
      (!itemIds || itemIds.includes(item.id)),
  );
  if (!selected.length) return;
  const printers = await printerOptions();
  const fallback = defaultOf(printers);
  const groups = new Map<
    string,
    { printer: PrinterOption | null; station: string; items: OrderItemView[] }
  >();
  for (const item of selected) {
    const printer = printers.find((option) => option.id === item.printerId) ?? fallback;
    const key = printer ? `printer:${printer.id}` : `station:${item.printerName ?? ''}`;
    const group = groups.get(key) ?? {
      printer,
      station: printer?.name ?? item.printerName ?? 'Без принтера',
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  const title = `Заказ №${order.number} — кухня`;
  const ticket = (group: { station: string; items: OrderItemView[] }) =>
    renderDishTicket({
      order,
      items: group.items,
      settings,
      station: group.station,
      variant: options.variant ?? 'order',
      completedBy: options.completedBy,
    });
  const network = [...groups.values()].filter((group) => group.printer?.connection === 'LAN');
  const browser = [...groups.values()].filter((group) => group.printer?.connection !== 'LAN');
  if (browser.length) printHtml(browser.map(ticket).join(''), title);
  await Promise.all(network.map((group) => deliver(group.printer, ticket(group), title)));
}

/**
 * Пробный талон: checks the paper, the kitchen layout and that the station
 * name is the one the staff expects — printed on that very printer.
 */
export async function printTestTicket(
  station: {
    id: number;
    name: string;
    connection?: string;
    host?: string | null;
    port?: number | null;
  },
  settings: Settings | undefined,
): Promise<boolean> {
  const where =
    station.connection === 'USB'
      ? 'USB'
      : station.host
        ? `${station.host}:${station.port ?? 9100}`
        : 'адрес не указан';
  const printer = (await printerOptions()).find((option) => option.id === station.id) ?? null;
  return deliver(
    printer,
    `<div class="doc kitchen">
      <div class="center title">ПРОБНЫЙ ТАЛОН</div>
      <div class="sep"></div>
      <div class="row"><span>Принтер</span><span>${escape(station.name)}</span></div>
      <div class="row"><span>Подключение</span><span>${escape(where)}</span></div>
      <div class="row"><span>Заведение</span><span>${escape(settings?.restaurantName ?? '')}</span></div>
      <div class="row"><span>Напечатано</span><span>${formatDateTime(new Date())}</span></div>
      <div class="sep"></div>
      <div class="center muted">Если этот талон вышел — принтер готов к работе.</div>
    </div>`,
    `Пробный талон — ${station.name}`,
  );
}

// ─────────────────────────────── Reports ───────────────────────────────

/** Report slips keep their own modest styles: they are not configurable. */
const REPORT_CSS = `
  .doc.kitchen .title, .report .title { font-size: 15px; font-weight: 700; }
  .doc.kitchen .row { font-size: 12px; }
  .report { font-size: 12px; }
  .report .title { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
  .report .big { font-size: 15px; font-weight: 700; }
  .report .item { margin: 3px 0; }
  .report .item .name { font-weight: 600; }
`;

/** Everything printed shares one stylesheet — the browser print and the printer pictures alike. */
const PAPER_CSS = `${RECEIPT_CSS}${REPORT_CSS}`;

/** "11.11.2026 00:00 — 11.11.2026 23:59" from report period minutes. */
function periodText(from: string, to: string): string {
  const minute = (value: string) => `${formatDateKey(value.slice(0, 10))} ${value.slice(11, 16)}`;
  return `${minute(from)} — ${minute(to)}`;
}

const row = (label: string, value: string, className = '') =>
  `<div class="row ${className}"><span>${escape(label)}</span><span>${escape(value)}</span></div>`;

const section = (title: string) =>
  `<div class="sep"></div><div class="center" style="font-weight:700">${escape(title)}</div>`;

function reportHeader(settings: Settings | undefined): string {
  if (!settings) return '';
  return `
    ${settings.restaurantName ? `<div class="center title">${escape(settings.restaurantName)}</div>` : ''}
    ${settings.address ? `<div class="center muted">${escape(settings.address)}</div>` : ''}
    ${settings.phone ? `<div class="center muted">${escape(settings.phone)}</div>` : ''}`;
}

/** Z-style day summary on the receipt printer (Итоговый отчёт → «Печать»). */
export function printSummaryReport(
  report: SummaryReport,
  settings: Settings | undefined,
): Promise<boolean> {
  const t = report.totals;
  return deliverToDefault(
    `<div class="doc report">
      ${reportHeader(settings)}
      <div class="sep"></div>
      <div class="center title">ИТОГОВЫЙ ОТЧЁТ</div>
      <div class="center muted">${
        report.shift
          ? `Смена №${report.shift.id} · ${escape(report.shift.openedBy)}`
          : periodText(report.from, report.to)
      }</div>
      ${section('Способы оплаты')}
      ${report.paymentMethods.map((method) => row(method.name, formatMoney(method.amount))).join('')}
      <div class="sep"></div>
      ${row('Итого', formatMoney(t.collected), 'big')}
      ${t.pending.amount > 0 ? row(`Ожидает оплаты (${t.pending.count})`, `+${formatMoney(t.pending.amount)}`) : ''}
      ${section('Типы заказов')}
      ${report.byType.map((type) => row(`${ORDER_TYPE_LABELS[type.type]} (${type.count})`, formatMoney(type.amount))).join('')}
      ${row(`Отменено (${t.cancelledOrders.count})`, formatMoney(t.cancelledOrders.amount))}
      ${
        report.waiters.length
          ? `${section(`Официанты — доля ${formatMoney(report.percent.waiter)}%`)}
             ${report.waiters.map((waiter) => row(waiter.fullName ?? 'Без официанта', formatMoney(waiter.share))).join('')}`
          : ''
      }
      ${
        report.topDishes.length
          ? `${section('Блюда')}
             ${report.topDishes.map((dish, index) => row(`${index + 1}. ${dish.name}`, formatQty(dish.quantity))).join('')}`
          : ''
      }
      <div class="sep"></div>
      <div class="center muted">Напечатано ${formatDateTime(new Date())}</div>
    </div>`,
    'Итоговый отчёт',
  );
}

/**
 * Sold dishes by category on the receipt printer: one category
 * («печать» in a row) or all of them («Печать всех»), each on its own slip.
 */
export function printCategoryDishes(
  groups: CategoryDishesGroup[],
  period: { from: string; to: string },
  settings: Settings | undefined,
): Promise<boolean> {
  const pages = groups
    .map(
      (group) => `
      <div class="doc report">
        ${reportHeader(settings)}
        <div class="sep"></div>
        <div class="center title">${escape(group.name.toUpperCase())}</div>
        <div class="center muted">${periodText(period.from, period.to)}</div>
        <div class="sep"></div>
        ${group.dishes
          .filter((dish) => dish.quantity > 0)
          .map(
            (dish) => `
          <div class="item">
            <div class="name">${escape(dish.name)}</div>
            <div class="row muted"><span>${formatQty(dish.quantity)} ${DISH_UNIT_LABELS[dish.unit]}</span><span>${formatMoney(dish.revenue)}</span></div>
          </div>`,
          )
          .join('')}
        <div class="sep"></div>
        ${row('Итого', `${formatQty(group.quantity)} · ${formatMoney(group.revenue)}`, 'big')}
        ${group.pendingRevenue > 0 ? row('Ожидает оплаты', `+${formatMoney(group.pendingRevenue)}`) : ''}
        <div class="center muted" style="margin-top:6px">Напечатано ${formatDateTime(new Date())}</div>
      </div>`,
    )
    .join('');
  return deliverToDefault(
    pages,
    groups.length === 1 ? `Категория — ${groups[0].name}` : 'Категории',
  );
}
