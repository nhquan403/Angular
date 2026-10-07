import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ThemeToggle } from '../../layout/theme-toggle';

/** Khung chung cho trang đăng nhập / đăng ký: bên trái giới thiệu (ẩn trên điện thoại), bên phải là form. */
@Component({
  selector: 'app-auth-layout',
  imports: [MatIconModule, ThemeToggle],
  host: { class: 'grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]' },
  template: `
    <aside
      class="relative hidden overflow-hidden bg-linear-to-br from-primary to-tertiary p-12 text-on-primary lg:flex lg:flex-col"
    >
      <div class="flex items-center gap-3 text-2xl font-bold">
        <span class="grid size-11 place-items-center rounded-xl bg-white/20" aria-hidden="true">
          <mat-icon class="icon-filled">task_alt</mat-icon>
        </span>
        Todo
      </div>
      <div class="mt-auto max-w-md">
        <h2 class="text-4xl leading-tight font-bold">Công việc của bạn, đồng bộ theo thời gian thực.</h2>
        <ul class="mt-8 space-y-4 text-base/relaxed">
          @for (feature of features; track feature.icon) {
            <li class="flex items-start gap-3">
              <mat-icon class="mt-0.5 flex-none" aria-hidden="true">{{ feature.icon }}</mat-icon>
              <span>{{ feature.text }}</span>
            </li>
          }
        </ul>
      </div>
      <div class="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10"></div>
      <div class="pointer-events-none absolute -right-10 bottom-40 size-40 rounded-full bg-white/10"></div>
    </aside>

    <main class="relative flex items-center justify-center px-4 py-12">
      <div class="absolute top-3 right-3"><app-theme-toggle /></div>
      <div class="w-full max-w-sm">
        <div class="mb-8 flex items-center gap-2 text-xl font-bold lg:hidden">
          <span class="grid size-9 place-items-center rounded-xl bg-primary text-on-primary" aria-hidden="true">
            <mat-icon class="icon-filled">task_alt</mat-icon>
          </span>
          Todo
        </div>
        <h1 class="text-3xl font-bold tracking-tight">{{ heading() }}</h1>
        <p class="mt-2 mb-8 text-on-surface-variant">{{ subheading() }}</p>
        <ng-content />
      </div>
    </main>
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly subheading = input.required<string>();

  protected readonly features = [
    { icon: 'bolt', text: 'Thay đổi ở tab hoặc thiết bị khác hiện ra ngay, qua SSE hoặc WebSocket.' },
    { icon: 'filter_list', text: 'Lọc, sắp xếp, phân trang; gửi link là người nhận thấy đúng như bạn.' },
    { icon: 'shield_lock', text: 'Phiên đăng nhập tự gia hạn an toàn, không bị đăng xuất giữa chừng.' },
  ] as const;
}
