import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { safeStorage } from '../safe-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'todo-web.theme';
const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Chế độ sáng / tối. "system" đi theo cài đặt hệ điều hành.
 * Chỉ cần gắn class lên <html>: theme Material sinh màu bằng light-dark() nên tự đổi theo `color-scheme`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  readonly mode = signal<ThemeMode>(loadMode());
  readonly icon = computed(() => THEME_ICON[this.mode()]);

  constructor() {
    effect(() => {
      const mode = this.mode();
      this.root.classList.toggle('theme-light', mode === 'light');
      this.root.classList.toggle('theme-dark', mode === 'dark');
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    safeStorage.set(THEME_KEY, mode);
  }
}

export const THEME_ICON: Readonly<Record<ThemeMode, string>> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

export const THEME_LABEL: Readonly<Record<ThemeMode, string>> = {
  system: 'Theo hệ thống',
  light: 'Sáng',
  dark: 'Tối',
};

function loadMode(): ThemeMode {
  const stored = safeStorage.get(THEME_KEY);
  return MODES.find((mode) => mode === stored) ?? 'system';
}
