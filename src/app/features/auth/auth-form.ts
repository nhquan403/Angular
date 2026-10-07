import { AbstractControl, FormGroupDirective, NgForm, ValidationErrors } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/** Mật khẩu nhập lại phải khớp (chỉ kiểm tra ở client, BE không nhận trường này). */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string | undefined;
  const confirm = group.get('confirm')?.value as string | undefined;
  return password === confirm ? null : { mismatch: true };
}

/** Ô "nhập lại mật khẩu" đỏ cả khi lỗi nằm ở cấp form (mismatch), không chỉ lỗi của riêng ô đó. */
export const confirmPasswordMatcher: ErrorStateMatcher = {
  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const touched = control?.touched === true || form?.submitted === true;
    return touched && (control?.invalid === true || form?.hasError('mismatch') === true);
  },
};

/** Lấy returnUrl từ query string, chỉ nhận đường dẫn nội bộ để tránh bị lợi dụng chuyển hướng ra trang ngoài. */
export function safeReturnUrl(value: string | null): string {
  return value !== null && value.startsWith('/') && !value.startsWith('//') ? value : '/todos';
}
