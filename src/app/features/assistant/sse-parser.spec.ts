import { SseParser, parseAssistantEvent } from './sse-parser';

describe('SseParser', () => {
  it('đọc nhiều sự kiện trong một mẩu, bỏ qua dòng chú thích', () => {
    const frames = new SseParser().push(
      ': keep-alive\n\nevent: delta\ndata: {"text":"Chào"}\n\nevent: done\ndata: {}\n\n',
    );
    expect(frames).toEqual([
      { event: 'delta', data: '{"text":"Chào"}' },
      { event: 'done', data: '{}' },
    ]);
  });

  it('sự kiện bị cắt giữa chừng thì chờ mẩu sau mới trả về', () => {
    const parser = new SseParser();
    expect(parser.push('event: delta\ndata: {"te')).toEqual([]);
    expect(parser.push('xt":"A"}\n')).toEqual([]);
    expect(parser.push('\nevent: done\r\ndata: {}\r\n\r\n')).toEqual([
      { event: 'delta', data: '{"text":"A"}' },
      { event: 'done', data: '{}' },
    ]);
  });

  it('nhiều dòng data được nối bằng xuống dòng; không có event thì là "message"', () => {
    expect(new SseParser().push('data: a\ndata: b\n\n')).toEqual([{ event: 'message', data: 'a\nb' }]);
  });
});

describe('parseAssistantEvent', () => {
  it('đọc đủ các loại sự kiện', () => {
    expect(parseAssistantEvent({ event: 'delta', data: '{"text":"x"}' })).toEqual({ type: 'delta', text: 'x' });
    expect(parseAssistantEvent({ event: 'tool', data: '{"name":"list_todos"}' })).toEqual({
      type: 'tool',
      name: 'list_todos',
    });
    expect(parseAssistantEvent({ event: 'done', data: '{}' })).toEqual({ type: 'done' });
    expect(parseAssistantEvent({ event: 'error', data: '{"message":"Hết hạn mức"}' })).toEqual({
      type: 'error',
      message: 'Hết hạn mức',
    });
  });

  it('gợi ý: cắt khoảng trắng, mô tả rỗng thành null, quá dài thì cắt theo giới hạn form', () => {
    expect(parseAssistantEvent({ event: 'suggestion', data: '{"title":"  Họp sprint  ","description":"  "}' })).toEqual(
      {
        type: 'suggestion',
        suggestion: { title: 'Họp sprint', description: null },
      },
    );
    const long = parseAssistantEvent({ event: 'suggestion', data: JSON.stringify({ title: 'x'.repeat(500) }) });
    expect(long?.type === 'suggestion' && long.suggestion.title.length).toBe(100);
  });

  it.each([
    ['JSON hỏng', { event: 'delta', data: '{' }],
    ['delta thiếu text', { event: 'delta', data: '{}' }],
    ['gợi ý không có tiêu đề', { event: 'suggestion', data: '{"title":"  "}' }],
    ['loại lạ', { event: 'bogus', data: '{}' }],
  ])('bỏ qua sự kiện %s', (_name, frame) => {
    expect(parseAssistantEvent(frame)).toBeNull();
  });
});
