import { Injectable } from '@angular/core';
import { TokenResponse } from '../models';
import { safeStorage } from '../safe-storage';

export const TOKEN_STORAGE_KEY = 'todo-web.tokens';

/** Cặp token lưu ở client. Thời điểm hết hạn đổi sẵn ra mili giây để so sánh với Date.now(). */
export interface StoredTokens {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

/**
 * Lưu token ở localStorage để F5 không mất đăng nhập và các tab dùng chung một phiên.
 *
 * Đánh đổi cần biết: localStorage đọc được bằng JavaScript, nên nếu trang dính XSS thì token bị đánh cắp.
 * Cách an toàn hơn là BFF + cookie HttpOnly, nhưng BE này thiết kế để dùng header Authorization.
 * Vì vậy: không dùng innerHTML với dữ liệu người dùng, không nhúng script bên thứ ba tùy tiện.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  read(): StoredTokens | null {
    const raw = safeStorage.get(TOKEN_STORAGE_KEY);
    return raw === null ? null : parseStoredTokens(raw);
  }

  write(tokens: StoredTokens): void {
    safeStorage.set(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  clear(): void {
    safeStorage.remove(TOKEN_STORAGE_KEY);
  }
}

export function parseStoredTokens(raw: string): StoredTokens | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== 'object') {
      return null;
    }
    const t = value as Partial<StoredTokens>;
    if (
      typeof t.accessToken === 'string' &&
      typeof t.refreshToken === 'string' &&
      typeof t.accessExpiresAt === 'number' &&
      typeof t.refreshExpiresAt === 'number'
    ) {
      return t as StoredTokens;
    }
    return null;
  } catch {
    return null;
  }
}

/** Đổi response của BE thành dạng lưu trữ. */
export function toStoredTokens(response: TokenResponse, now = Date.now()): StoredTokens {
  return {
    accessToken: response.accessToken,
    accessExpiresAt: expiryOf(response.accessTokenExpiresAt, response.accessToken, now),
    refreshToken: response.refreshToken,
    refreshExpiresAt: expiryOf(response.refreshTokenExpiresAt, null, now),
  };
}

function expiryOf(iso: string, jwt: string | null, now: number): number {
  const fromField = Date.parse(iso);
  if (!Number.isNaN(fromField)) {
    return fromField;
  }
  // Dự phòng: claim "exp" của JWT (tính bằng giây).
  const exp = jwt === null ? undefined : jwtClaims(jwt)?.exp;
  return typeof exp === 'number' ? exp * 1000 : now + 60_000;
}

export interface JwtClaims {
  sub?: string;
  exp?: number;
  roles?: string[];
}

/**
 * Đọc phần payload của JWT. CHỈ để hiển thị hoặc so sánh; không được dùng để quyết định bảo mật,
 * vì client không kiểm tra được chữ ký. Quyền thật luôn do BE kiểm tra ở mỗi request.
 */
export function jwtClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtClaims;
  } catch {
    return null;
  }
}
