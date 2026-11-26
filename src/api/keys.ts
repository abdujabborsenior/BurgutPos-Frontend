/**
 * Query-key registry. Realtime invalidations map server scopes onto these
 * prefixes (see lib/realtime.ts), so every key starts with its scope root.
 */
export const qk = {
  auth: ['auth'] as const,
  receiptLines: ['settings', 'receipt-lines'] as const,
  settings: ['settings'] as const,
  shiftStatus: ['shifts', 'status'] as const,
  shiftCurrent: ['shifts', 'current'] as const,
  shifts: (params: object) => ['shifts', 'list', params] as const,
  shift: (id: number) => ['shifts', 'detail', id] as const,

  board: ['pos', 'board'] as const,
  counters: ['pos', 'counters'] as const,
  posMenu: ['pos', 'menu'] as const,

  orders: (params: object) => ['orders', 'list', params] as const,
  order: (id: number) => ['orders', 'detail', id] as const,

  users: (params: object) => ['users', 'list', params] as const,
  userOptions: (permission?: string) => ['users', 'options', permission ?? 'all'] as const,
  roles: () => ['roles', 'list'] as const,
  loginEvents: (params: object) => ['login-events', params] as const,
  permissionCatalog: ['roles', 'permissions'] as const,

  halls: (status: string) => ['halls', 'list', status] as const,
  hallOptions: ['halls', 'options'] as const,
  tables: (params: object) => ['tables', 'list', params] as const,
  tableOptions: ['tables', 'options'] as const,

  printers: (status: string) => ['printers', 'list', status] as const,
  printerOptions: ['printers', 'options'] as const,
  paymentMethods: (status: string) => ['payment-methods', 'list', status] as const,
  paymentMethodOptions: ['payment-methods', 'options'] as const,

  categories: (params: object) => ['categories', 'list', params] as const,
  categoryOptions: ['categories', 'options'] as const,
  dishes: (params: object) => ['dishes', 'list', params] as const,
  dish: (id: number) => ['dishes', 'detail', id] as const,
  dishOptions: ['dishes', 'options'] as const,

  ingredients: (params: object) => ['ingredients', 'list', params] as const,
  ingredientOptions: ['ingredients', 'options'] as const,
  balance: (params: object) => ['stock', 'balance', params] as const,
  receipts: (params: object) => ['stock', 'receipts', params] as const,
  movements: (params: object) => ['stock', 'movements', params] as const,

  dashboard: (part: string, params: object) => ['dashboard', part, params] as const,
  report: (kind: string, params: object) => ['reports', kind, params] as const,
};
