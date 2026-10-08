/** Nguồn nhịp khung hình. Mặc định là requestAnimationFrame; test thay bằng đồng hồ giả. */
export interface FrameScheduler {
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
}

export interface TypewriterOptions {
  /** Tốc độ gõ bình thường (ký tự/giây). */
  charsPerSecond: number;
  /** Không để phần đã nhận nằm chờ quá chừng này giây: hàng đợi dài thì gõ nhanh lên. */
  maxLagSeconds: number;
  /** Hiện ngay, không gõ dần (người dùng bật "giảm chuyển động"). */
  instant: boolean;
}

export const DEFAULT_TYPEWRITER: TypewriterOptions = { charsPerSecond: 80, maxLagSeconds: 0.8, instant: false };

export const animationFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Hiện văn bản từ từ như đang gõ, độc lập với cách server gửi về.
 *
 * Server có thể gửi từng token hay cả đoạn một lúc; chữ nhận được vào hàng đợi rồi lộ ra theo thời gian thật
 * (tính theo số mili giây trôi qua, nên tab bị ẩn rồi quay lại cũng tự đuổi kịp). Hàng đợi càng dài thì gõ càng
 * nhanh, để chữ không bao giờ trễ quá `maxLagSeconds` so với dữ liệu đã có.
 *
 * `after(fn)` xếp một việc chạy SAU khi mọi chữ đã đưa vào trước đó hiện xong, ví dụ thẻ gợi ý hay trạng thái
 * "trả lời xong", để chúng không xuất hiện trước đoạn văn đứng trước chúng.
 */
export class Typewriter {
  private target = '';
  private shown = 0;
  private readonly pending: { at: number; run: () => void }[] = [];
  private frame: number | null = null;
  private lastTick: number | null = null;
  /** Phần lẻ ký tự chưa đủ để hiện (tốc độ thấp, khung hình dày). */
  private carry = 0;

  constructor(
    private readonly onText: (visible: string) => void,
    private readonly scheduler: FrameScheduler = animationFrameScheduler,
    private readonly options: TypewriterOptions = DEFAULT_TYPEWRITER,
  ) {}

  /** Đã hiện hết mọi chữ nhận được và không còn việc nào chờ. */
  get idle(): boolean {
    return this.shown >= this.target.length && this.pending.length === 0;
  }

  push(text: string): void {
    if (text === '') {
      return;
    }
    this.target += text;
    if (this.options.instant) {
      this.reveal(this.target.length);
    } else {
      this.schedule();
    }
  }

  after(run: () => void): void {
    if (this.shown >= this.target.length) {
      run();
      return;
    }
    this.pending.push({ at: this.target.length, run });
  }

  /** Hiện ngay mọi chữ đã nhận và chạy các việc đang chờ (dùng khi dừng, lỗi). */
  flush(): void {
    this.stopTicking();
    this.reveal(this.target.length);
  }

  /** Bỏ hết, không hiện thêm gì nữa (dùng khi xóa cuộc trò chuyện). */
  dispose(): void {
    this.stopTicking();
    this.pending.length = 0;
  }

  private schedule(): void {
    if (this.frame === null) {
      this.frame = this.scheduler.request((now) => this.tick(now));
    }
  }

  private tick(now: number): void {
    this.frame = null;
    const elapsed = this.lastTick === null ? 16 : Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const backlog = this.target.length - this.shown;
    const speed = Math.max(this.options.charsPerSecond, backlog / this.options.maxLagSeconds);
    this.carry += (speed * elapsed) / 1000;
    const step = Math.floor(this.carry);
    if (step > 0) {
      this.carry -= step;
      this.reveal(this.shown + step);
    }
    if (this.shown < this.target.length) {
      this.schedule();
    } else {
      this.lastTick = null;
      this.carry = 0;
    }
  }

  private reveal(upTo: number): void {
    const end = safeBoundary(this.target, Math.min(upTo, this.target.length));
    if (end !== this.shown) {
      this.shown = end;
      this.onText(this.target.slice(0, end));
    }
    while (this.pending.length > 0 && this.pending[0].at <= this.shown) {
      this.pending.shift()?.run();
    }
  }

  private stopTicking(): void {
    if (this.frame !== null) {
      this.scheduler.cancel(this.frame);
      this.frame = null;
    }
    this.lastTick = null;
    this.carry = 0;
  }
}

const COMBINING_MARK = /\p{M}/u;

/**
 * Lùi/tiến vị trí cắt để không tách đôi một ký tự: không cắt giữa cặp surrogate (emoji)
 * và không để dấu thanh tiếng Việt dạng tổ hợp (NFD, ví dụ "e" + dấu sắc) hiện tách khỏi chữ cái của nó.
 */
function safeBoundary(text: string, index: number): number {
  let end = index;
  while (end < text.length) {
    const code = text.charCodeAt(end);
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
    if (isLowSurrogate || COMBINING_MARK.test(text[end])) {
      end++;
    } else {
      break;
    }
  }
  return end;
}
