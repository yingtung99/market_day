import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-dashboard-pagination',
  imports: [],
  templateUrl: './dashboard-pagination.html',
  styleUrl: './dashboard-pagination.scss',
})
export class DashboardPagination {
  /** 目前頁碼 */
  @Input() currentPage = 1;

  /** 每頁筆數 */
  @Input() pageSize = 8;

  /** 總筆數 */
  @Input() totalItems = 0;

  /** 切換頁碼事件 */
  @Output() pageChange = new EventEmitter<number>();

  /** 總頁數 */
  totalPages(): number {
    return Math.max(Math.ceil(this.totalItems / this.pageSize), 1);
  }

  /** 頁碼列表 */
  pages(): number[] {
    const totalPages = this.totalPages();
    const visiblePageCount = 5;

    if (totalPages <= visiblePageCount) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const currentPage = Math.min(Math.max(this.currentPage, 1), totalPages);
    const halfWindow = Math.floor(visiblePageCount / 2);
    let startPage = currentPage - halfWindow;
    let endPage = startPage + visiblePageCount - 1;

    if (startPage < 1) {
      startPage = 1;
      endPage = visiblePageCount;
    } else if (endPage > totalPages) {
      endPage = totalPages;
      startPage = totalPages - visiblePageCount + 1;
    }

    return Array.from({ length: visiblePageCount }, (_, i) => startPage + i);
  }

  /** 目前頁第一筆序號 */
  startItemNumber(): number {
    if (this.totalItems === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  /** 目前頁最後一筆序號 */
  endItemNumber(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  /** 切換頁碼 */
  setPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.pageChange.emit(page);
  }
}
