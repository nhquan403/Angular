import { HttpErrorResponse } from '@angular/common/http';

/** Tên header BE gắn vào mọi response (CorrelationIdFilter), có trong log của server. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Lỗi đã được "dịch" từ response của BE (định dạng RFC 9457 ProblemDetail).
 * Component chỉ cần làm việc với lớp này, không phải đọc HttpErrorResponse thô.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Lỗi theo từng ô nhập khi validate thất bại (400), ví dụ { title: "title must not be blank" }. */
    readonly fieldErrors: Readonly<Record<string, string>> = {},
    /** Mã yêu cầu để tra log phía server. */
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** status 0: trình duyệt không nhận được response nào (BE tắt, mất mạng, bị CORS chặn). */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** Refresh token bị từ chối hoặc hết hạn: phiên đã chết, phải đăng nhập lại. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    this.name = 'SessionExpiredError';
  }
}

const FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Không kết nối được tới máy chủ. Hãy kiểm tra BE đã chạy chưa và CORS đã cho phép trang này chưa.',
  400: 'Dữ liệu gửi lên không hợp lệ',
  401: 'Bạn cần đăng nhập',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu',
  409: 'Dữ liệu xung đột với thay đổi khác',
  429: 'Quá nhiều yêu cầu, hãy thử lại sau',
};

export function toApiError(response: HttpErrorResponse): ApiError {
  const body = parseJsonText(response.error);
  let detail: string | null = null;
  let fieldErrors: Record<string, string> = {};

  if (body !== null && typeof body === 'object') {
    const problem = body as { detail?: unknown; errors?: unknown };
    if (typeof problem.detail === 'string' && problem.detail !== '') {
      detail = problem.detail;
    }
    if (problem.errors !== null && typeof problem.errors === 'object') {
      fieldErrors = Object.fromEntries(
        Object.entries(problem.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      );
    }
  }

  const message = detail ?? FALLBACK_MESSAGES[response.status] ?? `Lỗi không xác định (HTTP ${response.status})`;
  return new ApiError(response.status, message, fieldErrors, response.headers?.get(REQUEST_ID_HEADER) ?? null);
}

/** Request dùng `responseType: 'text'` (ví dụ stream của trợ lý) nhận body lỗi dạng chuỗi: thử đọc JSON. */
function parseJsonText(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}
