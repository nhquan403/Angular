import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { ConfirmService } from '../../core/dialog/confirm-dialog';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Rời trang khi form còn thay đổi chưa lưu thì hỏi lại. Phiên đã hết (bị đẩy về đăng nhập) thì không hỏi. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges() || !inject(AuthStore).hasSession()) {
    return true;
  }
  return inject(ConfirmService).confirm({
    title: 'Rời trang?',
    message: 'Bạn có thay đổi chưa lưu. Rời trang sẽ mất các thay đổi này.',
    confirmText: 'Rời trang',
    cancelText: 'Ở lại',
    danger: true,
    icon: 'edit_off',
  });
};
