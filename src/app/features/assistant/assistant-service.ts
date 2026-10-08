import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AssistantApi } from './assistant-api';
import { AssistantEvent, AssistantTurn, ChatMessage } from './assistant-models';
import { PageContext } from './page-context';
import {
  DEFAULT_TYPEWRITER,
  FrameScheduler,
  Typewriter,
  TypewriterOptions,
  animationFrameScheduler,
} from './typewriter';

/** Cách hiện chữ của trợ lý. Mặc định gõ dần; người dùng bật "giảm chuyển động" thì hiện ngay. Test có thể thay. */
export const ASSISTANT_TYPING = new InjectionToken<{ scheduler: FrameScheduler; options: TypewriterOptions }>(
  'ASSISTANT_TYPING',
  {
    providedIn: 'root',
    factory: () => ({
      scheduler: animationFrameScheduler,
      options: {
        ...DEFAULT_TYPEWRITER,
        instant: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    }),
  },
);

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
  private readonly typing = inject(ASSISTANT_TYPING);

  readonly open = signal(false);
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly busy = computed(() => this.messages().some((m) => m.status === 'streaming'));
  /** Có tin trả lời mới khi khung chat đang đóng: hiện chấm báo trên nút chat. */
  readonly unread = signal(false);

  private nextId = 1;
  private running: Subscription | null = null;
  /** Bộ gõ chữ của câu trả lời đang chạy. Chữ, thẻ gợi ý và trạng thái "xong" đều đi qua nó để giữ đúng thứ tự. */
  private typewriter: Typewriter | null = null;

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

    this.typewriter?.dispose();
    this.typewriter = new Typewriter(
      (visible) => this.patch(reply.id, (m) => ({ ...m, text: visible })),
      this.typing.scheduler,
      this.typing.options,
    );
    this.running = this.api.chat({ messages: trimHistory(history), context: this.context.snapshot() }).subscribe({
      next: (event) => this.apply(reply.id, event),
      error: (error: unknown) => this.fail(reply.id, describe(error)),
      complete: () => this.finish(reply.id),
    });
  }

  /** Dừng câu trả lời đang chạy (hủy request); phần đã nhận được hiện ra hết và giữ lại. */
  stop(): void {
    this.running?.unsubscribe();
    this.running = null;
    this.typewriter?.flush();
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
    this.running?.unsubscribe();
    this.running = null;
    this.typewriter?.dispose();
    this.typewriter = null;
    this.messages.set([]);
  }

  // ---------- nội bộ ----------

  private apply(id: number, event: AssistantEvent): void {
    const typewriter = this.typewriter;
    if (typewriter === null) {
      return;
    }
    switch (event.type) {
      case 'delta':
        typewriter.push(event.text);
        break;
      case 'tool':
        typewriter.after(() =>
          this.patch(id, (m) => (m.tools.includes(event.name) ? m : { ...m, tools: [...m.tools, event.name] })),
        );
        break;
      case 'suggestion':
        // Thẻ gợi ý hiện sau đoạn chữ đứng trước nó, không "nhảy" lên trước khi chữ gõ xong.
        typewriter.after(() => this.patch(id, (m) => ({ ...m, suggestions: [...m.suggestions, event.suggestion] })));
        break;
      case 'error':
        this.fail(id, event.message);
        break;
      case 'done':
        this.finish(id);
        break;
    }
  }

  /** Hết dữ liệu: đánh dấu xong khi chữ đã gõ hết (vẫn đang gõ thì con trỏ nhấp nháy tiếp). */
  private finish(id: number): void {
    this.running = null;
    const typewriter = this.typewriter;
    const complete = () => {
      this.patch(id, (m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m));
      if (!this.open()) {
        this.unread.set(true);
      }
    };
    if (typewriter === null) {
      complete();
    } else {
      typewriter.after(complete);
    }
  }

  private fail(id: number, message: string): void {
    this.running?.unsubscribe();
    this.running = null;
    this.typewriter?.flush();
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
