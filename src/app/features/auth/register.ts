import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { passwordsMatch, showError } from './auth-form';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './auth.css',
})
export class Register {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** Luật khớp với RegisterRequest của BE: email hợp lệ tối đa 254 ký tự, mật khẩu 8 đến 72 ký tự. */
  protected readonly form = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Lỗi BE trả về theo từng ô, ví dụ email đã được dùng. */
  protected readonly serverErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly showError = showError;

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.serverErrors.set({});
    const { email, password } = this.form.getRawValue();
    try {
      // Đăng ký xong đăng nhập luôn, người dùng khỏi phải nhập lại.
      await this.auth.register(email.trim(), password);
      await this.router.navigateByUrl('/todos');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.serverErrors.set({ email: error.message });
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        this.serverErrors.set(error.fieldErrors);
      } else {
        this.error.set(error instanceof ApiError ? error.message : 'Đăng ký thất bại');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
