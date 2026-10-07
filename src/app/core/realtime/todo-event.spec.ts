import { parseTodoEvent } from './todo-event';

const valid = {
  type: 'CREATED',
  todoId: 5,
  ownerId: 2,
  title: 'Học "Java"\n',
  completed: false,
  occurredAt: '2026-10-07T09:15:30Z',
};

describe('parseTodoEvent', () => {
  it('đọc sự kiện hợp lệ của BE, kể cả title có ký tự đặc biệt', () => {
    expect(parseTodoEvent(JSON.stringify(valid))).toEqual(valid);
  });

  it('chấp nhận ownerId và title là null', () => {
    const event = parseTodoEvent(JSON.stringify({ ...valid, ownerId: null, title: null }));
    expect(event?.ownerId).toBeNull();
    expect(event?.title).toBeNull();
  });

  it.each([
    ['không phải JSON', 'xin chào'],
    ['không phải object', '42'],
    ['null', 'null'],
    ['type lạ', JSON.stringify({ ...valid, type: 'EXPLODED' })],
    ['thiếu todoId', JSON.stringify({ ...valid, todoId: undefined })],
    ['todoId là chuỗi', JSON.stringify({ ...valid, todoId: '5' })],
    ['completed không phải boolean', JSON.stringify({ ...valid, completed: 'no' })],
  ])('bỏ qua tin nhắn %s', (_name, raw) => {
    expect(parseTodoEvent(raw)).toBeNull();
  });
});
