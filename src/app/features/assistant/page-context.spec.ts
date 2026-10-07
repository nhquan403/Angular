import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TodoDraftBridge } from '../todos/todo-draft-bridge';
import { DEFAULT_QUERY } from '../todos/todo-query';
import { PageContext } from './page-context';

describe('PageContext', () => {
  let context: PageContext;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    context = TestBed.inject(PageContext);
    router = TestBed.inject(Router);
  });

  it('trang danh sách: kèm bộ lọc trên URL và nội dung form tạo đang gõ', async () => {
    TestBed.inject(TodoDraftBridge).draft.set({ title: 'Họp', description: null });
    await router.navigateByUrl('/todos?completed=false&page=2');
    expect(context.snapshot()).toEqual({
      page: 'todo-list',
      path: '/todos',
      query: { ...DEFAULT_QUERY, completed: false, page: 2 },
      todoId: null,
      createDraft: { title: 'Họp', description: null },
    });
  });

  it('trang chi tiết: kèm mã todo; mã hỏng thì null', async () => {
    await router.navigateByUrl('/todos/42');
    expect(context.snapshot()).toMatchObject({ page: 'todo-detail', todoId: 42, query: null });
    await router.navigateByUrl('/todos/abc');
    expect(context.snapshot().todoId).toBeNull();
  });

  it('trang khác', async () => {
    await router.navigateByUrl('/admin/users');
    expect(context.snapshot().page).toBe('admin-users');
    await router.navigateByUrl('/khac');
    expect(context.snapshot()).toMatchObject({ page: 'other', path: '/khac' });
  });
});
