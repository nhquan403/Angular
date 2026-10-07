import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Dùng chung cho form đăng nhập/đăng ký: ô nào đã chạm vào mà sai thì hiện lỗi. */
export function showError(control: AbstractControl, serverMessage?: string): boolean {
  return (control.invalid && (control.touched || control.dirty)) || serverMessage !== undefined;
}

/** Mật khẩu nhập lại phải khớp (chỉ kiểm tra ở client, BE không nhận trường này). */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string | undefined;
  const confirm = group.get('confirm')?.value as string | undefined;
  return password === confirm ? null : { mismatch: true };
}

/** Lấy returnUrl từ query string, chỉ nhận đường dẫn nội bộ để tránh bị lợi dụng chuyển hướng ra trang ngoài. */
export function safeReturnUrl(value: string | null): string {
  return value !== null && value.startsWith('/') && !value.startsWith('//') ? value : '/todos';
}
