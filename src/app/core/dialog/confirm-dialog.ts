import { Component, Injectable, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Hành động phá hủy (xóa...): nút xác nhận màu đỏ. */
  danger?: boolean;
  icon?: string;
}

/** Hộp thoại xác nhận dùng chung. Gọi qua ConfirmService, không dùng trực tiếp. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="flex! items-center gap-2">
      @if (data.icon) {
        <mat-icon [class.text-error]="data.danger" aria-hidden="true">{{ data.icon }}</mat-icon>
      }
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">{{ data.cancelText ?? 'Hủy' }}</button>
      <button
        matButton="filled"
        type="button"
        cdkFocusInitial
        [class.danger-button]="data.danger"
        [mat-dialog-close]="true"
      >
        {{ data.confirmText ?? 'Đồng ý' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /** Trả về true nếu người dùng đồng ý; đóng hộp thoại bằng Esc hay bấm ra ngoài coi như hủy. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
      data: options,
      width: '440px',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'dialog',
      role: 'alertdialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
