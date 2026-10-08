import { FrameScheduler, Typewriter, TypewriterOptions } from './typewriter';

/** Đồng hồ khung hình giả: mỗi lần frame(ms) là trôi qua ms mili giây rồi chạy callback đang chờ. */
class FakeFrames implements FrameScheduler {
  now = 0;
  private callback: ((now: number) => void) | null = null;
  request(callback: (now: number) => void): number {
    this.callback = callback;
    return 1;
  }
  cancel(): void {
    this.callback = null;
  }
  get waiting(): boolean {
    return this.callback !== null;
  }
  frame(ms = 16): void {
    this.now += ms;
    const callback = this.callback;
    this.callback = null;
    callback?.(this.now);
  }
}

const OPTIONS: TypewriterOptions = { charsPerSecond: 100, maxLagSeconds: 1, instant: false };

describe('Typewriter', () => {
  let frames: FakeFrames;
  let visible: string;
  let writer: Typewriter;

  beforeEach(() => {
    frames = new FakeFrames();
    visible = '';
    writer = new Typewriter((text) => (visible = text), frames, OPTIONS);
  });

  it('cả đoạn đến một lúc vẫn hiện dần theo thời gian', () => {
    writer.push('Xin chào bạn'); // 12 ký tự, 100 ký tự/giây
    expect(visible).toBe('');
    frames.frame(16); // khung đầu tính 16ms -> 1 ký tự
    expect(visible).toBe('X');
    frames.frame(50); // +5 ký tự
    expect(visible).toBe('Xin ch');
    frames.frame(1000);
    expect(visible).toBe('Xin chào bạn');
    expect(frames.waiting).toBe(false); // hết chữ thì ngừng xin khung hình
  });

  it('hàng đợi dài thì gõ nhanh hơn, không trễ quá maxLagSeconds', () => {
    writer.push('a'.repeat(1000)); // ở 100 ký tự/giây sẽ mất 10 giây
    for (let i = 0; i < 70; i++) {
      frames.frame(16); // ~1,1 giây
    }
    expect(visible.length).toBeGreaterThan(600);
    for (let i = 0; i < 200 && frames.waiting; i++) {
      frames.frame(16);
    }
    expect(visible.length).toBe(1000);
  });

  it('after() chạy sau khi phần chữ đứng trước đã hiện hết; không có chữ chờ thì chạy ngay', () => {
    const order: string[] = [];
    writer.after(() => order.push('ngay'));
    writer.push('abcd');
    writer.after(() => order.push('sau abcd'));
    writer.push('efgh');
    writer.after(() => order.push('sau efgh'));
    expect(order).toEqual(['ngay']);
    frames.frame(16);
    frames.frame(30); // 4 ký tự
    expect(visible).toBe('abcd');
    expect(order).toEqual(['ngay', 'sau abcd']);
    frames.frame(100);
    expect(order).toEqual(['ngay', 'sau abcd', 'sau efgh']);
  });

  it('flush() hiện ngay mọi chữ đã nhận và chạy việc đang chờ; dispose() bỏ hết', () => {
    let done = false;
    writer.push('một đoạn dài');
    writer.after(() => (done = true));
    writer.flush();
    expect(visible).toBe('một đoạn dài');
    expect(done).toBe(true);
    expect(frames.waiting).toBe(false);

    let ran = false;
    writer.push(' nữa');
    writer.after(() => (ran = true));
    writer.dispose();
    frames.frame(1000);
    expect(ran).toBe(false);
  });

  it('không tách dấu tiếng Việt dạng tổ hợp (NFD) hay emoji khỏi ký tự của nó', () => {
    const full = `${'Việt'.normalize('NFD')} 👍`; // "e" + dấu mũ + dấu nặng; emoji là cặp surrogate
    const seen: string[] = [];
    writer = new Typewriter((text) => seen.push(text), frames, { ...OPTIONS, charsPerSecond: 62.5 }); // 1 ký tự/khung
    writer.push(full);
    for (let i = 0; i < 20 && frames.waiting; i++) {
      frames.frame(16);
    }
    expect(seen.at(-1)).toBe(full);
    for (const text of seen) {
      // Ký tự ngay sau chỗ cắt không được là dấu tổ hợp hay nửa sau của cặp surrogate.
      const next = full.charAt(text.length);
      expect(/\p{M}/u.test(next) || /[\uDC00-\uDFFF]/.test(next)).toBe(false);
    }
    expect(seen).not.toContain('Vi' + 'e'); // "e" không bao giờ hiện trần trụi thiếu dấu
  });

  it('chế độ instant (giảm chuyển động) hiện ngay', () => {
    writer = new Typewriter((text) => (visible = text), frames, { ...OPTIONS, instant: true });
    writer.push('Hiện luôn');
    expect(visible).toBe('Hiện luôn');
    expect(frames.waiting).toBe(false);
  });
});
