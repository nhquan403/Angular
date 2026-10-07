import { AbstractControl, ValidationErrors } from '@angular/forms';

/** BE dùng @NotBlank: chuỗi toàn khoảng trắng cũng bị từ chối. */
export function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string | null;
  return value !== null && value.trim() === '' ? { blank: true } : null;
}
