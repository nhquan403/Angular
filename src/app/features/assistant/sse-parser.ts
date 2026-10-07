import { TITLE_MAX, DESCRIPTION_MAX } from '../../core/models';
import { AssistantEvent } from './assistant-models';

export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Bộ đọc Server-Sent Events theo từng mẩu (chunk) nhận được qua mạng.
 * Một mẩu có thể chứa nửa sự kiện, hoặc nhiều sự kiện: phần chưa trọn được giữ lại chờ mẩu sau.
 * Theo chuẩn WHATWG: sự kiện kết thúc bằng dòng trống; dòng bắt đầu bằng ":" là chú thích;
 * nhiều dòng "data:" được nối bằng "\n"; chấp nhận cả \n, \r\n, \r.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];
    // Tách theo dòng trống (kết thúc một sự kiện). Phần cuối chưa có dòng trống thì giữ lại.
    const blocks = this.buffer.split(/\r\n\r\n|\n\n|\r\r/);
    this.buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const frame = parseBlock(block);
      if (frame !== null) {
        frames.push(frame);
      }
    }
    return frames;
  }
}

function parseBlock(block: string): SseFrame | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r\n|\n|\r/)) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      data.push(value);
    }
  }
  return data.length === 0 ? null : { event, data: data.join('\n') };
}

/**
 * Đổi một khung SSE thành AssistantEvent đã kiểm tra kiểu. Dữ liệu từ BE (và gián tiếp từ AI)
 * không được tin tuyệt đối: sai kiểu thì bỏ qua; gợi ý quá dài thì cắt về giới hạn của form.
 */
export function parseAssistantEvent(frame: SseFrame): AssistantEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(frame.data);
  } catch {
    return null;
  }
  const p = (payload !== null && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  switch (frame.event) {
    case 'delta':
      return typeof p['text'] === 'string' ? { type: 'delta', text: p['text'] } : null;
    case 'tool':
      return typeof p['name'] === 'string' ? { type: 'tool', name: p['name'] } : null;
    case 'suggestion': {
      const title = typeof p['title'] === 'string' ? p['title'].trim().slice(0, TITLE_MAX) : '';
      if (title === '') {
        return null;
      }
      const raw = typeof p['description'] === 'string' ? p['description'].trim().slice(0, DESCRIPTION_MAX) : '';
      return { type: 'suggestion', suggestion: { title, description: raw === '' ? null : raw } };
    }
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', message: typeof p['message'] === 'string' ? p['message'] : 'Trợ lý gặp lỗi' };
    default:
      return null;
  }
}
