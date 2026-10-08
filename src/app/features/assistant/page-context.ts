import { Injectable, inject } from '@angular/core';
import { Router, convertToParamMap } from '@angular/router';
import { TodoDraftBridge } from '../todos/todo-draft-bridge';
import { parseTodoQuery } from '../todos/todo-query';
import { AssistantContext } from './assistant-models';

/**
 * Chụp "người dùng đang ở đâu, đang làm gì" ngay lúc gửi câu hỏi, để trợ lý trả lời đúng ngữ cảnh
 * ("todo này", "danh sách đang lọc", "cái tôi đang gõ").
 * Suy ra từ URL (bộ lọc của danh sách nằm sẵn trên URL) và từ form tạo đang gõ dở.
 */
@Injectable({ providedIn: 'root' })
export class PageContext {
  private readonly router = inject(Router);
  private readonly drafts = inject(TodoDraftBridge);

  snapshot(): AssistantContext {
    const tree = this.router.parseUrl(this.router.url);
    const segments = tree.root.children['primary']?.segments.map((s) => s.path) ?? [];
    const path = '/' + segments.join('/');
    const base: AssistantContext = { page: 'other', path, query: null, todoId: null, createDraft: null };

    if (segments.length === 1 && segments[0] === 'todos') {
      return {
        ...base,
        page: 'todo-list',
        query: parseTodoQuery(convertToParamMap(tree.queryParams)),
        createDraft: this.drafts.draft(),
      };
    }
    if (segments.length === 2 && segments[0] === 'todos') {
      const id = Number(segments[1]);
      return { ...base, page: 'todo-detail', todoId: Number.isInteger(id) && id > 0 ? id : null };
    }
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
      return { ...base, page: 'admin-users' };
    }
    return base;
  }
}
