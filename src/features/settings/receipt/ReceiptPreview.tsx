import { useMemo, useRef, useState } from 'react';
import { RECEIPT_CSS } from '@/lib/receipt/render';

/**
 * Shows the receipt exactly as it will be printed: the same HTML, the same
 * stylesheet, inside an iframe so the page styles cannot leak in or out. The
 * frame grows to the paper's length, like the strip that leaves the printer.
 */
export function ReceiptPreview({ html, className }: { html: string; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  // The page keeps its paper width (72 mm ≈ 272 px), so lines wrap here
  // exactly where they wrap on the printed strip.
  const srcDoc = useMemo(
    () =>
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${RECEIPT_CSS}
        html, body { background: #fff; overflow: hidden; }
        .doc { margin: 0 auto; }
        .doc + .doc { margin-top: 10px; border-top: 1px dashed #bbb; page-break-before: auto; }
      </style></head><body>${html}</body></html>`,
    [html],
  );

  const fit = () => {
    const element = frame.current;
    const doc = element?.contentDocument;
    if (!element || !doc) return;
    // The frame's own border sits inside its height (border-box).
    const border = element.offsetHeight - element.clientHeight;
    // The body, not the root: the root is never shorter than the frame
    // itself, so a receipt that got shorter would keep the old height.
    const measure = () => setHeight(Math.ceil(doc.body.getBoundingClientRect().height) + border);
    measure();
    // A late font changes line heights; measure once more when they settle.
    void doc.fonts?.ready.then(measure);
  };

  return (
    <iframe
      ref={frame}
      title="Предпросмотр чека"
      srcDoc={srcDoc}
      // Printed paper is static: no scripts run. Same origin only lets the
      // page measure the paper's length.
      sandbox="allow-same-origin"
      onLoad={fit}
      style={height ? { height } : undefined}
      className={className}
    />
  );
}
