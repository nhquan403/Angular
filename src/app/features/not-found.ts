import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="page stack">
      <h1>404 - Không tìm thấy trang</h1>
      <p class="muted">Đường dẫn này không tồn tại.</p>
      <a routerLink="/todos" class="btn primary" style="align-self: flex-start">Về danh sách todo</a>
    </main>
  `,
})
export class NotFound {}
