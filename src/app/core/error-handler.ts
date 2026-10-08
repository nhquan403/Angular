import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { ApiError } from './api-error';
import { ToastService } from './notify/toast-service';

/** Hai lỗi giống nhau trong khoảng này chỉ báo một lần, tránh ngập thông báo khi lỗi lặp trong vòng render. */
const DEDUPE_MS = 3_000;

/**
 * Bắt mọi lỗi chưa được xử lý (lỗi trong template, promise bị bỏ quên...).
 * Ghi ra console cho lập trình viên và báo nhẹ cho người dùng thay vì để màn hình "chết" im lặng.
 * Lỗi ApiError thường đã được màn hình xử lý; lọt tới đây thì vẫn báo bằng thông điệp của BE.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  // Lấy ToastService lúc cần: ErrorHandler được tạo rất sớm, tiêm trực tiếp dễ gây vòng phụ thuộc.
  private readonly injector = inject(Injector);
  private lastMessage = '';
  private lastAt = 0;

  handleError(error: unknown): void {
    console.error(error);
    const message =
      error instanceof ApiError
        ? error.message
        : 'Đã có lỗi không mong muốn. Hãy tải lại trang nếu ứng dụng không phản hồi.';
    const now = Date.now();
    if (message === this.lastMessage && now - this.lastAt < DEDUPE_MS) {
      return;
    }
    this.lastMessage = message;
    this.lastAt = now;
    try {
      const toast = this.injector.get(ToastService);
      if (error instanceof ApiError) {
        toast.error(error);
      } else {
        toast.show('error', message);
      }
    } catch {
      /* đang khởi động, chưa hiện được thông báo */
    }
  }
}
