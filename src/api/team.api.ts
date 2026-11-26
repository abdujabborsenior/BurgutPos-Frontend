import { del, get, patch, post } from './http';
import type {
  ArchiveStatus,
  ListParams,
  LoginEventType,
  LoginEventView,
  Paginated,
  PermissionGroup,
  RoleView,
  StatusCounts,
  UserOption,
  UserView,
} from './types';

export interface UserListParams extends ListParams {
  status?: ArchiveStatus;
  roleId?: number;
}

export interface UserInput {
  fullName: string;
  login: string;
  password?: string;
  phone?: string | null;
  roleId: number;
  isActive?: boolean;
}

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface LoginEventParams extends ListParams {
  type?: LoginEventType;
  userId?: number;
  /** Period bounds: "YYYY-MM-DD" or local "YYYY-MM-DDTHH:mm". */
  from?: string;
  to?: string;
  sortBy?: 'createdAt' | 'user';
}

export const usersApi = {
  list: (params: UserListParams) =>
    get<Paginated<UserView> & { counts: StatusCounts; permissionsTotal: number }>('/users', params),
  options: (permission?: string) => get<UserOption[]>('/users/options', { permission }),
  get: (id: number) => get<UserView>(`/users/${id}`),
  create: (input: UserInput) => post<UserView>('/users', input),
  update: (id: number, input: Partial<UserInput>) => patch<UserView>(`/users/${id}`, input),
  remove: (id: number) => del(`/users/${id}`),
};

export const rolesApi = {
  /** Every role: roles are not archived (one in use is kept, an unused one is deleted). */
  list: () => get<{ items: RoleView[] }>('/roles'),
  permissions: () => get<PermissionGroup[]>('/roles/permissions'),
  create: (input: RoleInput) => post<RoleView>('/roles', input),
  update: (id: number, input: Partial<RoleInput>) => patch<RoleView>(`/roles/${id}`, input),
  remove: (id: number) => del(`/roles/${id}`),
};

/** История входа. */
export const loginEventsApi = {
  list: (params: LoginEventParams) => get<Paginated<LoginEventView>>('/login-events', params),
};
