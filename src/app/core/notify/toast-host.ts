import { Component, inject } from '@angular/core';
import { ToastService } from './toast-service';

/** Nơi vẽ các thông báo nổi. Đặt một lần ở App. */
@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="toast.kind" role="status">
          <span class="grow">{{ toast.message }}</span>
          <button type="button" class="btn link small" (click)="toasts.dismiss(toast.id)" aria-label="Đóng thông báo">✕</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 1rem; bottom: 1rem; left: 1rem; display: flex; flex-direction: column; gap: .5rem; align-items: flex-end; z-index: 50; pointer-events: none; }
    .toast { pointer-events: auto; display: flex; gap: .5rem; align-items: center; max-width: 420px; padding: .6rem .8rem; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); border-left-width: 4px; box-shadow: 0 4px 14px rgb(0 0 0 / 18%); }
    .toast.error { border-left-color: var(--danger); }
    .toast.success { border-left-color: var(--success); }
    .toast.info { border-left-color: var(--primary); }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
