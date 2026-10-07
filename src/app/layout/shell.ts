import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth/auth-store';
import { API_BASE_URL } from '../core/config';
import { RealtimeService } from '../core/realtime/realtime-service';
import { RealtimeBadge } from './realtime-badge';

/**
 * Khung chung của mọi trang cần đăng nhập: thanh điều hướng + chỗ hiển thị trang con.
 *
 * Vì Shell chỉ tồn tại khi đã đăng nhập, ta mở kết nối thời gian thực khi Shell được tạo
 * và đóng khi Shell bị hủy (đăng xuất, hết phiên). Không cần theo dõi trạng thái đăng nhập ở chỗ khác.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RealtimeBadge],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly swaggerUrl = `${inject(API_BASE_URL)}/swagger-ui.html`;
  private readonly realtime = inject(RealtimeService);

  constructor() {
    this.realtime.start();
    inject(DestroyRef).onDestroy(() => this.realtime.stop());
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
