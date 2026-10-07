import { Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    // mat-icon dùng bộ Material Symbols (nạp ở index.html) thay cho Material Icons cũ.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    // Tạo sớm để áp chế độ sáng/tối đã lưu ngay khi mở app.
    inject(ThemeService);
  }
}
