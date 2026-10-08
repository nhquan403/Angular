import { FormControl, FormGroup, Validators } from '@angular/forms';
import { applyServerErrors } from './form-errors';

describe('applyServerErrors', () => {
  const build = () =>
    new FormGroup({
      title: new FormControl('abc', { nonNullable: true, validators: [Validators.maxLength(100)] }),
      description: new FormControl('', { nonNullable: true }),
    });

  it('gắn lỗi của BE vào đúng ô dưới khóa "server" và đánh dấu đã chạm', () => {
    const form = build();
    expect(applyServerErrors(form, { title: 'title must not be blank' })).toBe(true);
    expect(form.controls.title.getError('server')).toBe('title must not be blank');
    expect(form.controls.title.touched).toBe(true);
    expect(form.invalid).toBe(true);
  });

  it('bỏ qua trường form không có và trả false nếu không gắn được gì', () => {
    const form = build();
    expect(applyServerErrors(form, { unknown: 'x' })).toBe(false);
    expect(applyServerErrors(form, {})).toBe(false);
    expect(form.valid).toBe(true);
  });

  it('lỗi tự mất khi người dùng sửa ô (validator chạy lại)', () => {
    const form = build();
    applyServerErrors(form, { title: 'bad' });
    form.controls.title.setValue('khác');
    expect(form.controls.title.hasError('server')).toBe(false);
  });
});
