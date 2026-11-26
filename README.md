# BurgutPOS — Web client

Restaurant point-of-sale UI: hall board with tables, order screen with menu and
cart, takeaway / delivery / hall channels, payments, shifts, menu, stock,
dashboard and reports, team and settings.

API: `../BurgutPos` (NestJS).

## Stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS v4 · Zustand ·
TanStack Query · React Router 7 · react-hook-form + zod · Headless UI ·
lucide-react · Recharts · Socket.IO client · sonner.

## Quick start

```bash
cp .env.example .env     # VITE_API_PROXY_TARGET → address of the API
npm install
npm run dev              # http://localhost:5173
```

The dev server proxies `/api`, `/uploads` and `/socket.io` to the API, so the
browser always works with a single origin (exactly like production behind nginx).

```bash
npm run build            # type-check + production bundle in dist/
npm run lint
```

## Structure

```
src/
  api/          typed HTTP client (axios), endpoints per domain, query keys, response types
  app/          providers, router (lazy pages, auth + permission guards), query client
  components/
    ui/         design-system components (Button, Input, Select, DataTable, Modal, …)
    layout/     sidebar, top bar, navigation config
  features/     pages grouped by domain: pos, dashboard, menu, stock, reports,
                shifts, team, halls, settings, auth
  stores/       Zustand: auth session, UI preferences, carts, presence
  lib/          formatting, labels, permissions, realtime, printing
  hooks/        URL-synced list state, debounce, fullscreen
```

## Key decisions

* **Session** — the access token lives in memory only; the long-lived refresh
  token is an httpOnly cookie. On 401 the client refreshes once (single flight)
  and retries.
* **Server state** — TanStack Query; the API pushes `invalidate` events over
  Socket.IO, so every terminal refreshes only the data it shows (tables, orders,
  stock, menu…) a moment after any change made elsewhere.
* **Client state** — Zustand: unsent order lines per order (kept in
  `sessionStorage`, survive a reload), sidebar state, online staff.
* **Lists** — page, size, search, sort and filters live in the URL: refresh, back
  button and shared links reproduce the same view.
* **Design system** — all colours, radii and shadows are tokens in
  `src/index.css` (`@theme`). Brand: deep indigo-navy; semantic colours are used
  only with meaning (success, warning, danger).
* **Printing** — pre-check, receipt and kitchen tickets are 80 mm documents
  printed through a hidden iframe (works in Chrome kiosk mode with
  `--kiosk-printing` for silent printing).

## Permissions

The menu, routes and actions follow the permissions returned by `/api/auth/me`.
The API enforces the same rules, so hidden buttons are a convenience, never the
only protection.
