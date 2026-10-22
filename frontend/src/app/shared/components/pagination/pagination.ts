
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  @Input() currentPage = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;
  @Input() pageSizeOptions: number[] = [10, 20, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItem(): number {
    return this.totalItems === 0
      ? 0
      : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  get visiblePages(): (number | string)[] {
    const total = this.totalPages;
    const current = Math.max(1, Math.min(this.currentPage, total));

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set<number>([
      1,
      total,
      current - 1,
      current,
      current + 1,
    ]);

    if (current <= 3) {
      [2, 3, 4].forEach(page => pages.add(page));
    }

    if (current >= total - 2) {
      [total - 3, total - 2, total - 1].forEach(page => pages.add(page));
    }

    const sorted = [...pages]
      .filter(page => page >= 1 && page <= total)
      .sort((a, b) => a - b);

    const result: (number | string)[] = [];

    sorted.forEach((page, index) => {
      if (index > 0) {
        const previous = sorted[index - 1];

        if (page - previous === 2) {
          result.push(previous + 1);
        } else if (page - previous > 2) {
          result.push('...');
        }
      }

      result.push(page);
    });

    return result;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.pageChange.emit(page);
  }

  changePageSize(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);

    if (this.pageSizeOptions.includes(value) && value !== this.pageSize) {
      this.pageSizeChange.emit(value);
    }
  }

  isNumber(value: number | string): value is number {
    return typeof value === 'number';
  }
}
