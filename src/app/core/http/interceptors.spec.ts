import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ApiError, SessionExpiredError } from '../api-error';
import { AuthStore } from '../auth/auth-store';
import { StoredTokens, TOKEN_STORAGE_KEY } from '../auth/token-store';
import { API_BASE_URL } from '../config';
import { authInterceptor, errorInterceptor } from './interceptors';

const API = 'http://localhost:8080';
const LIST = `${API}/api/todos`;
const REFRESH = `${API}/api/auth/refresh`;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function seed(overrides: Partial<StoredTokens> = {}): void {
  const tokens: StoredTokens = {
    accessToken: 'A1',
    accessExpiresAt: Date.now() + 10 * 60_000,
    refreshToken: 'R1',
    refreshExpiresAt: Date.now() + 7 * 24 * 3_600_000,
    ...overrides,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

const tokenResponse = (n: number) => ({
  tokenType: 'Bearer',
  accessToken: `A${n}`,
  accessTokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  refreshToken: `R${n}`,
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
});

describe('interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => backend.verify());

  it('gắn Bearer token vào request gửi tới BE', async () => {
    seed();
    setup();
    http.get(LIST).subscribe();
    await tick();
    expect(backend.expectOne(LIST).request.headers.get('Authorization')).toBe('Bearer A1');
  });

  it('không gắn token vào request tới nơi khác', async () => {
    seed();
    setup();
    http.get('https://example.org/data').subscribe();
    await tick();
    expect(backend.expectOne('https://example.org/data').request.headers.has('Authorization')).toBe(false);
  });

  it('không gắn token vào đăng nhập, nhưng có gắn vào /me', async () => {
    seed();
    setup();
    http.post(`${API}/api/auth/login`, {}).subscribe();
    http.get(`${API}/api/auth/me`).subscribe();
    await tick();
    expect(backend.expectOne(`${API}/api/auth/login`).request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne(`${API}/api/auth/me`).request.headers.get('Authorization')).toBe('Bearer A1');
  });

  it('nhận 401 thì làm mới token rồi gửi lại ĐÚNG MỘT lần với token mới', async () => {
    seed();
    setup();
    const results: unknown[] = [];
    http.get(LIST).subscribe((value) => results.push(value));
    await tick();
    backend.expectOne(LIST).flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    await tick();

    const refresh = backend.expectOne(REFRESH);
    expect(refresh.request.body).toEqual({ refreshToken: 'R1' });
    refresh.flush(tokenResponse(2));
    await tick();

    const retry = backend.expectOne(LIST);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer A2');
    retry.flush({ ok: true });
    expect(results).toEqual([{ ok: true }]);
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? '{}').refreshToken).toBe('R2');
  });

  it('nhiều request cùng bị 401 chỉ gọi /refresh MỘT lần (refresh token xoay vòng chỉ dùng được một lần)', async () => {
    seed();
    setup();
    const done: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      http.get(LIST).subscribe((value) => done.push(value));
    }
    await tick();
    const first = backend.match(LIST);
    expect(first).toHaveLength(3);
    first.forEach((req) => req.flush({}, { status: 401, statusText: 'Unauthorized' }));
    await tick();

    const refreshes = backend.match(REFRESH);
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush(tokenResponse(2));
    await tick();

    const retries = backend.match(LIST);
    expect(retries).toHaveLength(3);
    retries.forEach((req) => {
      expect(req.request.headers.get('Authorization')).toBe('Bearer A2');
      req.flush({ ok: true });
    });
    expect(done).toHaveLength(3);
  });

  it('token sắp hết hạn thì làm mới TRƯỚC khi gửi, không tốn một lượt 401', async () => {
    seed({ accessExpiresAt: Date.now() + 2_000 });
    setup();
    http.get(LIST).subscribe();
    await tick();
    backend.expectOne(REFRESH).flush(tokenResponse(2));
    await tick();
    expect(backend.expectOne(LIST).request.headers.get('Authorization')).toBe('Bearer A2');
  });

  it('refresh token bị từ chối: xóa phiên, về /login, request báo SessionExpiredError', async () => {
    seed();
    setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let caught: unknown;
    http.get(LIST).subscribe({ error: (e: unknown) => (caught = e) });
    await tick();
    backend.expectOne(LIST).flush({}, { status: 401, statusText: 'Unauthorized' });
    await tick();
    backend.expectOne(REFRESH).flush({ detail: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });
    await tick();

    expect(caught).toBeInstanceOf(SessionExpiredError);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(TestBed.inject(AuthStore).hasSession()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('lỗi mạng khi làm mới KHÔNG kết thúc phiên (chỉ báo lỗi, token vẫn còn)', async () => {
    seed();
    setup();
    let caught: unknown;
    http.get(LIST).subscribe({ error: (e: unknown) => (caught = e) });
    await tick();
    backend.expectOne(LIST).flush({}, { status: 401, statusText: 'Unauthorized' });
    await tick();
    backend.expectOne(REFRESH).error(new ProgressEvent('error'));
    await tick();

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).isNetwork).toBe(true);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
  });

  it('lỗi khác 401 được đổi thành ApiError kèm lỗi từng ô, không làm mới token', async () => {
    seed();
    setup();
    let caught: unknown;
    http.post(LIST, {}).subscribe({ error: (e: unknown) => (caught = e) });
    await tick();
    backend
      .expectOne(LIST)
      .flush(
        { detail: 'Validation failed', errors: { title: 'title must not be blank' } },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).fieldErrors).toEqual({ title: 'title must not be blank' });
  });

  it('tab khác đã làm mới xong thì dùng token mới luôn, không gọi /refresh lần nữa', async () => {
    seed();
    setup();
    http.get(LIST).subscribe();
    await tick();
    // trong lúc request đang bay, "tab khác" ghi token mới vào localStorage
    seed({ accessToken: 'A9', refreshToken: 'R9' });
    backend.expectOne(LIST).flush({}, { status: 401, statusText: 'Unauthorized' });
    await tick();

    expect(backend.match(REFRESH)).toHaveLength(0);
    expect(backend.expectOne(LIST).request.headers.get('Authorization')).toBe('Bearer A9');
  });
});
