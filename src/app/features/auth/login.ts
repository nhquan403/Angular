import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { Alert } from '../../shared/alert';
import { AuthLayout } from './auth-layout';
import { safeReturnUrl } from './auth-form';

/** Tài khoản ADMIN mà BE tạo sẵn khi chạy profile dev (application-dev.properties). */
const DEV_ADMIN = { email: 'admin@example.com', password: 'Admin#12345' };

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    Alert,
    AuthLayout,
  ],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly endedReason = this.auth.endedReason;

  protected fillDevAdmin(): void {
    this.form.setValue(DEV_ADMIN);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email.trim(), password);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.message : 'Đăng nhập thất bại');
    } finally {
      this.submitting.set(false);
    }
  }
}
