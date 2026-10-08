import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { Alert } from '../../shared/alert';
import { AuthLayout } from './auth-layout';
import { applyServerErrors } from '../../shared/form-errors';
import { confirmPasswordMatcher, passwordsMatch } from './auth-form';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    Alert,
    AuthLayout,
  ],
  templateUrl: './register.html',
})
export class Register {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly confirmMatcher = confirmPasswordMatcher;

  /** Luật khớp với RegisterRequest của BE: email hợp lệ tối đa 254 ký tự, mật khẩu 8 đến 72 ký tự. */
  protected readonly form = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN), Validators.maxLength(PASSWORD_MAX)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      // Đăng ký xong đăng nhập luôn, người dùng khỏi phải nhập lại.
      await this.auth.register(email.trim(), password);
      await this.router.navigateByUrl('/todos');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        applyServerErrors(this.form, { email: error.message });
      } else if (!(error instanceof ApiError) || !applyServerErrors(this.form, error.fieldErrors)) {
        this.error.set(error instanceof ApiError ? error.message : 'Đăng ký thất bại');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
