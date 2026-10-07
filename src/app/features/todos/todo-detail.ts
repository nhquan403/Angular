import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, filter, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { DESCRIPTION_MAX, TITLE_MAX, Todo } from '../../core/models';
import { ToastService } from '../../core/notify/toast-service';
import { RealtimeService } from '../../core/realtime/realtime-service';
import { TodoApi } from './todo-api';
import { notBlank } from './validators';

type DetailState = 'loading' | 'ready' | 'notFound' | 'deleted' | 'error';
type LoadResult = { ok: true; todo: Todo } | { ok: false; error: unknown };

/**
 * Xem và sửa một todo.
 *
 * Hai tình huống "người khác đụng vào todo này" được xử lý ở đây:
 *  1. Khóa lạc quan: khi lưu, ta gửi kèm `version`. Nếu người khác đã sửa trước, BE trả 409
 *     và ta cho người dùng chọn giữ thay đổi của mình hay lấy bản mới.
 *  2. Sự kiện thời gian thực: tab khác (hoặc admin) sửa/xóa todo đang mở thì màn hình này biết ngay.
 */
@Component({
  selector: 'app-todo-detail',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './todo-detail.html',
})
export class TodoDetail {
  /** Tham số :id trên URL (nhờ withComponentInputBinding). Luôn là chuỗi. */
  readonly id = input.required<string>();

  private readonly api = inject(TodoApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly state = signal<DetailState>('loading');
  protected readonly todo = signal<Todo | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, notBlank, Validators.maxLength(TITLE_MAX)]],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
  });
  protected readonly saving = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly serverErrors = signal<Readonly<Record<string, string>>>({});
  /** Bản mới hơn trên server mà người dùng chưa chấp nhận (do 409 hoặc do sự kiện thời gian thực). */
  protected readonly remoteVersion = signal<Todo | null>(null);

  /** Đang tự xóa: bỏ qua sự kiện DELETED do chính mình gây ra. */
  private deletingSelf = false;

  constructor() {
    toObservable(this.id)
      .pipe(
        switchMap((raw) => this.loadFirst(raw)),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyFirstLoad(result));

    this.realtime.events$
      .pipe(
        filter((event) => event.todoId === this.todo()?.id),
        debounceTime(200),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.onRemoteEvent(event.type === 'DELETED'));

    // Vừa kết nối lại: có thể đã lỡ sự kiện, kiểm tra lại bản trên server.
    this.realtime.resync$.pipe(takeUntilDestroyed()).subscribe(() => this.onRemoteEvent(false));
  }

  // ---------- tải ----------

  private loadFirst(raw: string): Observable<LoadResult> {
    this.state.set('loading');
    this.todo.set(null);
    this.remoteVersion.set(null);
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return of<LoadResult>({ ok: false, error: new ApiError(404, 'Mã todo không hợp lệ') });
    }
    return this.fetch(id);
  }

  private fetch(id: number): Observable<LoadResult> {
    return this.api.get(id).pipe(
      map((todo): LoadResult => ({ ok: true, todo })),
      catchError((error: unknown) => of<LoadResult>({ ok: false, error })),
    );
  }

  private applyFirstLoad(result: LoadResult): void {
    if (result.ok) {
      this.adopt(result.todo);
      this.state.set('ready');
      return;
    }
    if (result.error instanceof ApiError && result.error.status === 404) {
      // BE trả 404 cả khi todo là của người khác, để không lộ sự tồn tại của nó.
      this.state.set('notFound');
    } else {
      this.loadError.set(result.error instanceof ApiError ? result.error.message : 'Không tải được todo');
      this.state.set('error');
    }
  }

  protected retry(): void {
    this.state.set('loading');
    this.fetch(Number(this.id())).subscribe((result) => this.applyFirstLoad(result));
  }

  /** Nhận bản todo mới: cập nhật dữ liệu và đặt lại form (form trở về "chưa sửa gì"). */
  private adopt(todo: Todo): void {
    this.todo.set(todo);
    this.remoteVersion.set(null);
    this.form.reset({ title: todo.title, description: todo.description ?? '' });
  }

  // ---------- thay đổi từ nơi khác ----------

  private onRemoteEvent(deleted: boolean): void {
    const current = this.todo();
    if (current === null || this.deletingSelf) {
      return;
    }
    if (deleted) {
      this.state.set('deleted');
      return;
    }
    this.fetch(current.id).subscribe((result) => {
      if (!result.ok) {
        if (result.error instanceof ApiError && result.error.status === 404) {
          this.state.set('deleted');
        }
        return;
      }
      const latest = result.todo;
      if (latest.version === this.todo()?.version) {
        return; // chính là thay đổi của mình, đã có trên màn hình
      }
      if (this.form.pristine) {
        this.adopt(latest);
        this.toast.show('info', 'Todo vừa được cập nhật ở nơi khác');
      } else {
        this.remoteVersion.set(latest); // đang sửa dở thì không ghi đè, hỏi người dùng
      }
    });
  }

  /** Bỏ thay đổi của mình, lấy bản mới nhất. */
  protected useRemote(): void {
    const remote = this.remoteVersion();
    if (remote !== null) {
      this.adopt(remote);
    }
  }

  /** Giữ nội dung đang gõ nhưng nhận số phiên bản mới, để lần Lưu tiếp theo được BE chấp nhận. */
  protected keepMine(): void {
    const remote = this.remoteVersion();
    if (remote !== null) {
      this.todo.set(remote);
      this.remoteVersion.set(null);
    }
  }

  // ---------- thao tác ----------

  protected save(): void {
    const current = this.todo();
    if (current === null || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description } = this.form.getRawValue();
    this.saving.set(true);
    this.serverErrors.set({});
    this.api.update(current.id, title.trim(), description.trim() || null, current.version).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.adopt(updated);
        this.toast.show('success', 'Đã lưu');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof ApiError && error.status === 409) {
          // Người khác sửa trước: lấy bản mới nhất về để người dùng quyết định.
          this.toast.show('error', 'Todo đã được sửa ở nơi khác. Hãy chọn giữ thay đổi của bạn hoặc lấy bản mới.');
          this.fetch(current.id).subscribe((result) => {
            if (result.ok) {
              this.remoteVersion.set(result.todo);
            }
          });
        } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
          this.serverErrors.set(error.fieldErrors);
        } else {
          this.toast.error(error);
        }
      },
    });
  }

  protected toggle(): void {
    const current = this.todo();
    if (current === null || this.busy()) {
      return;
    }
    this.busy.set(true);
    const call = current.completed ? this.api.reopen(current.id) : this.api.complete(current.id);
    call.subscribe({
      next: (updated) => {
        this.busy.set(false);
        // Chỉ đổi dữ liệu, KHÔNG đặt lại form: nội dung người dùng đang gõ dở vẫn còn.
        this.todo.set(updated);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(error);
      },
    });
  }

  protected askDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    const current = this.todo();
    if (current === null) {
      return;
    }
    this.busy.set(true);
    this.deletingSelf = true;
    this.api.delete(current.id).subscribe({
      next: () => {
        this.toast.show('success', `Đã xóa "${current.title}"`);
        void this.router.navigate(['/todos']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.deletingSelf = false;
        this.confirmingDelete.set(false);
        this.toast.error(error);
      },
    });
  }
}
