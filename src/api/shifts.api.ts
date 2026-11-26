import { get, post } from './http';
import type {
  CashOperationType,
  ListParams,
  Paginated,
  ShiftDetail,
  ShiftListRow,
  ShiftStatus,
  ShiftStatusView,
} from './types';

export interface ShiftListParams extends ListParams {
  status?: ShiftStatus;
  from?: string;
  to?: string;
}

export const shiftsApi = {
  status: () => get<ShiftStatusView | null>('/shifts/current/status'),
  current: () => get<ShiftDetail | null>('/shifts/current'),
  open: (openingCash: number, comment?: string) => post<ShiftDetail>('/shifts/open', { openingCash, comment }),
  close: (closingCash: number, comment?: string) =>
    post<ShiftDetail>('/shifts/current/close', { closingCash, comment }),
  cashOperation: (input: { type: CashOperationType; amount: number; comment: string }) =>
    post<ShiftDetail>('/shifts/current/cash-operations', input),
  list: (params: ShiftListParams) => get<Paginated<ShiftListRow>>('/shifts', params),
  get: (id: number) => get<ShiftDetail>(`/shifts/${id}`),
};
