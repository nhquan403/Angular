import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError } from './api-error';
import { GlobalErrorHandler } from './error-handler';
import { ToastService } from './notify/toast-service';

describe('GlobalErrorHandler', () => {
  const show = vi.fn();
  const error = vi.fn();
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    show.mockReset();
    error.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler, { provide: ToastService, useValue: { show, error } }],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  afterEach(() => vi.restoreAllMocks());

  it('lỗi lạ: ghi console và báo câu chung cho người dùng', () => {
    handler.handleError(new TypeError('x is undefined'));
    expect(console.error).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith('error', expect.stringContaining('Đã có lỗi không mong muốn'));
  });

  it('lỗi API lọt tới đây thì báo bằng thông điệp của BE', () => {
    const apiError = new ApiError(500, 'Máy chủ lỗi');
    handler.handleError(apiError);
    expect(error).toHaveBeenCalledWith(apiError);
  });

  it('cùng một lỗi lặp lại liên tục chỉ báo một lần', () => {
    handler.handleError(new Error('a'));
    handler.handleError(new Error('b'));
    expect(show).toHaveBeenCalledTimes(1);
  });
});
