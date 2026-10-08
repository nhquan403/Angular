import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { vi } from 'vitest';
import { AuthStore } from '../../core/auth/auth-store';
import { ConfirmService } from '../../core/dialog/confirm-dialog';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes-guard';

describe('unsavedChangesGuard', () => {
  const confirm = vi.fn<ConfirmService['confirm']>();
  let hasSession = true;

  beforeEach(() => {
    confirm.mockReset();
    hasSession = true;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: ConfirmService, useValue: { confirm } },
        { provide: AuthStore, useValue: { hasSession: () => hasSession } },
      ],
    });
  });

  const run = (dirty: boolean) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        { hasUnsavedChanges: () => dirty } satisfies HasUnsavedChanges,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('không có thay đổi thì cho đi luôn', () => {
    expect(run(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('có thay đổi thì hỏi, và theo câu trả lời của người dùng', async () => {
    confirm.mockResolvedValue(false);
    expect(await run(true)).toBe(false);
    confirm.mockResolvedValue(true);
    expect(await run(true)).toBe(true);
  });

  it('phiên đã hết (bị đẩy về đăng nhập) thì không hỏi', () => {
    hasSession = false;
    expect(run(true)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
