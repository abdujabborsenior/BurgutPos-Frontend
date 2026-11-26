import { del, get, patch, post } from './http';
import type {
  ArchiveStatus,
  HallView,
  ListParams,
  Option,
  Paginated,
  StatusCounts,
  TableOption,
  TableView,
} from './types';

export interface HallInput {
  /** null → the service charge of the settings applies. */
  servicePercent?: number | null;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TableListParams extends ListParams {
  status?: ArchiveStatus;
  hallId?: number;
}

export interface TableInput {
  hallId: number;
  name: string;
  seats?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const hallsApi = {
  list: (status: ArchiveStatus = 'active') => get<HallView[]>('/halls', { status }),
  options: () => get<Option[]>('/halls/options'),
  create: (input: HallInput) => post<HallView>('/halls', input),
  update: (id: number, input: Partial<HallInput>) => patch<HallView>(`/halls/${id}`, input),
  remove: (id: number) => del(`/halls/${id}`),
};

export const tablesApi = {
  list: (params: TableListParams) =>
    get<Paginated<TableView> & { counts: StatusCounts }>('/tables', params),
  options: () => get<TableOption[]>('/tables/options'),
  create: (input: TableInput) => post<TableView>('/tables', input),
  bulkCreate: (input: { hallId: number; prefix: string; from: number; to: number; seats?: number | null }) =>
    post<{ created: number; skipped: number }>('/tables/bulk', input),
  update: (id: number, input: Partial<TableInput>) => patch<TableView>(`/tables/${id}`, input),
  remove: (id: number) => del(`/tables/${id}`),
};
