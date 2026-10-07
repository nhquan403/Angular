import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { DESCRIPTION_MAX, Page, SORT_FIELDS, SortField, TITLE_MAX, Todo, TodoQuery } from '../../core/models';
import { RealtimeService } from '../../core/realtime/realtime-service';
import { ToastService } from '../../core/notify/toast-service';
import { ActivityFeed } from '../realtime/activity-feed';
import { notBlank } from './validators';
import { TodoApi } from './todo-api';
import { DEFAULT_QUERY, PAGE_SIZES, parseTodoQuery, toQueryParams } from './todo-query';

const SORT_LABEL: Readonly<Record<SortField, string>> = {
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày sửa',
  title: 'Tiêu đề',
  id: 'Mã',
};

type LoadResult = { ok: true; page: Page<Todo> } | { ok: false; error: unknown };

/**
 * Danh sách todo: lọc, sắp xếp, phân trang (trạng thái nằm trên URL), thêm nhanh, đánh dấu xong, xóa.
 * Tự cập nhật khi BE đẩy sự kiện qua SSE/WebSocket.
 */
@Component({
  selector: 'app-todo-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ActivityFeed],
  templateUrl: './todo-list.html',
})
export class TodoList {
  private readonly api = inject(TodoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly auth = inject(AuthStore);

  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly sortFields = SORT_FIELDS;
  protected readonly sortLabel = SORT_LABEL;

  /** Bộ lọc hiện tại, suy ra từ URL. */
  protected readonly query = toSignal(this.route.queryParamMap.pipe(map(parseTodoQuery)), {
    initialValue: DEFAULT_QUERY,
  });

  protected readonly page = signal<Page<Todo> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, notBlank, Validators.maxLength(TITLE_MAX)]],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
  });
  protected readonly creating = signal(false);
  protected readonly serverErrors = signal<Readonly<Record<string, string>>>({});

  /** id các todo đang chờ BE trả lời (khóa nút để không bấm đúp). */
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
  /** id todo đang hỏi xác nhận xóa. */
  protected readonly confirmingDelete = signal<number | null>(null);
  /** id các todo vừa thay đổi (do mình hoặc người khác) để làm nổi bật vài giây. */
  protected readonly flashed = signal<ReadonlySet<number>>(new Set());

  private readonly reload$ = new Subject<void>();
  private readonly flashTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    // Tải lại mỗi khi bộ lọc đổi HOẶC có yêu cầu tải lại. switchMap hủy request cũ nếu có request mới.
    combineLatest([this.route.queryParamMap.pipe(map(parseTodoQuery)), this.reload$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([query]) => this.load(query)),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyResult(result));

    // Sự kiện từ BE: làm nổi dòng đó ngay, và gom các sự kiện dồn dập thành MỘT lần tải lại.
    this.realtime.events$.pipe(takeUntilDestroyed()).subscribe((event) => this.flash(event.todoId));
    this.realtime.events$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.reload$.next());
    // BE không phát lại sự kiện đã lỡ, nên sau khi kết nối lại phải tải lại để bắt kịp.
    this.realtime.resync$.pipe(takeUntilDestroyed()).subscribe(() => this.reload$.next());

    inject(DestroyRef).onDestroy(() => this.flashTimers.forEach(clearTimeout));
  }

  // ---------- tải dữ liệu ----------

  private load(query: TodoQuery): Observable<LoadResult> {
    this.loading.set(true);
    return this.api.list(query).pipe(
      map((page): LoadResult => ({ ok: true, page })),
      catchError((error: unknown) => of<LoadResult>({ ok: false, error })),
    );
  }

  private applyResult(result: LoadResult): void {
    this.loading.set(false);
    if (!result.ok) {
      const message = result.error instanceof ApiError ? result.error.message : 'Không tải được danh sách';
      this.loadError.set(message);
      if (this.page() !== null) {
        this.toast.error(result.error); // đã có dữ liệu cũ trên màn hình thì chỉ báo nhẹ
      }
      return;
    }
    this.loadError.set(null);
    const { page } = result;
    // Xóa hết todo của trang cuối thì trang hiện tại không còn gì: lùi về trang cuối thực sự.
    if (page.content.length === 0 && page.page > 0) {
      this.go({ page: Math.max(0, page.totalPages - 1) });
      return;
    }
    this.page.set(page);
  }

  protected reload(): void {
    this.reload$.next();
  }

  // ---------- bộ lọc, sắp xếp, phân trang ----------

  /** Ghi bộ lọc mới lên URL; việc tải dữ liệu diễn ra do URL đổi. */
  protected go(change: Partial<TodoQuery>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams({ ...this.query(), ...change }),
      queryParamsHandling: 'merge',
    });
  }

  protected filterBy(completed: boolean | null): void {
    this.go({ completed, page: 0 });
  }

  protected toggleDirection(): void {
    this.go({ direction: this.query().direction === 'desc' ? 'asc' : 'desc', page: 0 });
  }

  protected sortBy(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const field = SORT_FIELDS.find((f) => f === value);
    if (field !== undefined) {
      this.go({ sortBy: field, page: 0 });
    }
  }

  protected pageSize(event: Event): void {
    this.go({ size: Number((event.target as HTMLSelectElement).value), page: 0 });
  }

  // ---------- thêm, đổi trạng thái, xóa ----------

  protected create(): void {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description } = this.form.getRawValue();
    this.creating.set(true);
    this.serverErrors.set({});
    this.api.create(title.trim(), description.trim() || null).subscribe({
      next: (todo) => {
        this.creating.set(false);
        this.form.reset();
        this.flash(todo.id);
        this.toast.show('success', 'Đã thêm todo');
        // Todo mới nằm ở đầu danh sách mặc định (mới nhất trước), nên quay về trang đầu.
        if (this.query().page !== 0) {
          this.go({ page: 0 });
        } else {
          this.reload();
        }
      },
      error: (error: unknown) => {
        this.creating.set(false);
        if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
          this.serverErrors.set(error.fieldErrors);
        } else {
          this.toast.error(error);
        }
      },
    });
  }

  protected toggle(todo: Todo): void {
    this.setBusy(todo.id, true);
    const call = todo.completed ? this.api.reopen(todo.id) : this.api.complete(todo.id);
    call.subscribe({
      next: (updated) => {
        this.setBusy(todo.id, false);
        this.flash(updated.id);
        // Đang lọc theo trạng thái thì todo vừa đổi phải biến khỏi danh sách, nên tải lại.
        if (this.query().completed === null) {
          this.page.update((page) =>
            page === null
              ? page
              : { ...page, content: page.content.map((t) => (t.id === updated.id ? updated : t)) },
          );
        } else {
          this.reload();
        }
      },
      error: (error: unknown) => {
        this.setBusy(todo.id, false);
        this.toast.error(error);
      },
    });
  }

  protected askDelete(todo: Todo): void {
    this.confirmingDelete.set(todo.id);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  protected confirmDelete(todo: Todo): void {
    this.confirmingDelete.set(null);
    this.setBusy(todo.id, true);
    this.api.delete(todo.id).subscribe({
      next: () => {
        this.setBusy(todo.id, false);
        this.toast.show('success', `Đã xóa "${todo.title}"`);
        this.reload();
      },
      error: (error: unknown) => {
        this.setBusy(todo.id, false);
        this.toast.error(error);
        // 404: todo đã bị xóa ở nơi khác, danh sách đang cũ.
        if (error instanceof ApiError && error.status === 404) {
          this.reload();
        }
      },
    });
  }

  // ---------- phụ trợ ----------

  protected isBusy(id: number): boolean {
    return this.busy().has(id);
  }

  private setBusy(id: number, on: boolean): void {
    this.busy.update((set) => {
      const next = new Set(set);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private flash(id: number): void {
    this.flashed.update((set) => new Set(set).add(id));
    const timer = setTimeout(() => {
      this.flashTimers.delete(timer);
      this.flashed.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }, 2500);
    this.flashTimers.add(timer);
  }
}
