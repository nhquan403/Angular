import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme-service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('mặc định theo hệ thống: không ép class sáng/tối', () => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(theme.mode()).toBe('system');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
  });

  it('chọn chế độ thì gắn class lên <html> và nhớ lại lần sau', () => {
    TestBed.inject(ThemeService).setMode('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(localStorage.getItem('todo-web.theme')).toBe('dark');

    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('giá trị lạ trong localStorage bị bỏ qua', () => {
    localStorage.setItem('todo-web.theme', 'neon');
    expect(TestBed.inject(ThemeService).mode()).toBe('system');
  });
});
