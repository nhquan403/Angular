import { HttpEventType, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { TOKEN_STORAGE_KEY } from '../../core/auth/token-store';
import { API_BASE_URL } from '../../core/config';
import { authInterceptor, errorInterceptor } from '../../core/http/interceptors';
import { AssistantApi } from './assistant-api';
import { AssistantEvent, AssistantRequest } from './assistant-models';

const API = 'http://localhost:8080';
const URL = `${API}/api/assistant/chat`;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const request: AssistantRequest = {
  messages: [{ role: 'user', content: 'Còn bao nhiêu việc?' }],
  context: { page: 'todo-list', path: '/todos', query: null, todoId: null, createDraft: null },
};

describe('AssistantApi', () => {
  let api: AssistantApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'A1',
        accessExpiresAt: Date.now() + 600_000,
        refreshToken: 'R1',
        refreshExpiresAt: Date.now() + 86_400_000,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    api = TestBed.inject(AssistantApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('POST kèm Bearer, đọc sự kiện dần theo từng mẩu nhận được, kể cả sự kiện bị cắt đôi', async () => {
    const events: AssistantEvent[] = [];
    let completed = false;
    api.chat(request).subscribe({ next: (e) => events.push(e), complete: () => (completed = true) });
    await tick();

    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('Authorization')).toBe('Bearer A1');

    const part1 = 'event: tool\ndata: {"name":"list_todos"}\n\nevent: delta\ndata: {"text":"Bạn có "}\n\nevent: del';
    req.event({ type: HttpEventType.Sent });
    req.event({ type: HttpEventType.DownloadProgress, loaded: part1.length, partialText: part1 });
    expect(events).toEqual([
      { type: 'tool', name: 'list_todos' },
      { type: 'delta', text: 'Bạn có ' },
    ]);

    const full = `${part1}ta\ndata: {"text":"3 việc."}\n\nevent: done\ndata: {}`;
    req.event({ type: HttpEventType.DownloadProgress, loaded: full.length, partialText: full });
    req.flush(full); // sự kiện cuối không có dòng trống: vẫn phải đọc được khi response kết thúc

    expect(events.slice(2)).toEqual([{ type: 'delta', text: '3 việc.' }, { type: 'done' }]);
    expect(completed).toBe(true);
  });

  it('BE trả lỗi (ví dụ 404 khi chưa có endpoint) thì nhận ApiError', async () => {
    let caught: unknown;
    api.chat(request).subscribe({ error: (e: unknown) => (caught = e) });
    await tick();
    backend.expectOne(URL).flush(JSON.stringify({ detail: 'No route' }), { status: 404, statusText: 'Not Found' });
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(404);
  });

  it('hủy đăng ký là hủy request', async () => {
    const sub = api.chat(request).subscribe();
    await tick();
    const req = backend.expectOne(URL);
    sub.unsubscribe();
    expect(req.cancelled).toBe(true);
  });
});
