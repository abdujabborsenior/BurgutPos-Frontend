import { del, get, http, patch, post } from './http';
import type {
  ArchiveStatus,
  Option,
  PaymentMethodOption,
  PaymentMethodType,
  PaymentMethodView,
  PrinterConnection,
  PrinterView,
  ReceiptKind,
  ReceiptLineSpec,
  Settings,
} from './types';

export const settingsApi = {
  get: () => get<Settings>('/settings'),
  update: (input: Partial<Omit<Settings, 'updatedAt'>>) => patch<Settings>('/settings', input),
  /** The lines each printed document can show — drives the receipt editor. */
  receiptLines: () => get<Record<ReceiptKind, ReceiptLineSpec[]>>('/settings/receipt-lines'),
  uploadLogo: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await http.post<Settings>('/settings/logo', form, { timeout: 60_000 });
    return data;
  },
  removeLogo: () => del<Settings>('/settings/logo'),
};

export interface PrinterInput {
  name: string;
  description?: string | null;
  connection?: PrinterConnection;
  host?: string | null;
  port?: number | null;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

/** An active printer as the terminal sees it: where paper for it goes. */
export interface PrinterOption extends Option {
  /** LAN — the server sends to it; USB — this terminal's browser prints. */
  connection: PrinterConnection;
  /** Takes bills, receipts, reports and dishes without their own printer. */
  isDefault: boolean;
}

export const printersApi = {
  list: (status: ArchiveStatus = 'active') => get<PrinterView[]>('/printers', { status }),
  options: () => get<PrinterOption[]>('/printers/options'),
  /** Prints pages (PNG pictures of the paper) on a network printer through the server. */
  print: async (id: number, pages: Blob[]) => {
    const form = new FormData();
    pages.forEach((page, index) => form.append('pages', page, `page-${index + 1}.png`));
    const { data } = await http.post<{ printer: string; pages: number }>(
      `/printers/${id}/print`,
      form,
      {
        timeout: 45_000,
      },
    );
    return data;
  },
  create: (input: PrinterInput) => post<PrinterView>('/printers', input),
  update: (id: number, input: Partial<PrinterInput>) =>
    patch<PrinterView>(`/printers/${id}`, input),
  remove: (id: number) => del(`/printers/${id}`),
};

export interface PaymentMethodInput {
  name: string;
  type: PaymentMethodType;
  sortOrder?: number;
  isActive?: boolean;
}

export const paymentMethodsApi = {
  list: (status: ArchiveStatus = 'active') =>
    get<PaymentMethodView[]>('/payment-methods', { status }),
  options: () => get<PaymentMethodOption[]>('/payment-methods/options'),
  create: (input: PaymentMethodInput) => post<PaymentMethodView>('/payment-methods', input),
  update: (id: number, input: Partial<PaymentMethodInput>) =>
    patch<PaymentMethodView>(`/payment-methods/${id}`, input),
  remove: (id: number) => del(`/payment-methods/${id}`),
};
