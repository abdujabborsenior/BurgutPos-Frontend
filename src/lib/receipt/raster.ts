/**
 * Turns printed documents into pictures for network printers.
 *
 * The very same HTML and paper CSS that the browser prints (and the receipt
 * designer previews) is laid out in a hidden frame and painted onto a canvas
 * through an SVG foreignObject, one PNG per `.doc` page. The server sends the
 * picture to the printer as ESC/POS raster, so preview == paper and every
 * letter (Қ, Ғ, Ҳ, Ў included) comes out exactly as on screen.
 */

/** 80 mm paper at 203 dpi: 576 dots per line (the server's escpos.ts agrees). */
const PAPER_DOTS = 576;

/** The page box carries what `body` gives the browser print. */
const PAGE_ROOT_STYLE =
  "font-family:'DejaVu Sans','Inter','Segoe UI',Arial,sans-serif;color:#000;line-height:1.3;background:#fff";

const escapeXml = (text: string) =>
  text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * A picture inside an SVG image must be inline. One the browser may not read
 * (another domain without CORS) is left out rather than break the whole page.
 */
async function inlineImages(root: Element): Promise<void> {
  await Promise.all(
    [...root.querySelectorAll('img')].map(async (image) => {
      try {
        const response = await fetch(image.src, { credentials: 'omit' });
        if (!response.ok) throw new Error(String(response.status));
        image.setAttribute('src', await readAsDataUrl(await response.blob()));
      } catch {
        image.remove();
      }
    }),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось подготовить страницу для печати'));
    image.src = src;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Не удалось подготовить страницу для печати')),
      'image/png',
    ),
  );
}

/** Every `.doc` page of `body` as a PNG exactly as wide as the paper. */
export async function renderPagesToPng(body: string, css: string): Promise<Blob[]> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '400px',
    height: '100px',
    border: '0',
    visibility: 'hidden',
  });
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Не удалось подготовить страницу для печати');
    doc.open();
    doc.write(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`,
    );
    doc.close();
    await doc.fonts.ready;

    const pngs: Blob[] = [];
    for (const page of doc.querySelectorAll<HTMLElement>('.doc')) {
      await inlineImages(page);
      const box = page.getBoundingClientRect();
      const width = Math.ceil(box.width);
      const height = Math.ceil(box.height);
      const markup = new XMLSerializer().serializeToString(page);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<foreignObject x="0" y="0" width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;${PAGE_ROOT_STYLE}">` +
        `<style>${escapeXml(css)}</style>${markup}</div></foreignObject></svg>`;
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

      const canvas = document.createElement('canvas');
      canvas.width = PAPER_DOTS;
      canvas.height = Math.ceil((height * PAPER_DOTS) / width);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Не удалось подготовить страницу для печати');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      // The SVG is vector: drawn at paper size it stays sharp.
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      pngs.push(await canvasToPng(canvas));
    }
    return pngs;
  } finally {
    frame.remove();
  }
}
