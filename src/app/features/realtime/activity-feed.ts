import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { TodoEventType } from '../../core/models';
import { RealtimeService } from '../../core/realtime/realtime-service';

const EVENT_LABEL: Readonly<Record<TodoEventType, string>> = {
  CREATED: 'Đã tạo',
  UPDATED: 'Đã sửa',
  COMPLETED: 'Đã hoàn thành',
  REOPENED: 'Mở lại',
  DELETED: 'Đã xóa',
};

const EVENT_ICON: Readonly<Record<TodoEventType, string>> = {
  CREATED: '＋',
  UPDATED: '✎',
  COMPLETED: '✔',
  REOPENED: '↺',
  DELETED: '🗑',
};

/**
 * Nhật ký sự kiện nhận được qua SSE/WebSocket. Mở trang này ở hai tab, thêm/sửa/xóa todo ở tab này
 * và xem tab kia nhận sự kiện ngay là cách dễ nhất để thấy tính năng thời gian thực chạy.
 */
@Component({
  selector: 'app-activity-feed',
  imports: [DatePipe, RouterLink],
  templateUrl: './activity-feed.html',
})
export class ActivityFeed {
  protected readonly realtime = inject(RealtimeService);
  protected readonly auth = inject(AuthStore);
  protected readonly label = EVENT_LABEL;
  protected readonly icon = EVENT_ICON;
}
