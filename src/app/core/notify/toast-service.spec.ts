import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { ApiError, SessionExpiredError } from '../api-error';
import { ToastService, errorMessage } from './toast-service';

describe('ToastService', () => {
  let open: ReturnType<typeof vi.fn>;
  let toast: ToastService;

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: { open } }] });
    toast = TestBed.inject(ToastService);
  });

  it('hiện snackbar theo loại, lỗi đọc ngay (assertive) và lâu hơn', () => {
    toast.show('success', 'Đã lưu');
    expect(open).toHaveBeenCalledWith(
      'Đã lưu',
      'Đóng',
      expect.objectContaining({ panelClass: 'toast-success', duration: 4000 }),
    );
    toast.show('error', 'Hỏng');
    expect(open).toHaveBeenLastCalledWith(
      'Hỏng',
      'Đóng',
      expect.objectContaining({ panelClass: 'toast-error', duration: 7000, politeness: 'assertive' }),
    );
  });

  it('lỗi API kèm mã yêu cầu; phiên hết hạn thì không báo', () => {
    toast.error(new ApiError(404, 'Todo 7 not found', {}, 'abc-123'));
    expect(open).toHaveBeenCalledWith('Todo 7 not found (mã yêu cầu: abc-123)', 'Đóng', expect.anything());
    open.mockClear();
    toast.error(new SessionExpiredError());
    expect(open).not.toHaveBeenCalled();
  });

  it('errorMessage dùng câu mặc định cho lỗi không phải của API', () => {
    expect(errorMessage(new Error('boom'))).toBe('Đã có lỗi không mong muốn');
    expect(errorMessage(new ApiError(409, 'Xung đột'))).toBe('Xung đột');
  });
});
