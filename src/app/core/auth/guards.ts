import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';
import { ToastService } from '../notify/toast-service';

/**
 * Guard là hàm chạy TRƯỚC khi vào một route: trả true để cho vào, hoặc UrlTree để chuyển hướng.
 *
 * Chú ý: guard chỉ giúp trải nghiệm tốt hơn (khỏi thấy trang rồi mới bị 403). Bảo mật thật nằm ở BE,
 * vì ai cũng có thể sửa JavaScript trong trình duyệt của chính họ.
 */

/** Cần đăng nhập. Chưa thì chuyển tới /login và nhớ lại trang định vào. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if ((await auth.ensureUser()) !== null) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Trang chỉ dành cho khách (đăng nhập, đăng ký). Đã đăng nhập rồi thì vào thẳng danh sách. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return (await auth.ensureUser()) === null ? true : router.createUrlTree(['/todos']);
};

/** Trang dành cho ADMIN. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(ToastService);
  const user = await auth.ensureUser();
  if (user?.role === 'ADMIN') {
    return true;
  }
  toast.show('error', 'Chỉ ADMIN mới vào được trang này');
  return router.createUrlTree(['/todos']);
};
