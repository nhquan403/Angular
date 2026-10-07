import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { THEME_ICON, THEME_LABEL, ThemeMode, ThemeService } from '../core/theme/theme-service';

/** Nút chọn giao diện sáng / tối / theo hệ thống. */
@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button matIconButton type="button" [matMenuTriggerFor]="menu" matTooltip="Giao diện" aria-label="Chọn giao diện">
      <mat-icon>{{ theme.icon() }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (mode of modes; track mode) {
        <button
          mat-menu-item
          type="button"
          (click)="theme.setMode(mode)"
          [attr.aria-checked]="theme.mode() === mode"
          role="menuitemradio"
        >
          <mat-icon>{{ icons[mode] }}</mat-icon>
          <span>{{ labels[mode] }}</span>
          @if (theme.mode() === mode) {
            <mat-icon class="check" aria-hidden="true">check</mat-icon>
          }
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .check {
      margin: 0 0 0 1rem !important;
      color: var(--mat-sys-primary);
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly modes: readonly ThemeMode[] = ['system', 'light', 'dark'];
  protected readonly icons = THEME_ICON;
  protected readonly labels = THEME_LABEL;
}
