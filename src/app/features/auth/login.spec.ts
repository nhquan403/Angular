import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient()],
    });
  });

  it('bấm Đăng nhập khi để trống thì hiện lỗi từng ô, không gửi gì', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    const errors = [...element.querySelectorAll('mat-error')].map((e) => e.textContent?.trim());
    expect(errors).toEqual(['Nhập email', 'Nhập mật khẩu']);
  });

  it('nút điền sẵn tài khoản ADMIN của profile dev', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const fill = [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Điền sẵn'));
    fill!.click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('admin@example.com');
  });
});
