import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  host: { class: 'grid min-h-dvh place-items-center px-4' },
  template: `
    <main class="flex max-w-md flex-col items-center text-center">
      <p class="bg-linear-to-br from-primary to-tertiary bg-clip-text text-8xl font-black text-transparent">404</p>
      <h1 class="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <p class="mt-2 text-on-surface-variant">Đường dẫn này không tồn tại hoặc đã bị di chuyển.</p>
      <a matButton="filled" routerLink="/todos" class="mt-8">
        <mat-icon>home</mat-icon>
        Về danh sách todo
      </a>
    </main>
  `,
})
export class NotFound {}
