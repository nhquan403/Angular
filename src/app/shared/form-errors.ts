import { AbstractControl } from '@angular/forms';

/**
 * Gắn lỗi BE trả về theo từng ô (ProblemDetail `errors`) vào đúng FormControl dưới khóa `server`,
 * để mat-error hiện ngay dưới ô đó. Lỗi tự mất khi người dùng sửa ô (validator chạy lại).
 * Trả về true nếu gắn được ít nhất một lỗi.
 */
export function applyServerErrors(form: AbstractControl, errors: Readonly<Record<string, string>>): boolean {
  let applied = false;
  for (const [field, message] of Object.entries(errors)) {
    const control = form.get(field);
    if (control !== null) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
