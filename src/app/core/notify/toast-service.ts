import { Injectable, signal } from '@angular/core';
import { ApiError, SessionExpiredError } from '../api-error';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Thông báo nổi ngắn ở góc màn hình. Tự biến mất sau vài giây. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly list = signal<readonly Toast[]>([]);
  readonly toasts = this.list.asReadonly();

  show(kind: ToastKind, message: string, durationMs = kind === 'error' ? 7000 : 4000): void {
    const id = this.nextId++;
    this.list.update((items) => [...items.slice(-4), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  /** Hiện lỗi bất kỳ. Phiên hết hạn thì bỏ qua vì trang đăng nhập đã nói rõ lý do. */
  error(error: unknown): void {
    if (error instanceof SessionExpiredError) {
      return;
    }
    if (error instanceof ApiError) {
      const suffix = error.requestId === null ? '' : ` (mã yêu cầu: ${error.requestId})`;
      this.show('error', error.message + suffix);
      return;
    }
    this.show('error', 'Đã có lỗi không mong muốn');
  }

  dismiss(id: number): void {
    this.list.update((items) => items.filter((toast) => toast.id !== id));
  }
}
