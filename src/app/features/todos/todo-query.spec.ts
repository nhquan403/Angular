import { convertToParamMap } from '@angular/router';
import { DEFAULT_QUERY, parseTodoQuery, toQueryParams } from './todo-query';

describe('todo-query', () => {
  it('URL trống cho ra bộ lọc mặc định', () => {
    expect(parseTodoQuery(convertToParamMap({}))).toEqual(DEFAULT_QUERY);
  });

  it('đọc đủ các tham số hợp lệ', () => {
    const query = parseTodoQuery(
      convertToParamMap({ completed: 'false', page: '3', size: '50', sortBy: 'title', direction: 'asc' }),
    );
    expect(query).toEqual({ completed: false, page: 3, size: 50, sortBy: 'title', direction: 'asc' });
  });

  it('giá trị lạ bị đưa về mặc định để BE không trả 400', () => {
    const query = parseTodoQuery(
      convertToParamMap({ completed: 'maybe', page: '-1', size: '9999', sortBy: 'password', direction: 'up' }),
    );
    expect(query).toEqual(DEFAULT_QUERY);
    expect(parseTodoQuery(convertToParamMap({ page: 'abc' })).page).toBe(0);
    expect(parseTodoQuery(convertToParamMap({ page: '1.5' })).page).toBe(0);
  });

  it('chỉ ghi lên URL những giá trị khác mặc định', () => {
    expect(toQueryParams(DEFAULT_QUERY)).toEqual({
      completed: null,
      page: null,
      size: null,
      sortBy: null,
      direction: null,
    });
    expect(toQueryParams({ ...DEFAULT_QUERY, completed: true, page: 2 })).toMatchObject({
      completed: 'true',
      page: '2',
    });
  });
});
