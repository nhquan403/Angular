import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from } from 'rxjs';
import { API_BASE_URL } from '../../core/config';
import { AssistantEvent, AssistantRequest } from './assistant-models';
import { SseParser, parseAssistantEvent } from './sse-parser';

/**
 * Gọi trợ lý AI của BE: POST /api/assistant/chat, nhận câu trả lời dạng text/event-stream.
 *
 * Không dùng EventSource vì nó chỉ gửi được GET và không gắn được header Authorization.
 * Thay vào đó dùng HttpClient với `reportProgress`: mỗi lần có thêm dữ liệu, Angular phát sự kiện
 * DownloadProgress kèm `partialText` (toàn bộ phần đã nhận), ta lấy phần MỚI và đưa qua SseParser.
 * Nhờ đi qua HttpClient, request vẫn được gắn Bearer, tự làm mới token khi 401 và đổi lỗi thành ApiError
 * như mọi request khác. Hủy đăng ký (unsubscribe) là hủy luôn request, BE thấy client ngắt kết nối.
 */
@Injectable({ providedIn: 'root' })
export class AssistantApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/assistant/chat`;

  chat(request: AssistantRequest): Observable<AssistantEvent> {
    let parser = new SseParser();
    /** Số ký tự đã đưa vào parser; partialText luôn là TOÀN BỘ phần đã nhận nên chỉ lấy phần sau mốc này. */
    let seen = 0;
    const feed = (received: string, flush = false): AssistantEvent[] => {
      const fresh = received.length > seen ? received.slice(seen) : '';
      seen = Math.max(seen, received.length);
      // Kết thúc response: thêm dòng trống để chốt sự kiện cuối nếu BE quên dòng trống.
      return parser
        .push(flush ? `${fresh}\n\n` : fresh)
        .map(parseAssistantEvent)
        .filter((e): e is AssistantEvent => e !== null);
    };

    return this.http
      .post(this.url, request, {
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .pipe(
        concatMap((event) => {
          if (event.type === HttpEventType.Sent) {
            // Bắt đầu một lần gửi (kể cả lần gửi lại sau khi làm mới token): bỏ mọi thứ của lần trước.
            parser = new SseParser();
            seen = 0;
            return from([]);
          }
          if (event.type === HttpEventType.DownloadProgress && event.partialText !== undefined) {
            return from(feed(event.partialText));
          }
          if (event.type === HttpEventType.Response) {
            return from(feed(event.body ?? '', true));
          }
          return from([]);
        }),
      );
  }
}
