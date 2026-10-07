/**
 * Kiểu dữ liệu khớp với DTO của BE (package adapter.in.web.dto).
 * Thời gian BE trả về là chuỗi ISO-8601 (java.time.Instant), ví dụ "2026-10-07T09:15:30Z".
 */

export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  role: Role;
  createdAt: string;
}

export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  /** Số phiên bản cho khóa lạc quan: gửi lại khi sửa để biết có ai sửa trước mình không (409). */
  version: number;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export const SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'id'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface TodoQuery {
  /** null = tất cả, true = đã xong, false = chưa xong. */
  completed: boolean | null;
  page: number;
  size: number;
  sortBy: SortField;
  direction: SortDirection;
}

export const TODO_EVENT_TYPES = ['CREATED', 'UPDATED', 'COMPLETED', 'REOPENED', 'DELETED'] as const;
export type TodoEventType = (typeof TODO_EVENT_TYPES)[number];

/** Sự kiện BE đẩy qua SSE / WebSocket (xem TodoEventJson). */
export interface TodoEvent {
  type: TodoEventType;
  todoId: number;
  ownerId: number | null;
  title: string | null;
  completed: boolean;
  occurredAt: string;
}

/** Giới hạn độ dài khớp với @Size trong CreateTodoRequest / UpdateTodoRequest. */
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;
