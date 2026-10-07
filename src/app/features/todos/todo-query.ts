import { ParamMap } from '@angular/router';
import { SORT_FIELDS, SortDirection, SortField, TodoQuery } from '../../core/models';

export const PAGE_SIZES = [10, 20, 50] as const;

export const DEFAULT_QUERY: TodoQuery = {
  completed: null,
  page: 0,
  size: 10,
  sortBy: 'createdAt',
  direction: 'desc',
};

/**
 * Bộ lọc, sắp xếp, phân trang nằm trên URL (?page=1&completed=false&...) để F5 không mất,
 * gửi link cho người khác vẫn thấy đúng, và nút Back của trình duyệt hoạt động.
 * Giá trị lạ trên URL bị đưa về mặc định, vì BE trả 400 khi tham số sai.
 */
export function parseTodoQuery(params: ParamMap): TodoQuery {
  const completed = params.get('completed');
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sortBy = params.get('sortBy');
  const direction = params.get('direction');

  return {
    completed: completed === 'true' ? true : completed === 'false' ? false : null,
    page: Number.isInteger(page) && page >= 0 ? page : DEFAULT_QUERY.page,
    size: PAGE_SIZES.find((s) => s === size) ?? DEFAULT_QUERY.size,
    sortBy: SORT_FIELDS.find((f): f is SortField => f === sortBy) ?? DEFAULT_QUERY.sortBy,
    direction: direction === 'asc' || direction === 'desc' ? (direction as SortDirection) : DEFAULT_QUERY.direction,
  };
}

/** Chỉ ghi lên URL những giá trị khác mặc định để địa chỉ ngắn gọn. */
export function toQueryParams(query: TodoQuery): Record<string, string | null> {
  return {
    completed: query.completed === null ? null : String(query.completed),
    page: query.page === DEFAULT_QUERY.page ? null : String(query.page),
    size: query.size === DEFAULT_QUERY.size ? null : String(query.size),
    sortBy: query.sortBy === DEFAULT_QUERY.sortBy ? null : query.sortBy,
    direction: query.direction === DEFAULT_QUERY.direction ? null : query.direction,
  };
}
