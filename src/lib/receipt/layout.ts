/** Mirrors the receipt catalog of the API (server is the source of truth). */

export type ReceiptFont = 'SANS' | 'MONO';
export type ReceiptWeight = 'NORMAL' | 'BOLD';

export interface ReceiptLineStyle {
  enabled: boolean;
  font: ReceiptFont;
  weight: ReceiptWeight;
  size: number;
}

export interface ReceiptLineSpec {
  key: string;
  label: string;
  toggleable: boolean;
  hint?: string;
  default: ReceiptLineStyle;
}

export type ReceiptKind = 'orderCheck' | 'dishCheck';
export type ReceiptLayout = Record<string, ReceiptLineStyle>;

/** Sizes offered in the editor; the paper gets `size / 2` pixels. */
export const RECEIPT_SIZES = [20, 24, 28, 30, 32, 36, 40, 44, 50];

export const FONT_LABELS: Record<ReceiptFont, string> = {
  SANS: 'DejaVu Sans',
  MONO: 'DejaVu Sans Mono',
};

export const WEIGHT_LABELS: Record<ReceiptWeight, string> = {
  NORMAL: 'Обычный',
  BOLD: 'Жирный',
};

const FALLBACK: ReceiptLineStyle = { enabled: true, font: 'SANS', weight: 'NORMAL', size: 24 };

/** The style of one line; a missing line is simply not printed. */
export function lineStyle(layout: ReceiptLayout | undefined, key: string): ReceiptLineStyle {
  return layout?.[key] ?? FALLBACK;
}

export const isOn = (layout: ReceiptLayout | undefined, key: string): boolean =>
  lineStyle(layout, key).enabled;

/** Inline CSS of a line: the one place where a size becomes pixels. */
export function styleCss(style: ReceiptLineStyle): string {
  const family = style.font === 'MONO' ? 'var(--mono)' : 'var(--sans)';
  return `font-family:${family};font-weight:${style.weight === 'BOLD' ? 700 : 400};font-size:${style.size / 2}px`;
}

/** `style="…"` for a line, or nothing when the line is switched off. */
export function attr(layout: ReceiptLayout | undefined, key: string): string {
  return ` style="${styleCss(lineStyle(layout, key))}"`;
}
