import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface TodoDraft {
  title: string;
  description: string | null;
}

/**
 * Cầu nối giữa form "Thêm todo" (trang danh sách) và những nơi khác cần đọc / điền form đó (trợ lý AI).
 * Hai chiều:
 *  - form -> ngoài: `draft` là nội dung đang gõ dở (trợ lý gửi kèm làm ngữ cảnh);
 *  - ngoài -> form: `fill()` đặt một bản nháp chờ; trang danh sách nhận và điền vào form.
 * Không tự tạo todo: người dùng xem lại rồi tự bấm "Thêm".
 */
@Injectable({ providedIn: 'root' })
export class TodoDraftBridge {
  private readonly router = inject(Router);

  /** Nội dung đang gõ trong form tạo (null khi form trống hoặc trang danh sách không mở). */
  readonly draft = signal<TodoDraft | null>(null);
  /** Bản nháp chờ được điền vào form. Trang danh sách đọc xong thì gọi `consume()`. */
  readonly pending = signal<TodoDraft | null>(null);

  /** Điền bản nháp vào form tạo; đang ở trang khác thì chuyển về danh sách trước. */
  fill(draft: TodoDraft): void {
    this.pending.set({ ...draft });
    const path = this.router.parseUrl(this.router.url).root.children['primary']?.segments.map((s) => s.path) ?? [];
    if (!(path.length === 1 && path[0] === 'todos')) {
      void this.router.navigate(['/todos']);
    }
  }

  consume(): TodoDraft | null {
    const draft = this.pending();
    this.pending.set(null);
    return draft;
  }
}
