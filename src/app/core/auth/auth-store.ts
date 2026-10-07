import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError, SessionExpiredError } from '../api-error';
import { User } from '../models';
import { AuthApi } from './auth-api';
import { StoredTokens, TOKEN_STORAGE_KEY, TokenStore, jwtClaims, toStoredTokens } from './token-store';

/** Làm mới token sớm hơn hạn này để request không bị 401 chỉ vì lệch đồng hồ hay mạng chậm. */
const REFRESH_SKEW_MS = 15_000;
const REFRESH_LOCK_NAME = 'todo-web.refresh-token';

/**
 * Trạng thái đăng nhập của cả ứng dụng: ai đang đăng nhập, token ở đâu, làm mới token thế nào.
 *
 * Điểm quan trọng nhất là REFRESH TOKEN XOAY VÒNG của BE: mỗi refresh token chỉ dùng được MỘT lần.
 * Dùng lại token cũ (kể cả vô tình) bị coi là bị đánh cắp và BE thu hồi cả chuỗi phiên.
 * Vì vậy việc làm mới phải tuần tự hóa ở hai mức:
 *  1. Trong một tab: nhiều request cùng bị 401 chỉ được gửi MỘT lần refresh (biến `inflight`).
 *  2. Giữa các tab: dùng Web Locks, và sau khi giành được khóa thì đọc lại token từ localStorage
 *     (tab khác có thể vừa làm mới xong, khi đó dùng luôn token mới thay vì refresh lần nữa).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly storage = inject(TokenStore);
  private readonly router = inject(Router);

  private readonly tokens = signal<StoredTokens | null>(this.storage.read());
  private readonly currentUser = signal<User | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly hasSession = computed(() => this.tokens() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  /** Có giá trị khi phiên bị kết thúc không phải do người dùng bấm đăng xuất. Trang đăng nhập hiển thị lý do. */
  readonly endedReason = signal<string | null>(null);

  private refreshInflight: Promise<StoredTokens> | null = null;
  private userInflight: Promise<User> | null = null;

  constructor() {
    // Tab khác đăng nhập, đăng xuất hoặc làm mới token: đồng bộ lại trạng thái trong tab này.
    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_STORAGE_KEY || event.key === null) {
        this.syncFromStorage();
      }
    });
  }

  // ---------- đọc token ----------

  /** Access token còn dùng được; tự làm mới nếu sắp hết hạn. null nếu chưa đăng nhập. */
  async getFreshAccessToken(): Promise<string | null> {
    const current = this.tokens();
    if (current === null) {
      return null;
    }
    if (current.accessExpiresAt - Date.now() > REFRESH_SKEW_MS) {
      return current.accessToken;
    }
    try {
      return (await this.refresh(current.accessToken)).accessToken;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        throw error;
      }
      // Lỗi mạng khi làm mới: cứ gửi bằng token hiện có, nếu server vẫn nhận thì không mất gì.
      return current.accessToken;
    }
  }

  // ---------- đăng ký, đăng nhập, đăng xuất ----------

  async register(email: string, password: string): Promise<void> {
    await firstValueFrom(this.api.register(email, password));
    await this.login(email, password);
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(this.api.login(email, password));
    this.endedReason.set(null);
    this.currentUser.set(null);
    this.setTokens(toStoredTokens(response));
    await this.loadUser();
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens()?.refreshToken;
    this.clearLocal();
    if (refreshToken !== undefined) {
      try {
        await firstValueFrom(this.api.logout(refreshToken));
      } catch {
        // BE luôn trả 204. Nếu lỗi mạng thì token sẽ tự hết hạn, không cần báo người dùng.
      }
    }
    await this.router.navigate(['/login']);
  }

  // ---------- thông tin người dùng ----------

  /** Trả về người dùng hiện tại, tải từ /me nếu chưa có. null nếu chưa đăng nhập hoặc phiên không dùng được. */
  async ensureUser(): Promise<User | null> {
    if (this.tokens() === null) {
      return null;
    }
    const known = this.currentUser();
    if (known !== null) {
      return known;
    }
    try {
      return await this.loadUser();
    } catch {
      return null;
    }
  }

  private loadUser(): Promise<User> {
    this.userInflight ??= firstValueFrom(this.api.me())
      .then((user) => {
        this.currentUser.set(user);
        return user;
      })
      .finally(() => (this.userInflight = null));
    return this.userInflight;
  }

  // ---------- làm mới token ----------

  /**
   * Đổi refresh token lấy cặp token mới.
   * @param staleAccessToken access token vừa bị từ chối (hoặc sắp hết hạn); dùng để biết
   *        tab khác đã làm mới thay mình chưa.
   */
  refresh(staleAccessToken: string): Promise<StoredTokens> {
    this.refreshInflight ??= withLock(REFRESH_LOCK_NAME, () => this.refreshUnderLock(staleAccessToken)).finally(
      () => (this.refreshInflight = null),
    );
    return this.refreshInflight;
  }

  private async refreshUnderLock(staleAccessToken: string): Promise<StoredTokens> {
    // Đọc lại từ localStorage chứ không tin biến trong bộ nhớ: tab khác có thể đã đổi token.
    const stored = this.storage.read();
    if (stored === null) {
      this.expireSession('Bạn đã đăng xuất ở tab khác');
      throw new SessionExpiredError();
    }
    if (stored.accessToken !== staleAccessToken && stored.accessExpiresAt - Date.now() > REFRESH_SKEW_MS) {
      this.tokens.set(stored);
      return stored;
    }
    if (stored.refreshExpiresAt <= Date.now()) {
      this.expireSession('Phiên đăng nhập đã hết hạn');
      throw new SessionExpiredError();
    }
    try {
      const fresh = toStoredTokens(await firstValueFrom(this.api.refresh(stored.refreshToken)));
      this.setTokens(fresh);
      return fresh;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.expireSession('Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi');
        throw new SessionExpiredError();
      }
      throw error;
    }
  }

  /** Kết thúc phiên vì lý do không phải người dùng chủ động, rồi chuyển về trang đăng nhập. */
  expireSession(reason: string): void {
    const hadSession = this.tokens() !== null || this.currentUser() !== null;
    this.clearLocal();
    this.endedReason.set(reason);
    if (hadSession) {
      const returnUrl = this.router.url;
      void this.router.navigate(['/login'], {
        queryParams: returnUrl.startsWith('/login') ? {} : { returnUrl },
      });
    }
  }

  // ---------- nội bộ ----------

  private setTokens(tokens: StoredTokens): void {
    this.storage.write(tokens);
    this.tokens.set(tokens);
  }

  private clearLocal(): void {
    this.storage.clear();
    this.tokens.set(null);
    this.currentUser.set(null);
  }

  private syncFromStorage(): void {
    const stored = this.storage.read();
    if (stored === null) {
      if (this.tokens() !== null) {
        this.expireSession('Bạn đã đăng xuất ở tab khác');
      }
      return;
    }
    const before = this.tokens();
    this.tokens.set(stored);
    // Tab khác đăng nhập bằng tài khoản KHÁC thì thông tin người dùng trong tab này đã cũ.
    const known = this.currentUser();
    const newSub = jwtClaims(stored.accessToken)?.sub;
    if (known !== null && newSub !== undefined && String(known.id) !== newSub) {
      this.currentUser.set(null);
      void this.loadUser().catch(() => undefined);
    } else if (before === null) {
      void this.ensureUser();
    }
  }
}

/** Web Locks API: chỉ một tab được chạy đoạn code bên trong tại một thời điểm. Không có API thì chạy luôn. */
function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if ('locks' in navigator) {
    return navigator.locks.request(name, task);
  }
  return task();
}
