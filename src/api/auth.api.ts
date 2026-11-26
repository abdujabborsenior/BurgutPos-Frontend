import { get, post } from './http';
import type { AuthResponse, Profile } from './types';

export const authApi = {
  login: (login: string, password: string) => post<AuthResponse>('/auth/login', { login, password }),
  logout: () => post<void>('/auth/logout'),
  me: () => get<Profile>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>('/auth/password', { currentPassword, newPassword }),
};
