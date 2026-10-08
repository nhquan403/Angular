import { TextFieldModule } from '@angular/cdk/text-field';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AuthStore } from '../../core/auth/auth-store';
import { DESCRIPTION_MAX, Page, SORT_FIELDS, SortField, TITLE_MAX, Todo, TodoQuery } from '../../core/models';
import { ConfirmService } from '../../core/dialog/confirm-dialog';
import { ToastService } from '../../core/notify/toast-service';
import { RealtimeService } from '../../core/realtime/realtime-service';
import { Alert } from '../../shared/alert';
import { EmptyState } from '../../shared/empty-state';
import { applyServerErrors } from '../../shared/form-errors';
import { ActivityFeed } from '../realtime/activity-feed';
import { TodoDraft, TodoDraftBridge } from './todo-draft-bridge';
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
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    TextFieldModule,
    ActivityFeed,
    Alert,
    EmptyState,
  ],
  templateUrl: './todo-list.html',
})
export class TodoList {
  private readonly api = inject(TodoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly confirm = inject(ConfirmService);
  private readonly drafts = inject(TodoDraftBridge);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly auth = inject(AuthStore);

  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly pageSizes: number[] = [...PAGE_SIZES];
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
  /** Khung "Ghi chú" của form thêm nhanh: thu gọn mặc định cho gọn mắt. */
  protected readonly showDescription = signal(false);
  /** Vừa được điền gợi ý từ trợ lý: làm nổi khung form vài giây để người dùng thấy. */
  protected readonly draftApplied = signal(false);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  /** id các todo đang chờ BE trả lời (khóa nút để không bấm đúp). */
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
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

    // Cho trợ lý biết người dùng đang gõ gì trong form tạo (làm ngữ cảnh khi hỏi).
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ title = '', description = '' }) => {
      const hasText = title.trim() !== '' || description.trim() !== '';
      this.drafts.draft.set(hasText ? { title, description: description.trim() || null } : null);
    });
    // Trợ lý (hoặc nơi khác) gửi một bản nháp: điền vào form. Đọc xong là xóa để không điền lại lần nữa.
    effect(() => {
      if (this.drafts.pending() !== null) {
        const draft = this.drafts.consume();
        if (draft !== null) {
          this.applyDraft(draft);
        }
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.flashTimers.forEach(clearTimeout);
      this.drafts.draft.set(null);
    });
  }

  /** Điền bản nháp vào form tạo. Không tự gửi: người dùng xem lại rồi bấm "Thêm". */
  private applyDraft(draft: TodoDraft): void {
    this.form.setValue({ title: draft.title, description: draft.description ?? '' });
    this.form.markAsDirty();
    this.showDescription.set(draft.description !== null);
    this.draftApplied.set(true);
    const timer = setTimeout(() => {
      this.flashTimers.delete(timer);
      this.draftApplied.set(false);
    }, 2500);
    this.flashTimers.add(timer);
    // Chờ form vẽ xong (ô ghi chú có thể vừa hiện ra) rồi đưa con trỏ vào ô tiêu đề.
    setTimeout(() => this.titleInput()?.nativeElement.focus({ preventScroll: false }));
    this.toast.show('info', 'Đã điền gợi ý vào form. Kiểm tra lại rồi bấm "Thêm".');
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

  protected sortBy(value: string): void {
    const field = SORT_FIELDS.find((f) => f === value);
    if (field !== undefined) {
      this.go({ sortBy: field, page: 0 });
    }
  }

  protected onPage(event: PageEvent): void {
    this.go({ page: event.pageIndex, size: event.pageSize });
  }

  // ---------- thêm, đổi trạng thái, xóa ----------

  protected create(formDirective: FormGroupDirective): void {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description } = this.form.getRawValue();
    this.creating.set(true);
    this.api.create(title.trim(), description.trim() || null).subscribe({
      next: (todo) => {
        this.creating.set(false);
        // resetForm (không chỉ form.reset) để xóa cả trạng thái "đã submit", tránh ô trống bị tô đỏ.
        formDirective.resetForm();
        this.showDescription.set(false);
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
        if (!(error instanceof ApiError) || !applyServerErrors(this.form, error.fieldErrors)) {
          this.toast.error(error);
        } else if (this.form.controls.description.hasError('server')) {
          this.showDescription.set(true); // lỗi nằm ở ô ghi chú đang thu gọn: mở ra để người dùng thấy
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
            page === null ? page : { ...page, content: page.content.map((t) => (t.id === updated.id ? updated : t)) },
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

  protected async askDelete(todo: Todo): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Xóa todo?',
      message: `"${todo.title}" sẽ bị xóa vĩnh viễn và không khôi phục được.`,
      confirmText: 'Xóa',
      danger: true,
      icon: 'delete',
    });
    if (confirmed) {
      this.delete(todo);
    }
  }

  private delete(todo: Todo): void {
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
