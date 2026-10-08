import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type AlertKind = 'info' | 'warn' | 'error' | 'success';

const ICON: Readonly<Record<AlertKind, string>> = {
  info: 'info',
  warn: 'warning',
  error: 'error',
  success: 'check_circle',
};

const TONE: Readonly<Record<AlertKind, string>> = {
  info: 'bg-secondary-container text-on-secondary-container',
  warn: 'bg-warn-container text-warn',
  error: 'bg-error-container text-on-error-container',
  success: 'bg-success-container text-success',
};

/** Khung thông báo nằm trong trang (banner). Nội dung và nút hành động đưa vào qua ng-content. */
@Component({
  selector: 'app-alert',
  imports: [MatIconModule],
  host: {
    '[class]': "'flex gap-3 rounded-xl px-4 py-3 text-sm ' + tone()",
    '[attr.role]': "kind() === 'error' || kind() === 'warn' ? 'alert' : 'status'",
  },
  template: `
    <mat-icon class="icon-filled flex-none" aria-hidden="true">{{ icon() }}</mat-icon>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      @if (heading(); as text) {
        <strong class="font-medium">{{ text }}</strong>
      }
      <div><ng-content /></div>
      <div class="mt-1 flex flex-wrap gap-2 empty:hidden"><ng-content select="[alertActions]" /></div>
    </div>
  `,
})
export class Alert {
  readonly kind = input<AlertKind>('info');
  readonly heading = input<string | null>(null);
  protected readonly icon = computed(() => ICON[this.kind()]);
  protected readonly tone = computed(() => TONE[this.kind()]);
}
