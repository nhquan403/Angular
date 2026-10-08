import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, vi } from 'vitest';
import { API_BASE_URL } from '../config';
import { TodoEvent } from '../models';
import { RealtimeService } from './realtime-service';

const API = 'http://localhost:8080';
const TICKET = `${API}/api/realtime/ticket`;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, listener);
  }
  close(): void {
    this.closed = true;
  }
  open(): void {
    this.onopen?.();
  }
  fail(): void {
    this.onerror?.();
  }
  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  close(): void {
    this.closed = true;
  }
}

const event = (overrides: Partial<TodoEvent> = {}): string =>
  JSON.stringify({
    type: 'CREATED',
    todoId: 1,
    ownerId: 2,
    title: 'A',
    completed: false,
    occurredAt: '2026-10-07T00:00:00Z',
    ...overrides,
  });

describe('RealtimeService', () => {
  let service: RealtimeService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.instances = [];
    FakeWebSocket.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1); // chờ đúng mốc trên của backoff cho dễ tính
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: API }],
    });
    service = TestBed.inject(RealtimeService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function connectSse(ticket = 't1'): FakeEventSource {
    backend.expectOne(TICKET).flush({ ticket, expiresInSeconds: 30 });
    const source = FakeEventSource.instances.at(-1)!;
    source.open();
    return source;
  }

  it('lấy vé rồi mở SSE bằng đúng vé đó; mở được thì trạng thái là open', () => {
    service.start();
    expect(service.status()).toBe('connecting');
    const source = connectSse('abc 123');
    expect(source.url).toBe(`${API}/api/realtime/stream?ticket=abc%20123`);
    expect(service.status()).toBe('open');
  });

  it('nhận sự kiện tên "todo", thêm vào nhật ký và phát cho người nghe; tin hỏng bị bỏ qua', () => {
    service.start();
    const source = connectSse();
    const received: TodoEvent[] = [];
    service.events$.subscribe((e) => received.push(e));

    source.emit('todo', event({ todoId: 7, title: 'Học' }));
    source.emit('todo', 'không phải json');
    source.emit('todo', event({ type: 'DELETED', todoId: 7 }));

    expect(received.map((e) => e.type)).toEqual(['CREATED', 'DELETED']);
    expect(service.feed().map((i) => i.event.type)).toEqual(['DELETED', 'CREATED']); // mới nhất ở đầu
  });

  it('nhật ký chỉ giữ 50 sự kiện gần nhất', () => {
    service.start();
    const source = connectSse();
    for (let i = 0; i < 60; i++) {
      source.emit('todo', event({ todoId: i }));
    }
    expect(service.feed()).toHaveLength(50);
    expect(service.feed()[0].event.todoId).toBe(59);
  });

  it('mất kết nối thì đóng, chờ rồi lấy VÉ MỚI để nối lại và báo resync$', () => {
    service.start();
    const first = connectSse('t1');
    let resyncs = 0;
    service.resync$.subscribe(() => resyncs++);

    first.fail();
    expect(first.closed).toBe(true);
    expect(service.status()).toBe('reconnecting');
    expect(service.lastError()).toContain('SSE');
    backend.expectNone(TICKET); // chưa tới giờ thử lại

    vi.advanceTimersByTime(1_000);
    const second = connectSse('t2');
    expect(second.url).toContain('ticket=t2');
    expect(service.status()).toBe('open');
    expect(resyncs).toBe(1);
  });

  it('lần đầu mở được thì KHÔNG phát resync$', () => {
    service.start();
    let resyncs = 0;
    service.resync$.subscribe(() => resyncs++);
    connectSse();
    expect(resyncs).toBe(0);
  });

  it('thời gian chờ: 1s, 2s, 4s ... và dừng ở 30s', () => {
    service.start();
    const expected = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000];
    for (const ms of expected) {
      backend.expectOne(TICKET).flush({}, { status: 500, statusText: 'Server Error' });
      vi.advanceTimersByTime(ms - 1);
      backend.expectNone(TICKET);
      vi.advanceTimersByTime(1);
    }
    backend.expectOne(TICKET);
  });

  it('kết nối sống đủ lâu thì bộ đếm chờ về 0; sống chưa tới 5 giây rồi rớt thì vẫn tăng', () => {
    service.start();
    connectSse().fail(); // rớt ngay sau khi mở
    vi.advanceTimersByTime(1_000);
    connectSse().fail(); // lại rớt ngay: lần chờ tiếp theo phải là 2s
    vi.advanceTimersByTime(1_999);
    backend.expectNone(TICKET);
    vi.advanceTimersByTime(1);
    const stable = connectSse();
    vi.advanceTimersByTime(5_000); // đủ lâu: coi là ổn
    stable.fail();
    vi.advanceTimersByTime(1_000);
    backend.expectOne(TICKET);
  });

  it('đổi sang WebSocket: đóng SSE, lấy vé mới và mở ws:// bằng vé đó', () => {
    service.start();
    const sse = connectSse();
    service.setTransport('ws');
    expect(sse.closed).toBe(true);
    backend.expectOne(TICKET).flush({ ticket: 'w1', expiresInSeconds: 30 });
    const socket = FakeWebSocket.instances.at(-1)!;
    expect(socket.url).toBe('ws://localhost:8080/ws/todos?ticket=w1');
    socket.onopen?.();
    expect(service.status()).toBe('open');

    socket.onmessage?.({ data: event({ todoId: 3 }) } as MessageEvent<unknown>);
    expect(service.feed()[0].event.todoId).toBe(3);
    expect(localStorage.getItem('todo-web.realtime-transport')).toBe('ws');
  });

  it('WebSocket bị đóng với mã 1013 thì báo đã quá số kết nối cho phép', () => {
    service.setTransport('ws');
    service.start();
    backend.expectOne(TICKET).flush({ ticket: 'w1', expiresInSeconds: 30 });
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.onopen?.();
    socket.onclose?.({ code: 1013 });
    expect(service.lastError()).toContain('quá nhiều kết nối');
  });

  it('đóng chủ động (đổi kiểu kết nối) không bị tính là mất kết nối', () => {
    service.start();
    const sse = connectSse();
    service.setTransport('ws');
    sse.fail(); // callback muộn của kết nối cũ phải bị bỏ qua
    backend.expectOne(TICKET).flush({ ticket: 'w1', expiresInSeconds: 30 });
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(service.status()).not.toBe('idle');
  });

  it('stop() đóng kết nối, hủy việc thử lại và về trạng thái idle', () => {
    service.start();
    const sse = connectSse();
    sse.fail();
    service.stop();
    expect(service.status()).toBe('idle');
    vi.advanceTimersByTime(60_000);
    backend.expectNone(TICKET);
  });
});
