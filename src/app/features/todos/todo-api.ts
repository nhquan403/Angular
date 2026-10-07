import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config';
import { Page, Todo, TodoQuery } from '../../core/models';

/** Gọi các endpoint /api/todos của BE (TodoController). BE tự lọc theo chủ sở hữu: USER chỉ thấy todo của mình, ADMIN thấy tất cả. */
@Injectable({ providedIn: 'root' })
export class TodoApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/todos`;

  list(query: TodoQuery): Observable<Page<Todo>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sortBy', query.sortBy)
      .set('direction', query.direction);
    if (query.completed !== null) {
      params = params.set('completed', query.completed);
    }
    return this.http.get<Page<Todo>>(this.url, { params });
  }

  get(id: number): Observable<Todo> {
    return this.http.get<Todo>(`${this.url}/${id}`);
  }

  create(title: string, description: string | null): Observable<Todo> {
    return this.http.post<Todo>(this.url, { title, description });
  }

  /** `version` là phiên bản đang giữ; BE trả 409 nếu người khác đã sửa trước. */
  update(id: number, title: string, description: string | null, version: number): Observable<Todo> {
    return this.http.put<Todo>(`${this.url}/${id}`, { title, description, version });
  }

  complete(id: number): Observable<Todo> {
    return this.http.patch<Todo>(`${this.url}/${id}/complete`, null);
  }

  reopen(id: number): Observable<Todo> {
    return this.http.patch<Todo>(`${this.url}/${id}/reopen`, null);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
