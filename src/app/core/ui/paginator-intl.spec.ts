import { VietnamesePaginatorIntl } from './paginator-intl';

describe('VietnamesePaginatorIntl', () => {
  const intl = new VietnamesePaginatorIntl();

  it('ghi khoảng đang xem dạng "đầu–cuối / tổng"', () => {
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 / 0');
    expect(intl.getRangeLabel(0, 10, 25)).toBe('1–10 / 25');
    expect(intl.getRangeLabel(2, 10, 25)).toBe('21–25 / 25');
  });
});
