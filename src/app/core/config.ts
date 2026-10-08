import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Địa chỉ gốc của Todo API (Spring Boot). Giá trị lấy từ `src/environments/environment*.ts`
 * (bản dev và bản production tách riêng). Muốn ghi đè lúc chạy thì cung cấp trong app.config.ts:
 *   { provide: API_BASE_URL, useValue: 'https://api.example.com' }
 *
 * Địa chỉ WebSocket được suy ra từ đây (http -> ws, https -> wss).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});
