import { Component, computed, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [MatButtonToggleModule, MatTooltipModule],
  template: `
    <span
      class="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-on-surface-variant"
      role="status"
      [attr.data-status]="realtime.status()"
      [matTooltip]="realtime.lastError() ?? 'Kết nối thời gian thực qua ' + transportLabel()"
    >
      <span class="dot size-2 rounded-full" aria-hidden="true"></span>
      <span class="max-md:hidden">{{ label() }}</span>
    </span>
    <mat-button-toggle-group
      hideSingleSelectionIndicator
      class="text-xs max-sm:hidden!"
      aria-label="Kiểu kết nối thời gian thực"
      [value]="realtime.transport()"
      (change)="realtime.setTransport($event.value)"
    >
      @for (option of options; track option.value) {
        <mat-button-toggle [value]="option.value">{{ option.label }}</mat-button-toggle>
      }
    </mat-button-toggle-group>
  `,
  host: { class: 'inline-flex items-center gap-2 [--mat-button-toggle-height:30px]' },
  styles: `
    .dot {
      background: var(--mat-sys-outline);
    }
    [data-status='open'] .dot {
      background: var(--app-success);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-success) 25%, transparent);
    }
    [data-status='connecting'] .dot,
    [data-status='reconnecting'] .dot {
      background: var(--app-warn);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
  `,
})
export class RealtimeBadge {
  protected readonly realtime = inject(RealtimeService);
  protected readonly label = computed(() => STATUS_LABEL[this.realtime.status()]);
  protected readonly transportLabel = computed(() => (this.realtime.transport() === 'sse' ? 'SSE' : 'WebSocket'));
  protected readonly options: readonly { value: RealtimeTransport; label: string }[] = [
    { value: 'sse', label: 'SSE' },
    { value: 'ws', label: 'WebSocket' },
  ];
}
