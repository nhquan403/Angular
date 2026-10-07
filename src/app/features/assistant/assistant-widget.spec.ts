import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { TodoDraftBridge } from '../todos/todo-draft-bridge';
import { AssistantApi } from './assistant-api';
import { AssistantEvent } from './assistant-models';
import { AssistantWidget } from './assistant-widget';

describe('AssistantWidget', () => {
  let stream: Subject<AssistantEvent>;
  const chat = vi.fn(() => (stream = new Subject<AssistantEvent>()));

  beforeEach(() => {
    chat.mockClear();
    TestBed.configureTestingModule({
      imports: [AssistantWidget],
      providers: [provideRouter([]), { provide: AssistantApi, useValue: { chat } }],
    });
  });

  async function openWidget() {
    const fixture = TestBed.createComponent(AssistantWidget);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button[aria-controls="assistant-panel"]')!.click();
    await fixture.whenStable();
    return { fixture, el };
  }

  it('bấm nút thì khung chat mở ra, Esc thì đóng', async () => {
    const { fixture, el } = await openWidget();
    const panel = el.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Enter gửi tin, Shift+Enter không gửi; câu trả lời hiện dần', async () => {
    const { fixture, el } = await openWidget();
    const textarea = el.querySelector('textarea')!;
    textarea.value = 'Còn bao nhiêu việc?';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(chat).not.toHaveBeenCalled();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(chat).toHaveBeenCalledTimes(1);

    stream.next({ type: 'delta', text: 'Bạn còn 3 việc.' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Còn bao nhiêu việc?');
    expect(el.textContent).toContain('Bạn còn 3 việc.');
  });

  it('bấm "Điền vào form tạo" trên gợi ý thì chuyển gợi ý sang form', async () => {
    const { fixture, el } = await openWidget();
    const fill = vi.spyOn(TestBed.inject(TodoDraftBridge), 'fill').mockImplementation(() => undefined);
    el.querySelector<HTMLButtonElement>('ol button, .flex.w-full button')!.click(); // câu hỏi mẫu đầu tiên
    stream.next({ type: 'suggestion', suggestion: { title: 'Chuẩn bị họp sprint', description: 'Gửi agenda' } });
    stream.next({ type: 'done' });
    await fixture.whenStable();

    const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Điền vào form tạo'));
    button!.click();
    expect(fill).toHaveBeenCalledWith({ title: 'Chuẩn bị họp sprint', description: 'Gửi agenda' });
  });
});
