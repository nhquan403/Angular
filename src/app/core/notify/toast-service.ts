import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiError, SessionExpiredError } from '../api-error';

export type ToastKind = 'info' | 'success' | 'error';

const PANEL_CLASS: Readonly<Record<ToastKind, string>> = {
  info: 'toast-info',
  success: 'toast-success',
  error: 'toast-error',
};

/** Thông báo nổi ngắn ở góc màn hình (Material snackbar). Tự biến mất sau vài giây. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  show(kind: ToastKind, message: string, durationMs = kind === 'error' ? 7000 : 4000): void {
    this.snackBar.open(message, 'Đóng', {
      duration: durationMs,
      panelClass: PANEL_CLASS[kind],
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      // Lỗi cần được trình đọc màn hình đọc ngay.
      politeness: kind === 'error' ? 'assertive' : 'polite',
    });
  }

  /** Hiện lỗi bất kỳ. Phiên hết hạn thì bỏ qua vì trang đăng nhập đã nói rõ lý do. */
  error(error: unknown): void {
    if (error instanceof SessionExpiredError) {
      return;
    }
    this.show('error', errorMessage(error));
  }
}

/** Câu thông báo cho người dùng, kèm mã yêu cầu (nếu có) để tra log phía server. */
export function errorMessage(error: unknown, fallback = 'Đã có lỗi không mong muốn'): string {
  if (error instanceof ApiError) {
    return error.requestId === null ? error.message : `${error.message} (mã yêu cầu: ${error.requestId})`;
  }
  return fallback;
}
