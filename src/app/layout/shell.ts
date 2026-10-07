import { Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from '../core/auth/auth-store';
import { API_BASE_URL } from '../core/config';
import { RealtimeService, RealtimeTransport } from '../core/realtime/realtime-service';
import { RealtimeBadge } from './realtime-badge';
import { ThemeToggle } from './theme-toggle';

/**
 * Khung chung của mọi trang cần đăng nhập: thanh điều hướng + chỗ hiển thị trang con.
 *
 * Vì Shell chỉ tồn tại khi đã đăng nhập, ta mở kết nối thời gian thực khi Shell được tạo
 * và đóng khi Shell bị hủy (đăng xuất, hết phiên). Không cần theo dõi trạng thái đăng nhập ở chỗ khác.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressBarModule,
    RealtimeBadge,
    ThemeToggle,
  ],
  templateUrl: './shell.html',
  host: { class: 'flex min-h-dvh flex-col' },
  styles: `
    .toolbar {
      --mat-toolbar-container-background-color: color-mix(in srgb, var(--mat-sys-surface) 88%, transparent);
    }
    .nav a.active {
      color: var(--mat-sys-on-secondary-container);
      background: var(--mat-sys-secondary-container);
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly swaggerUrl = `${inject(API_BASE_URL)}/swagger-ui.html`;
  protected readonly year = new Date().getFullYear();
  protected readonly realtime = inject(RealtimeService);
  protected readonly transports: readonly { value: RealtimeTransport; label: string }[] = [
    { value: 'sse', label: 'SSE' },
    { value: 'ws', label: 'WebSocket' },
  ];

  /** Đang chuyển trang (tải lười mã trang, chạy guard): hiện thanh tiến trình mảnh ở trên cùng. */
  protected readonly navigating = toSignal(
    inject(Router).events.pipe(
      filter(
        (e) =>
          e instanceof NavigationStart ||
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError,
      ),
      map((e) => e instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  protected readonly initial = computed(() => this.auth.user()?.email.charAt(0).toUpperCase() ?? '?');

  constructor() {
    this.realtime.start();
    inject(DestroyRef).onDestroy(() => this.realtime.stop());
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
