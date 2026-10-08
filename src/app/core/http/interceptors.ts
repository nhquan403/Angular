import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { toApiError } from '../api-error';
import { AuthStore } from '../auth/auth-store';
import { API_BASE_URL } from '../config';

/**
 * Interceptor là "middleware" của HttpClient: mọi request/response đi qua đây.
 *
 * Thứ tự đăng ký (app.config.ts): errorInterceptor ngoài cùng, authInterceptor ở trong.
 * Nhờ vậy authInterceptor thấy lỗi HTTP thô để xử lý 401, còn component chỉ thấy ApiError sạch.
 */

/** Đổi HttpErrorResponse thành ApiError (đọc ProblemDetail của BE). */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => throwError(() => (error instanceof HttpErrorResponse ? toApiError(error) : error))),
  );

/**
 * Gắn "Authorization: Bearer <access token>" và tự xử lý token hết hạn:
 *  - token sắp hết hạn: làm mới TRƯỚC khi gửi;
 *  - vẫn nhận 401: làm mới rồi gửi lại ĐÚNG MỘT lần;
 *  - làm mới thất bại vì refresh token chết: AuthStore đưa người dùng về trang đăng nhập.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const apiBase = inject(API_BASE_URL);

  if (!req.url.startsWith(apiBase) || isPublicAuthEndpoint(req, apiBase)) {
    return next(req);
  }

  return from(auth.getFreshAccessToken()).pipe(
    switchMap((token) =>
      next(withBearer(req, token)).pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401 && token !== null) {
            return from(auth.refresh(token)).pipe(switchMap((fresh) => next(withBearer(req, fresh.accessToken))));
          }
          return throwError(() => error);
        }),
      ),
    ),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token === null ? req : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** register, login, refresh, logout mở công khai. Riêng /me cần token nên không nằm trong nhóm này. */
function isPublicAuthEndpoint(req: HttpRequest<unknown>, apiBase: string): boolean {
  const prefix = `${apiBase}/api/auth/`;
  return req.url.startsWith(prefix) && !req.url.startsWith(`${prefix}me`);
}
