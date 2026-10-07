import { Component, computed, inject } from '@angular/core';
import { RealtimeService, RealtimeStatus, RealtimeTransport } from '../core/realtime/realtime-service';

const STATUS_LABEL: Readonly<Record<RealtimeStatus, string>> = {
  idle: 'Tắt',
  connecting: 'Đang kết nối...',
  open: 'Trực tiếp',
  reconnecting: 'Đang kết nối lại...',
};

/** Hiện trạng thái kết nối thời gian thực và cho đổi giữa SSE và WebSocket. */
@Component({
  selector: 'app-realtime-badge',
  template: `
    <span class="state" [title]="realtime.lastError() ?? ''" [attr.data-status]="realtime.status()">
      <span class="dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </span>
    <span class="chips" role="group" aria-label="Kiểu kết nối thời gian thực">
      @for (option of options; track option.value) {
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="realtime.transport() === option.value"
          (click)="realtime.setTransport(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: .5rem; font-size: .85rem; }
    .state { display: inline-flex; align-items: center; gap: .35rem; color: var(--muted); }
    .dot { width: .6rem; height: .6rem; border-radius: 50%; background: var(--muted); }
    [data-status='open'] .dot { background: var(--success); }
    [data-status='connecting'] .dot, [data-status='reconnecting'] .dot { background: var(--warn); }
    .chip { padding: .1rem .55rem; font-size: .75rem; }
  `,
})
export class RealtimeBadge {
  protected readonly realtime = inject(RealtimeService);
  protected readonly label = computed(() => STATUS_LABEL[this.realtime.status()]);
  protected readonly options: readonly { value: RealtimeTransport; label: string }[] = [
    { value: 'sse', label: 'SSE' },
    { value: 'ws', label: 'WebSocket' },
  ];
}
