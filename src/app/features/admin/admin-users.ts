import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { API_BASE_URL } from '../../core/config';
import { Page, Role, User } from '../../core/models';
import { ConfirmService } from '../../core/dialog/confirm-dialog';
import { ToastService } from '../../core/notify/toast-service';
import { Alert } from '../../shared/alert';

const PAGE_SIZE = 20;
const ROLES: readonly Role[] = ['USER', 'ADMIN'];

type LoadResult = { ok: true; page: Page<User> } | { ok: false; error: unknown };

/**
 * Quản lý người dùng, chỉ ADMIN vào được (adminGuard ở app.routes.ts và BE chặn /api/admin/** lần nữa).
 * Xem danh sách có phân trang và đổi role.
 */
@Component({
  selector: 'app-admin-users',
  imports: [
    DatePipe,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    Alert,
  ],
  templateUrl: './admin-users.html',
})
export class AdminUsers {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/admin/users`;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthStore);

  protected readonly roles = ROLES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly columns = ['id', 'email', 'role', 'createdAt'] as const;
  protected readonly page = signal<Page<User> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly changing = signal<number | null>(null);

  private readonly reload$ = new Subject<void>();

  constructor() {
    combineLatest([
      this.route.queryParamMap.pipe(map((params) => toPageIndex(params.get('page')))),
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([index]) => this.load(index)),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.loadError.set(null);
          this.page.set(result.page);
        } else {
          this.loadError.set(result.error instanceof ApiError ? result.error.message : 'Không tải được danh sách');
        }
      });
  }

  private load(index: number): Observable<LoadResult> {
    this.loading.set(true);
    const params = new HttpParams().set('page', index).set('size', PAGE_SIZE);
    return this.http.get<Page<User>>(this.url, { params }).pipe(
      map((page): LoadResult => ({ ok: true, page })),
      catchError((error: unknown) => of<LoadResult>({ ok: false, error })),
    );
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected onPage(event: PageEvent): void {
    this.goTo(event.pageIndex);
  }

  protected goTo(index: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: index === 0 ? null : index },
      queryParamsHandling: 'merge',
    });
  }

  /** BE từ chối tự đổi role của chính mình (tránh hệ thống không còn ADMIN), nên giao diện cũng khóa ô đó. */
  protected isSelf(user: User): boolean {
    return user.id === this.auth.user()?.id;
  }

  protected async changeRole(user: User, event: MatSelectChange<Role>): Promise<void> {
    const select = event.source;
    const role = event.value;
    if (role === user.role) {
      return;
    }
    const confirmed = await this.confirm.confirm({
      title: `Đổi role thành ${role}?`,
      message: `${user.email} sẽ bị đăng xuất khỏi mọi thiết bị và phải đăng nhập lại để nhận role mới.`,
      confirmText: 'Đổi role',
      icon: 'manage_accounts',
    });
    if (!confirmed) {
      select.value = user.role;
      return;
    }
    this.changing.set(user.id);
    this.http.patch<User>(`${this.url}/${user.id}/role`, { role }).subscribe({
      next: (updated) => {
        this.changing.set(null);
        this.page.update((page) =>
          page === null ? page : { ...page, content: page.content.map((u) => (u.id === updated.id ? updated : u)) },
        );
        this.toast.show('success', `${updated.email} giờ là ${updated.role}. Người này sẽ phải đăng nhập lại.`);
      },
      error: (error: unknown) => {
        this.changing.set(null);
        select.value = user.role; // trả ô chọn về giá trị cũ vì BE từ chối
        this.toast.error(error);
      },
    });
  }
}

function toPageIndex(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}
