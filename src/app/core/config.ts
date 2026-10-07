import { InjectionToken } from '@angular/core';

/**
 * Địa chỉ gốc của Todo API (Spring Boot). Mặc định là BE chạy local ở cổng 8080.
 * Muốn đổi (staging, production) thì cung cấp giá trị khác trong app.config.ts:
 *   { provide: API_BASE_URL, useValue: 'https://api.example.com' }
 *
 * Địa chỉ WebSocket được suy ra từ đây (http -> ws, https -> wss).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8080',
});
