import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeVi from '@angular/common/locales/vi';
import { ApplicationConfig, ErrorHandler, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/error-handler';
import { authInterceptor, errorInterceptor } from './core/http/interceptors';
import { AppTitleStrategy } from './core/ui/app-title-strategy';
import { VietnamesePaginatorIntl } from './core/ui/paginator-intl';

registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: LOCALE_ID, useValue: 'vi' },
    // withComponentInputBinding: tham số trên URL (/todos/:id) tự chui vào input() của component.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withViewTransitions(),
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    // Thứ tự quan trọng: errorInterceptor bọc ngoài, authInterceptor ở trong (xem interceptors.ts).
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    { provide: MatPaginatorIntl, useClass: VietnamesePaginatorIntl },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: { showDelay: 400, hideDelay: 0, touchendHideDelay: 0 } },
    // Địa chỉ BE lấy từ src/environments; muốn ghi đè thì:
    // { provide: API_BASE_URL, useValue: 'https://api.example.com' },
  ],
};
