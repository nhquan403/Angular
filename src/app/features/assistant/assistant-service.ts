import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AssistantApi } from './assistant-api';
import { AssistantEvent, AssistantTurn, ChatMessage } from './assistant-models';
import { PageContext } from './page-context';

/** Chỉ gửi chừng này tin gần nhất lên BE: đủ ngữ cảnh mà không phình request (BE cũng tự giới hạn). */
export const MAX_HISTORY = 20;
export const MAX_INPUT = 2000;

/**
 * Trạng thái của khung chat: danh sách tin nhắn, đang mở hay đóng, đang chờ trả lời hay không.
 * Mỗi lần gửi: chụp ngữ cảnh trang, gửi lịch sử gần nhất, rồi ghép từng mẩu trả lời vào tin của trợ lý.
 * Lịch sử chỉ nằm trong bộ nhớ của tab (tải lại trang là mất), không lưu lên server.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly api = inject(AssistantApi);
  private readonly context = inject(PageContext);

  readonly open = signal(false);
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly busy = computed(() => this.messages().some((m) => m.status === 'streaming'));
  /** Có tin trả lời mới khi khung chat đang đóng: hiện chấm báo trên nút chat. */
  readonly unread = signal(false);

  private nextId = 1;
  private running: Subscription | null = null;

  toggle(): void {
    this.setOpen(!this.open());
  }

  setOpen(open: boolean): void {
    this.open.set(open);
    if (open) {
      this.unread.set(false);
    }
  }

  send(raw: string): void {
    const text = raw.trim().slice(0, MAX_INPUT);
    if (text === '' || this.busy()) {
      return;
    }
    const history: AssistantTurn[] = this.messages()
      .filter((m) => m.status !== 'error' && m.text.trim() !== '')
      .map((m) => ({ role: m.role, content: m.text }));
    history.push({ role: 'user', content: text });

    const user = this.create('user', text, 'done');
    const reply = this.create('assistant', '', 'streaming');
    this.messages.update((list) => [...list, user, reply]);

    this.running = this.api.chat({ messages: trimHistory(history), context: this.context.snapshot() }).subscribe({
      next: (event) => this.apply(reply.id, event),
      error: (error: unknown) => this.fail(reply.id, describe(error)),
      complete: () => this.finish(reply.id),
    });
  }

  /** Dừng câu trả lời đang chạy (hủy request); phần đã nhận được giữ lại. */
  stop(): void {
    this.running?.unsubscribe();
    this.running = null;
    this.patchStreaming((m) => ({ ...m, status: 'stopped' }));
  }

  /** Gửi lại câu hỏi cuối cùng (sau khi lỗi). */
  retry(): void {
    const list = this.messages();
    const lastUser = [...list].reverse().find((m) => m.role === 'user');
    if (lastUser === undefined || this.busy()) {
      return;
    }
    // Bỏ câu hỏi đó và câu trả lời lỗi của nó rồi gửi lại như mới.
    this.messages.set(list.filter((m) => m.id < lastUser.id));
    this.send(lastUser.text);
  }

  clear(): void {
    this.stop();
    this.messages.set([]);
  }

  // ---------- nội bộ ----------

  private apply(id: number, event: AssistantEvent): void {
    switch (event.type) {
      case 'delta':
        this.patch(id, (m) => ({ ...m, text: m.text + event.text }));
        break;
      case 'tool':
        this.patch(id, (m) => (m.tools.includes(event.name) ? m : { ...m, tools: [...m.tools, event.name] }));
        break;
      case 'suggestion':
        this.patch(id, (m) => ({ ...m, suggestions: [...m.suggestions, event.suggestion] }));
        break;
      case 'error':
        this.fail(id, event.message);
        break;
      case 'done':
        this.finish(id);
        break;
    }
  }

  private finish(id: number): void {
    this.running = null;
    this.patch(id, (m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m));
    if (!this.open()) {
      this.unread.set(true);
    }
  }

  private fail(id: number, message: string): void {
    this.running?.unsubscribe();
    this.running = null;
    this.patch(id, (m) => ({ ...m, status: 'error', error: message }));
  }

  private create(role: ChatMessage['role'], text: string, status: ChatMessage['status']): ChatMessage {
    return { id: this.nextId++, role, text, status, tools: [], suggestions: [], error: null };
  }

  private patch(id: number, change: (message: ChatMessage) => ChatMessage): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? change(m) : m)));
  }

  private patchStreaming(change: (message: ChatMessage) => ChatMessage): void {
    this.messages.update((list) => list.map((m) => (m.status === 'streaming' ? change(m) : m)));
  }
}

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'Trợ lý AI chưa được bật trên máy chủ (thiếu /api/assistant/chat).';
    }
    if (error.status === 429) {
      return 'Bạn hỏi hơi nhanh, hãy chờ một chút rồi thử lại.';
    }
    return error.message;
  }
  return 'Không nhận được câu trả lời từ trợ lý.';
}

/** Giữ MAX_HISTORY tin gần nhất và bảo đảm tin đầu tiên là của người dùng (Messages API yêu cầu vậy). */
export function trimHistory(history: readonly AssistantTurn[]): AssistantTurn[] {
  const recent = history.slice(-MAX_HISTORY);
  const firstUser = recent.findIndex((turn) => turn.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}
