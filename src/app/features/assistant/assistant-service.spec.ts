import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiError } from '../../core/api-error';
import { AssistantApi } from './assistant-api';
import { AssistantContext, AssistantEvent, AssistantRequest } from './assistant-models';
import { ASSISTANT_TYPING, AssistantService, MAX_HISTORY, trimHistory } from './assistant-service';
import { PageContext } from './page-context';
import { DEFAULT_TYPEWRITER, FrameScheduler } from './typewriter';

const noFrames: FrameScheduler = { request: () => 0, cancel: () => undefined };

const context: AssistantContext = { page: 'todo-detail', path: '/todos/7', query: null, todoId: 7, createDraft: null };

describe('AssistantService', () => {
  let service: AssistantService;
  let stream: Subject<AssistantEvent>;
  let chat: ReturnType<typeof vi.fn<(request: AssistantRequest) => Subject<AssistantEvent>>>;

  beforeEach(() => {
    chat = vi.fn(() => {
      stream = new Subject<AssistantEvent>();
      return stream;
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AssistantApi, useValue: { chat } },
        { provide: PageContext, useValue: { snapshot: () => context } },
        // Các test ở đây kiểm tra luồng sự kiện, nên hiện chữ ngay; hiệu ứng gõ dần có test riêng bên dưới.
        {
          provide: ASSISTANT_TYPING,
          useValue: { scheduler: noFrames, options: { ...DEFAULT_TYPEWRITER, instant: true } },
        },
      ],
    });
    service = TestBed.inject(AssistantService);
  });

  it('gửi câu hỏi kèm ngữ cảnh trang, ghép dần câu trả lời, gắn tool và gợi ý', () => {
    service.send('  Chia nhỏ todo này  ');
    expect(chat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'Chia nhỏ todo này' }], context });
    expect(service.busy()).toBe(true);

    stream.next({ type: 'tool', name: 'get_todo' });
    stream.next({ type: 'delta', text: 'Gồm ' });
    stream.next({ type: 'delta', text: '2 bước.' });
    stream.next({ type: 'suggestion', suggestion: { title: 'Bước 1', description: null } });
    stream.next({ type: 'done' });

    const [user, reply] = service.messages();
    expect(user).toMatchObject({ role: 'user', text: 'Chia nhỏ todo này' });
    expect(reply).toMatchObject({
      role: 'assistant',
      text: 'Gồm 2 bước.',
      status: 'done',
      tools: ['get_todo'],
      suggestions: [{ title: 'Bước 1', description: null }],
    });
    expect(service.busy()).toBe(false);
  });

  it('câu hỏi sau gửi kèm lịch sử; không gửi khi đang chờ trả lời hoặc câu hỏi trống', () => {
    service.send('Câu 1');
    service.send('Gửi chen ngang'); // đang chờ: bỏ qua
    stream.next({ type: 'delta', text: 'Trả lời 1' });
    stream.complete();
    service.send('   ');
    service.send('Câu 2');
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[1][0].messages).toEqual([
      { role: 'user', content: 'Câu 1' },
      { role: 'assistant', content: 'Trả lời 1' },
      { role: 'user', content: 'Câu 2' },
    ]);
  });

  it('lỗi từ BE hiện thành câu dễ hiểu; Thử lại gửi lại đúng câu hỏi', () => {
    service.send('Xin chào');
    stream.error(new ApiError(404, 'No route'));
    expect(service.messages()[1]).toMatchObject({ status: 'error', error: expect.stringContaining('chưa được bật') });

    service.retry();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(service.messages().map((m) => m.text)).toEqual(['Xin chào', '']);
    expect(chat.mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'Xin chào' }]);
  });

  it('sự kiện error giữa chừng giữ lại phần đã nhận và báo lỗi', () => {
    service.send('Hỏi');
    stream.next({ type: 'delta', text: 'Một nửa' });
    stream.next({ type: 'error', message: 'Máy chủ AI quá tải' });
    expect(service.messages()[1]).toMatchObject({ text: 'Một nửa', status: 'error', error: 'Máy chủ AI quá tải' });
    expect(stream.observed).toBe(false);
  });

  it('Dừng: hủy request, giữ phần đã nhận', () => {
    service.send('Hỏi');
    stream.next({ type: 'delta', text: 'Đang nói' });
    service.stop();
    expect(stream.observed).toBe(false);
    expect(service.messages()[1]).toMatchObject({ text: 'Đang nói', status: 'stopped' });
    expect(service.busy()).toBe(false);
  });

  it('trả lời xong khi khung chat đang đóng thì đánh dấu có tin mới; mở ra thì xóa dấu', () => {
    service.send('Hỏi');
    stream.next({ type: 'done' });
    expect(service.unread()).toBe(true);
    service.setOpen(true);
    expect(service.unread()).toBe(false);
  });

  it('trimHistory giữ tin gần nhất và luôn bắt đầu bằng tin của người dùng', () => {
    const turns = Array.from({ length: MAX_HISTORY + 1 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: String(i),
    }));
    const trimmed = trimHistory(turns);
    expect(trimmed[0].role).toBe('user');
    expect(trimmed.at(-1)?.content).toBe(String(MAX_HISTORY));
    expect(trimmed.length).toBeLessThanOrEqual(MAX_HISTORY);
  });
});

describe('AssistantService: hiện chữ dần như đang gõ', () => {
  let service: AssistantService;
  let stream: Subject<AssistantEvent>;
  let pending: ((now: number) => void) | null;
  let now: number;
  const frame = (ms: number) => {
    now += ms;
    const run = pending;
    pending = null;
    run?.(now);
  };

  beforeEach(() => {
    pending = null;
    now = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: AssistantApi, useValue: { chat: () => (stream = new Subject<AssistantEvent>()) } },
        { provide: PageContext, useValue: { snapshot: () => context } },
        {
          provide: ASSISTANT_TYPING,
          useValue: {
            scheduler: { request: (cb: (n: number) => void) => ((pending = cb), 1), cancel: () => (pending = null) },
            options: { charsPerSecond: 100, maxLagSeconds: 10, instant: false },
          },
        },
      ],
    });
    service = TestBed.inject(AssistantService);
  });

  const reply = () => service.messages()[1];

  it('BE gửi cả đoạn một lúc: chữ vẫn hiện dần; gợi ý và trạng thái "xong" chờ chữ gõ xong', () => {
    service.send('Soạn todo');
    stream.next({ type: 'delta', text: 'Đây là gợi ý của tôi.' }); // 21 ký tự
    stream.next({ type: 'suggestion', suggestion: { title: 'Họp sprint', description: null } });
    stream.next({ type: 'done' });
    stream.complete();

    expect(reply().text).toBe('');
    frame(16);
    frame(84); // 1,6 + 8,4 ký tự (phần lẻ được cộng dồn) = 10 ký tự
    expect(reply().text).toBe('Đây là gợi');
    expect(reply().suggestions).toEqual([]);
    expect(reply().status).toBe('streaming');
    expect(service.busy()).toBe(true);

    frame(1000);
    expect(reply().text).toBe('Đây là gợi ý của tôi.');
    expect(reply().suggestions).toEqual([{ title: 'Họp sprint', description: null }]);
    expect(reply().status).toBe('done');
  });

  it('Dừng giữa lúc gõ: hiện ngay hết phần đã nhận', () => {
    service.send('Hỏi');
    stream.next({ type: 'delta', text: 'Một câu trả lời khá dài' });
    frame(16);
    service.stop();
    expect(reply()).toMatchObject({ text: 'Một câu trả lời khá dài', status: 'stopped' });
    expect(pending).toBeNull();
  });

  it('Xóa cuộc trò chuyện giữa lúc gõ: không còn gõ tiếp vào tin đã xóa', () => {
    service.send('Hỏi');
    stream.next({ type: 'delta', text: 'abc' });
    service.clear();
    frame(1000);
    expect(service.messages()).toEqual([]);
  });
});
