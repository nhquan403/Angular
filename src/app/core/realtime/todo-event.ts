import { TODO_EVENT_TYPES, TodoEvent } from '../models';

/**
 * Đọc một tin nhắn từ SSE / WebSocket thành TodoEvent. Trả null nếu không đúng định dạng,
 * để một tin lạ không làm hỏng cả luồng.
 */
export function parseTodoEvent(raw: string): TodoEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const e = value as Record<string, unknown>;
  const type = TODO_EVENT_TYPES.find((t) => t === e['type']);
  if (
    type === undefined ||
    typeof e['todoId'] !== 'number' ||
    typeof e['completed'] !== 'boolean' ||
    typeof e['occurredAt'] !== 'string'
  ) {
    return null;
  }
  return {
    type,
    todoId: e['todoId'],
    ownerId: typeof e['ownerId'] === 'number' ? e['ownerId'] : null,
    title: typeof e['title'] === 'string' ? e['title'] : null,
    completed: e['completed'],
    occurredAt: e['occurredAt'],
  };
}
