import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { TodoEventType } from '../../core/models';
import { RealtimeService } from '../../core/realtime/realtime-service';
import { Alert } from '../../shared/alert';
import { EmptyState } from '../../shared/empty-state';

interface EventMeta {
  label: string;
  icon: string;
  /** Lớp Tailwind tô màu biểu tượng. */
  tone: string;
}

const EVENT_META: Readonly<Record<TodoEventType, EventMeta>> = {
  CREATED: { label: 'Đã tạo', icon: 'add', tone: 'bg-primary-container text-on-primary-container' },
  UPDATED: { label: 'Đã sửa', icon: 'edit', tone: 'bg-secondary-container text-on-secondary-container' },
  COMPLETED: { label: 'Đã hoàn thành', icon: 'check', tone: 'bg-success-container text-success' },
  REOPENED: { label: 'Mở lại', icon: 'replay', tone: 'bg-tertiary-container text-on-tertiary-container' },
  DELETED: { label: 'Đã xóa', icon: 'delete', tone: 'bg-error-container text-on-error-container' },
};

/**
 * Nhật ký sự kiện nhận được qua SSE/WebSocket. Mở trang này ở hai tab, thêm/sửa/xóa todo ở tab này
 * và xem tab kia nhận sự kiện ngay là cách dễ nhất để thấy tính năng thời gian thực chạy.
 */
@Component({
  selector: 'app-activity-feed',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, Alert, EmptyState],
  templateUrl: './activity-feed.html',
})
export class ActivityFeed {
  protected readonly realtime = inject(RealtimeService);
  protected readonly auth = inject(AuthStore);
  protected readonly meta = EVENT_META;
}
