import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TodoDraftBridge } from './todo-draft-bridge';

describe('TodoDraftBridge', () => {
  let bridge: TodoDraftBridge;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    bridge = TestBed.inject(TodoDraftBridge);
    router = TestBed.inject(Router);
  });

  it('đang ở trang danh sách: chỉ đặt bản nháp chờ, không chuyển trang', async () => {
    await router.navigateByUrl('/todos?page=1');
    bridge.fill({ title: 'Họp sprint', description: 'Phòng 3' });
    await TestBed.inject(Router).navigated;
    expect(router.url).toBe('/todos?page=1');
    expect(bridge.consume()).toEqual({ title: 'Họp sprint', description: 'Phòng 3' });
    expect(bridge.consume()).toBeNull(); // đọc một lần là hết
  });

  it('đang ở trang khác: chuyển về danh sách để form nhận bản nháp', async () => {
    await router.navigateByUrl('/todos/5');
    bridge.fill({ title: 'Việc mới', description: null });
    await new Promise((resolve) => setTimeout(resolve));
    expect(router.url).toBe('/todos');
    expect(bridge.pending()).toEqual({ title: 'Việc mới', description: null });
  });
});
