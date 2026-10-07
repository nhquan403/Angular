import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Màn hình trống / không có dữ liệu: biểu tượng, tiêu đề, mô tả và nút hành động (ng-content). */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  host: { class: 'flex flex-col items-center gap-2 px-4 py-10 text-center' },
  template: `
    <div
      class="mb-2 grid size-16 place-items-center rounded-full bg-surface-high text-on-surface-variant"
      aria-hidden="true"
    >
      <mat-icon class="size-8! text-[32px]!">{{ icon() }}</mat-icon>
    </div>
    <h2 class="text-base font-medium">{{ title() }}</h2>
    @if (message(); as text) {
      <p class="max-w-lg text-sm text-on-surface-variant">{{ text }}</p>
    }
    <div class="mt-2 flex flex-wrap justify-center gap-2 empty:hidden"><ng-content /></div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
}
