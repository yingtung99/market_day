import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerPaymentSummary } from '../../../../models/interface/organizer/OrganizerPayment';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { PaymentStatus } from '../../../../models/status/PaymentStatus';
import {
  DashboardDataTable,
  DashboardTableAction,
  DashboardTableColumn,
} from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';

interface CollectionRow {
  id: number;
  activity: string;
  activityImage: string;
  brandName: string;
  vendorName: string;
  paymentAmount: string;
  deposit: string;
  paidAt: string;
  registrationStatus: string;
  registrationStatusClass?: string;
  paymentStatus: string;
  paymentStatusClass?: string;
  actions?: {
    key: string;
    label: string;
    variant?: 'primary' | 'outline' | 'danger' | 'success' | 'muted';
  }[];
}

@Component({
  selector: 'app-organizer-dashboard-collection-management',
  imports: [FormsModule, DashboardDataTable, DashboardPagination, Dropdown, DateRangeSelector],
  templateUrl: './organizer-dashboard-collection-management.html',
  styleUrl: './organizer-dashboard-collection-management.scss',
})
/** 收款管理列表，查詢各報名付款與退款狀態並導向收款詳情。 */
export class OrganizerDashboardCollectionManagement implements OnInit {
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;

  currentPage = 1;
  pageSize = 6;
  totalItems = 0;
  keyword = '';
  selectedStatus = '全部狀態';
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  displayRows: CollectionRow[] = [];

  readonly statusOptions = [
    '全部狀態',
    PaymentStatus.pending,
    PaymentStatus.paid,
    PaymentStatus.failed,
    PaymentStatus.expired,
    PaymentStatus.refundRequested,
    PaymentStatus.refunding,
    PaymentStatus.refundFailed,
    PaymentStatus.refunded,
  ];

  readonly columns: DashboardTableColumn[] = [
    { key: 'activity', label: '活動名稱', type: 'imageText', width: '15%', truncate: true },
    { key: 'registrationStatus', label: '報名狀態', type: 'status', align: 'center', width: '10%' },
    { key: 'brandName', label: '品牌名稱', width: '13%', nowrap: true },
    { key: 'vendorName', label: '攤主姓名', width: '8%', nowrap: true },
    { key: 'paymentStatus', label: '付款狀態', type: 'status', align: 'center', width: '10%' },
    { key: 'paymentAmount', label: '付款金額', align: 'end', nowrap: true, width: '8%' },
    { key: 'deposit', label: '保證金', align: 'end', nowrap: true, width: '7%' },
    { key: 'paidAt', label: '付款時間', nowrap: true, width: '13%' },
    { key: 'action', label: '', type: 'action', align: 'end', width: '16%' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 從網址還原查詢狀態，並載入目前分頁的收款資料。 */
  ngOnInit(): void {
    const pageFromUrl = Number(this.route.snapshot.queryParamMap.get('page'));
    const statusFromUrl = this.route.snapshot.queryParamMap.get('status') ?? '';
    this.keyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
    this.filterStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.filterEndDate = this.route.snapshot.queryParamMap.get('endDate');
    if (Number.isInteger(pageFromUrl) && pageFromUrl > 0) this.currentPage = pageFromUrl;
    if (this.statusOptions.includes(statusFromUrl)) this.selectedStatus = statusFromUrl;
    this.loadPayments();
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.syncListQueryParams();
    this.loadPayments();
  }

  searchCollections(): void {
    const range = this.dateRangeSelector?.getTimeRange() ?? {
      startDate: this.filterStartDate,
      endDate: this.filterEndDate,
    };
    let startDate = range.startDate;
    let endDate = range.endDate;
    if (startDate && endDate && startDate > endDate) [startDate, endDate] = [endDate, startDate];
    this.filterStartDate = startDate;
    this.filterEndDate = endDate;
    this.currentPage = 1;
    this.syncListQueryParams();
    this.loadPayments();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncListQueryParams();
    this.loadPayments();
  }

  onTableRowClick(row: Record<string, unknown>): void {
    this.onTableAction({ key: 'view', label: '查看', variant: 'outline', row });
  }

  onTableAction(action: DashboardTableAction): void {
    const row = action.row as unknown as CollectionRow;
    this.router.navigate(['/organizer/dash-board/collection/detail', row.id], {
      queryParams: {
        returnPage: this.currentPage,
        returnStatus: this.selectedStatus === '全部狀態' ? null : this.selectedStatus,
        action: action.key === 'view' ? null : action.key,
      },
    });
  }

  /** 呼叫收款搜尋 API，失敗時清空舊資料以避免顯示過期內容。 */
  private loadPayments(): void {
    this.organizerApi.searchOrganizerPayments({
      keyword: this.keyword,
      paymentStatus: this.selectedStatus === '全部狀態' ? undefined : this.selectedStatus,
      startDate: this.filterStartDate,
      endDate: this.filterEndDate,
      page: this.currentPage,
      pageSize: this.pageSize,
    }).subscribe({
      next: (response) => {
        if (!isApiSuccessStatus(response.statusCode) || !response.data?.payments) {
          this.displayRows = [];
          this.totalItems = 0;
          return;
        }
        const page = response.data.payments;
        this.currentPage = page.page;
        this.totalItems = page.totalItems;
        this.displayRows = page.items.map((item) => this.toCollectionRow(item));
      },
      error: () => {
        this.displayRows = [];
        this.totalItems = 0;
      },
    });
  }

  /** 將付款摘要整理成列表欄位與前端狀態文字。 */
  private toCollectionRow(item: OrganizerPaymentSummary): CollectionRow {
    const row: CollectionRow = {
      id: item.applicationId,
      activity: item.eventTitle || '-',
      activityImage: item.eventCoverImageUrl || 'assets/images/market/cards/market-card-01.png',
      brandName: item.brandName || '-',
      vendorName: item.vendorName || '-',
      paymentAmount: this.formatMoney(item.paymentAmount),
      deposit: this.formatMoney(item.depositAmount),
      paidAt: this.formatDateTime(item.paymentTime),
      registrationStatus: item.applicationStatus || '-',
      registrationStatusClass: ApplicationStatus.getClass(item.applicationStatus || ''),
      paymentStatus: item.paymentStatus || '-',
      paymentStatusClass: PaymentStatus.getClass(item.paymentStatus || ''),
    };
    row.actions = this.getRowActions(row);
    return row;
  }

  /** 依付款或退款狀態提供查看、確認退款等操作。 */
  private getRowActions(row: CollectionRow): CollectionRow['actions'] {
    if (row.paymentStatus === PaymentStatus.refundRequested) {
      return [
        { key: 'refund-confirm', label: '退款確認', variant: 'primary' },
        { key: 'view', label: '查看', variant: 'outline' },
      ];
    }
    if (row.paymentStatus === PaymentStatus.refundFailed) {
      return [
        { key: 'retry-refund', label: '重試退款', variant: 'primary' },
        { key: 'view', label: '查看', variant: 'outline' },
      ];
    }
    return [{ key: 'view', label: '查看', variant: 'outline' }];
  }

  private formatMoney(value: number | string | null): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? `$${amount.toLocaleString('zh-TW')}` : '-';
  }

  private formatDateTime(value: string | null): string {
    return value ? value.replaceAll('-', '/').slice(0, 16) : '-';
  }

  private syncListQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage,
        status: this.selectedStatus === '全部狀態' ? null : this.selectedStatus,
        keyword: this.keyword.trim() || null,
        startDate: this.filterStartDate || null,
        endDate: this.filterEndDate || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
