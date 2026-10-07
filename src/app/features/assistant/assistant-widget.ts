import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { Component, ElementRef, afterRenderEffect, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TodoDraftBridge } from '../todos/todo-draft-bridge';
import { TodoSuggestion } from './assistant-models';
import { AssistantService, MAX_INPUT } from './assistant-service';
import { PageContext } from './page-context';

const TOOL_LABEL: Readonly<Record<string, { running: string; done: string }>> = {
  list_todos: { running: 'Đang đọc danh sách todo...', done: 'Đã đọc danh sách todo' },
  get_todo: { running: 'Đang đọc chi tiết todo...', done: 'Đã đọc chi tiết todo' },
  suggest_todo: { running: 'Đang soạn gợi ý...', done: 'Đã soạn gợi ý' },
};

/**
 * Trợ lý AI dạng chat nổi ở góc phải dưới. Bấm nút để mở khung chat trượt lên.
 * Câu trả lời là văn bản thuần (không render HTML) nên nội dung từ AI không thể chèn mã vào trang.
 */
@Component({
  selector: 'app-assistant-widget',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, TextFieldModule],
  templateUrl: './assistant-widget.html',
  host: { class: 'fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 max-sm:right-3 max-sm:bottom-3' },
  styles: `
    .panel {
      animation: assistant-in 180ms cubic-bezier(0.2, 0, 0, 1);
      transform-origin: bottom right;
      box-shadow: var(--mat-sys-level3);
    }
    @keyframes assistant-in {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.96);
      }
    }
    .dot {
      animation: assistant-typing 1.2s infinite ease-in-out;
    }
    .dot:nth-child(2) {
      animation-delay: 0.15s;
    }
    .dot:nth-child(3) {
      animation-delay: 0.3s;
    }
    @keyframes assistant-typing {
      0%,
      60%,
      100% {
        opacity: 0.25;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-3px);
      }
    }
  `,
})
export class AssistantWidget {
  protected readonly assistant = inject(AssistantService);
  private readonly drafts = inject(TodoDraftBridge);
  private readonly pageContext = inject(PageContext);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly maxInput = MAX_INPUT;
  protected readonly input = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly autosize = viewChild(CdkTextareaAutosize);

  /** Câu hỏi mẫu theo trang đang mở, hiện khi chưa có tin nhắn nào. */
  protected readonly starters = computed(() => {
    // Đọc open() để danh sách được tính lại mỗi lần mở khung (trang có thể đã đổi).
    this.assistant.open();
    switch (this.pageContext.snapshot().page) {
      case 'todo-detail':
        return [
          'Chia todo này thành các bước nhỏ',
          'Viết lại tiêu đề todo này cho rõ ràng hơn',
          'Tôi còn bao nhiêu việc chưa xong?',
        ];
      case 'todo-list':
        return [
          'Tóm tắt các việc chưa xong',
          'Gợi ý 3 việc nên làm tiếp theo',
          'Soạn giúp tôi todo "chuẩn bị họp sprint"',
        ];
      default:
        return [
          'Tôi còn bao nhiêu việc chưa xong?',
          'Việc nào tôi tạo lâu nhất mà chưa xong?',
          'Gợi ý một todo cho tuần này',
        ];
    }
  });

  constructor() {
    // Mở khung: đưa con trỏ vào ô nhập.
    effect(() => {
      if (this.assistant.open()) {
        setTimeout(() => this.composer()?.nativeElement.focus());
        // Font web tải xong sau lần đo đầu thì chiều cao dòng đổi: đo lại để chữ không bị cắt.
        void document.fonts?.ready.then(() => this.autosize()?.resizeToFitContent(true));
      }
    });
    // Có tin mới hoặc chữ mới: cuộn xuống cuối, trừ khi người dùng đang kéo lên đọc tin cũ.
    afterRenderEffect(() => {
      this.assistant.messages();
      const el = this.scroller()?.nativeElement;
      if (el !== undefined && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  protected send(text = this.input()): void {
    if (text.trim() === '' || this.assistant.busy()) {
      return;
    }
    this.assistant.send(text);
    this.input.set('');
    // Vừa gửi thì luôn cuộn xuống, dù trước đó đang đọc tin cũ.
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el !== undefined) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /** Enter để gửi, Shift+Enter để xuống dòng. Đang gõ tiếng Việt (IME) thì Enter là chốt chữ, không gửi. */
  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  protected close(): void {
    this.assistant.setOpen(false);
  }

  protected fill(suggestion: TodoSuggestion): void {
    this.drafts.fill(suggestion);
    // Màn hình nhỏ: khung chat che form, đóng lại để người dùng thấy form vừa được điền.
    if (this.breakpoints.isMatched('(max-width: 639px)')) {
      this.close();
    }
  }

  protected toolText(name: string, running: boolean): string {
    const label = TOOL_LABEL[name];
    if (label === undefined) {
      return running ? `Đang dùng ${name}...` : `Đã dùng ${name}`;
    }
    return running ? label.running : label.done;
  }
}
