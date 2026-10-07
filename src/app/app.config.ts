import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor, errorInterceptor } from './core/http/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: tham số trên URL (/todos/:id) tự chui vào input() của component.
    provideRouter(routes, withComponentInputBinding()),
    // Thứ tự quan trọng: errorInterceptor bọc ngoài, authInterceptor ở trong (xem interceptors.ts).
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Đổi địa chỉ BE tại đây nếu cần, ví dụ:
    // { provide: API_BASE_URL, useValue: 'https://api.example.com' },
  ],
};
