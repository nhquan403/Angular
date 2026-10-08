import { FormControl, FormGroup, FormGroupDirective } from '@angular/forms';
import { confirmPasswordMatcher, passwordsMatch, safeReturnUrl } from './auth-form';

describe('auth-form', () => {
  const form = (password: string, confirm: string) =>
    new FormGroup(
      { password: new FormControl(password), confirm: new FormControl(confirm) },
      { validators: passwordsMatch },
    );

  it('passwordsMatch báo mismatch khi hai mật khẩu khác nhau', () => {
    expect(form('Abc#12345', 'Abc#12345').hasError('mismatch')).toBe(false);
    expect(form('Abc#12345', 'Abc#1234').hasError('mismatch')).toBe(true);
  });

  it('ô nhập lại chỉ tô đỏ khi đã chạm vào và form đang mismatch', () => {
    const group = form('a', 'b');
    const directive = { submitted: false, hasError: (code: string) => group.hasError(code) } as FormGroupDirective;
    const confirm = group.controls.confirm;
    expect(confirmPasswordMatcher.isErrorState(confirm, directive)).toBe(false);
    confirm.markAsTouched();
    expect(confirmPasswordMatcher.isErrorState(confirm, directive)).toBe(true);
    confirm.setValue('a');
    expect(confirmPasswordMatcher.isErrorState(confirm, directive)).toBe(false);
  });

  it.each([
    ['/todos?page=2', '/todos?page=2'],
    ['/admin/users', '/admin/users'],
    [null, '/todos'],
    ['https://evil.example', '/todos'],
    ['//evil.example', '/todos'],
    ['todos', '/todos'],
  ])('safeReturnUrl(%s) = %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
