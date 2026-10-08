import { TodoQuery } from '../../core/models';

/**
 * Hợp đồng giữa FE và BE cho trợ lý AI (xem docs/assistant-backend.md).
 * BE gọi Claude, tự đọc todo của người dùng bằng tool, rồi stream câu trả lời về dạng Server-Sent Events.
 */

/** Một gợi ý todo do trợ lý đề xuất. Chỉ để điền vào form; người dùng vẫn phải tự bấm "Thêm". */
export interface TodoSuggestion {
  title: string;
  description: string | null;
}

/** Trang người dùng đang mở, gửi kèm mỗi câu hỏi để trợ lý trả lời đúng ngữ cảnh. */
export interface AssistantContext {
  page: 'todo-list' | 'todo-detail' | 'admin-users' | 'other';
  path: string;
  /** Bộ lọc đang áp dụng, chỉ có ở trang danh sách. */
  query: TodoQuery | null;
  /** Todo đang xem, chỉ có ở trang chi tiết. */
  todoId: number | null;
  /** Nội dung đang gõ dở trong form tạo todo (nếu có). */
  createDraft: TodoSuggestion | null;
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequest {
  messages: AssistantTurn[];
  context: AssistantContext;
}

/** Các sự kiện BE stream về. Sự kiện lạ hoặc hỏng bị bỏ qua (xem parseAssistantEvent). */
export type AssistantEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'suggestion'; suggestion: TodoSuggestion }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Một tin nhắn hiển thị trong khung chat. */
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Chỉ với tin của trợ lý. */
  status: 'streaming' | 'done' | 'error' | 'stopped';
  /** Trợ lý đang/đã dùng tool nào (để hiện "Đang đọc danh sách todo..."). */
  tools: string[];
  suggestions: TodoSuggestion[];
  error: string | null;
}
