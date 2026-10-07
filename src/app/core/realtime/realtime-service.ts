import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiError } from '../api-error';
import { API_BASE_URL } from '../config';
import { TodoEvent } from '../models';
import { safeStorage } from '../safe-storage';
import { parseTodoEvent } from './todo-event';

export type RealtimeTransport = 'sse' | 'ws';
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface FeedItem {
  id: number;
  receivedAt: number;
  event: TodoEvent;
}

const TRANSPORT_KEY = 'todo-web.realtime-transport';
const MAX_FEED = 50;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
/** Kết nối phải sống đủ lâu mới coi là "ổn" và đặt lại bộ đếm chờ. */
const STABLE_AFTER_MS = 5_000;
/** WebSocket close code 1013 = SERVICE_OVERLOAD: BE từ chối vì quá số kết nối cho phép mỗi người. */
const CLOSE_TOO_MANY = 1013;

interface Connection {
  close(): void;
}

interface TicketResponse {
  ticket: string;
}

/**
 * Nhận sự kiện todo theo thời gian thực từ BE, bằng SSE hoặc WebSocket (người dùng chọn).
 *
 * Quy trình mỗi lần kết nối:
 *  1. POST /api/realtime/ticket (có Bearer token) để lấy "vé" dùng một lần, sống 30 giây.
 *     Cần vé vì EventSource và WebSocket của trình duyệt KHÔNG gắn được header Authorization.
 *  2. Mở EventSource (/api/realtime/stream?ticket=...) hoặc WebSocket (/ws/todos?ticket=...).
 *  3. Mất kết nối thì tự kết nối lại, mỗi lần lấy VÉ MỚI.
 *
 * Vì sao không dùng cơ chế tự kết nối lại có sẵn của EventSource: nó thử lại đúng URL cũ, mà vé cũ đã
 * bị dùng rồi nên lần nào cũng 401. Do đó mỗi khi lỗi ta tự đóng và tự mở lại với vé mới, chờ lâu dần
 * (backoff mũ + ngẫu nhiên) để không dồn dập gọi BE khi nó đang gặp sự cố.
 *
 * BE KHÔNG phát lại sự kiện đã lỡ. Vì thế sau mỗi lần kết nối lại, `resync$` phát tín hiệu để màn hình tải lại dữ liệu.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  readonly transport = signal<RealtimeTransport>(loadTransport());
  readonly status = signal<RealtimeStatus>('idle');
  readonly lastError = signal<string | null>(null);
  /** Nhật ký các sự kiện đã nhận, mới nhất ở đầu. */
  readonly feed = signal<readonly FeedItem[]>([]);

  private readonly eventSubject = new Subject<TodoEvent>();
  private readonly resyncSubject = new Subject<void>();
  /** Mỗi sự kiện nhận được. */
  readonly events$ = this.eventSubject.asObservable();
  /** Phát sau khi kết nối LẠI thành công: dữ liệu có thể đã lệch, hãy tải lại. */
  readonly resync$ = this.resyncSubject.asObservable();

  private running = false;
  private connection: Connection | null = null;
  /** Mỗi lần mở/đóng kết nối tăng một số. Callback muộn của kết nối cũ thấy số khác nên tự bỏ qua. */
  private generation = 0;
  private attempt = 0;
  private hasConnectedBefore = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stableTimer: ReturnType<typeof setTimeout> | undefined;
  private feedSeq = 0;

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.attempt = 0;
    this.hasConnectedBefore = false;
    this.openConnection();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    this.cleanup();
    this.status.set('idle');
    this.lastError.set(null);
  }

  setTransport(transport: RealtimeTransport): void {
    if (transport === this.transport()) {
      return;
    }
    this.transport.set(transport);
    safeStorage.set(TRANSPORT_KEY, transport);
    if (this.running) {
      this.attempt = 0;
      this.openConnection();
    }
  }

  clearFeed(): void {
    this.feed.set([]);
  }

  // ---------- kết nối ----------

  private openConnection(): void {
    this.cleanup();
    const gen = ++this.generation;
    this.status.set(this.hasConnectedBefore || this.attempt > 0 ? 'reconnecting' : 'connecting');

    this.http.post<TicketResponse>(`${this.apiBase}/api/realtime/ticket`, null).subscribe({
      next: ({ ticket }) => {
        if (gen === this.generation) {
          this.connection = this.transport() === 'sse' ? this.openSse(gen, ticket) : this.openWebSocket(gen, ticket);
        }
      },
      error: (error: unknown) => {
        if (gen === this.generation) {
          this.scheduleRetry(gen, error instanceof ApiError ? error.message : 'Không lấy được vé kết nối');
        }
      },
    });
  }

  private openSse(gen: number, ticket: string): Connection {
    const source = new EventSource(`${this.apiBase}/api/realtime/stream?ticket=${encodeURIComponent(ticket)}`);
    source.onopen = () => this.onOpen(gen);
    // BE đặt tên sự kiện là "todo" (SseEmitter.event().name("todo")), nên phải nghe đúng tên đó.
    source.addEventListener('todo', (event) => this.onMessage(gen, (event as MessageEvent<string>).data));
    source.onerror = () => {
      // EventSource không cho biết mã lỗi HTTP (401, 429...), chỉ biết là hỏng.
      source.close();
      this.onLost(gen, 'Mất kết nối SSE (có thể do quá 5 kết nối đang mở hoặc server ngắt)');
    };
    return {
      close: () => {
        // Gỡ handler trước khi đóng để việc đóng chủ động không bị tính là "mất kết nối".
        source.onopen = null;
        source.onerror = null;
        source.close();
      },
    };
  }

  private openWebSocket(gen: number, ticket: string): Connection {
    const wsBase = this.apiBase.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBase}/ws/todos?ticket=${encodeURIComponent(ticket)}`);
    socket.onopen = () => this.onOpen(gen);
    socket.onmessage = (event: MessageEvent<unknown>) => this.onMessage(gen, String(event.data));
    socket.onclose = (event) =>
      this.onLost(
        gen,
        event.code === CLOSE_TOO_MANY
          ? 'Đã mở quá nhiều kết nối thời gian thực (tối đa 5 mỗi người)'
          : 'Mất kết nối WebSocket',
      );
    // Lỗi WebSocket luôn kèm sự kiện close ngay sau đó, xử lý ở onclose.
    return {
      close: () => {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      },
    };
  }

  private onOpen(gen: number): void {
    if (gen !== this.generation) {
      return;
    }
    this.status.set('open');
    this.lastError.set(null);
    if (this.hasConnectedBefore) {
      this.resyncSubject.next();
    }
    this.hasConnectedBefore = true;
    // Chỉ đặt lại bộ đếm chờ khi kết nối sống đủ lâu, tránh vòng lặp mở-bị đóng-mở mỗi giây.
    this.stableTimer = setTimeout(() => (this.attempt = 0), STABLE_AFTER_MS);
  }

  private onMessage(gen: number, raw: string): void {
    if (gen !== this.generation) {
      return;
    }
    const event = parseTodoEvent(raw);
    if (event === null) {
      return;
    }
    this.feed.update((items) => [{ id: ++this.feedSeq, receivedAt: Date.now(), event }, ...items].slice(0, MAX_FEED));
    this.eventSubject.next(event);
  }

  private onLost(gen: number, reason: string): void {
    if (gen !== this.generation) {
      return;
    }
    this.cleanup();
    this.scheduleRetry(gen, reason);
  }

  private scheduleRetry(gen: number, reason: string): void {
    this.lastError.set(reason);
    this.status.set('reconnecting');
    const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt);
    // Chờ ngẫu nhiên trong [ceiling/2, ceiling]: nhiều tab/máy bị ngắt cùng lúc sẽ không quay lại cùng một giây.
    const delay = ceiling / 2 + Math.random() * (ceiling / 2);
    this.attempt++;
    this.retryTimer = setTimeout(() => {
      if (this.running && gen === this.generation) {
        this.openConnection();
      }
    }, delay);
  }

  private cleanup(): void {
    clearTimeout(this.retryTimer);
    clearTimeout(this.stableTimer);
    this.connection?.close();
    this.connection = null;
  }
}

function loadTransport(): RealtimeTransport {
  return safeStorage.get(TRANSPORT_KEY) === 'ws' ? 'ws' : 'sse';
}
