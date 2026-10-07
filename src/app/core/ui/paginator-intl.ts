import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Chữ tiếng Việt cho mat-paginator. */
@Injectable()
export class VietnamesePaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Mỗi trang';
  override nextPageLabel = 'Trang sau';
  override previousPageLabel = 'Trang trước';
  override firstPageLabel = 'Trang đầu';
  override lastPageLabel = 'Trang cuối';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return '0 / 0';
    }
    const start = page * pageSize;
    const end = Math.min(start + pageSize, length);
    return `${start + 1}–${end} / ${length}`;
  };
}
