/**
 * localStorage có thể ném lỗi (chế độ ẩn danh, bị chặn, hết dung lượng).
 * Mọi chỗ dùng đều phải chạy được khi không lưu được, nên bọc try/catch ở một nơi duy nhất.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* không lưu được thì thôi */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* bỏ qua */
    }
  },
};
