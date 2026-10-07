/**
 * Cấu hình bản production (`ng build`). Bản dev dùng `environment.development.ts`
 * (angular.json thay file này khi build/serve cấu hình development).
 */
export const environment = {
  production: true,
  /** Địa chỉ gốc của todo-api. WebSocket tự suy ra (http -> ws, https -> wss). */
  apiBaseUrl: 'http://localhost:8080',
  /** Hiện nút trợ lý AI. BE phải có POST /api/assistant/chat (xem docs/assistant-backend.md). */
  assistantEnabled: true,
};
