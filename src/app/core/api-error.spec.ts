import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('đọc detail và mã yêu cầu từ ProblemDetail của BE', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 404,
        error: { type: 'about:blank', status: 404, detail: 'Todo 7 not found' },
        headers: new HttpHeaders({ 'X-Request-Id': 'abc-123' }),
      }),
    );
    expect(error.status).toBe(404);
    expect(error.message).toBe('Todo 7 not found');
    expect(error.requestId).toBe('abc-123');
  });

  it('lấy lỗi theo từng ô khi validate thất bại', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: { detail: 'Validation failed', errors: { title: 'title must not be blank', bad: 5 } },
      }),
    );
    expect(error.fieldErrors).toEqual({ title: 'title must not be blank' });
  });

  it('status 0 nghĩa là không kết nối được máy chủ', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(error.isNetwork).toBe(true);
    expect(error.message).toContain('Không kết nối được');
  });

  it('không có detail thì dùng thông báo mặc định theo mã lỗi', () => {
    expect(toApiError(new HttpErrorResponse({ status: 403, error: 'Forbidden' })).message).toContain('quyền');
    expect(toApiError(new HttpErrorResponse({ status: 418 })).message).toContain('418');
  });

  it('body lỗi là chuỗi JSON (request responseType text) vẫn đọc được ProblemDetail', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 429, error: JSON.stringify({ detail: 'Bạn hỏi quá nhanh, chờ chút nhé' }) }),
    );
    expect(error.message).toBe('Bạn hỏi quá nhanh, chờ chút nhé');
    expect(toApiError(new HttpErrorResponse({ status: 404, error: 'not json' })).message).toBe(
      'Không tìm thấy dữ liệu',
    );
  });
});
