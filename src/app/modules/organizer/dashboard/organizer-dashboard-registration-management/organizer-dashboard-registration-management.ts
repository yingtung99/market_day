import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AlertService } from '../../../../core/services/alert.service';
import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { formatDisplayDateRange } from '../../../../core/utils/date-display.util';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { OrganizerApplicationSummary } from '../../../../models/interface/organizer/OrganizerApplicationSearch';
import {
  OrganizerRegistrationAction,
  OrganizerRegistrationRow,
} from '../../../../models/interface/organizer/OrganizerRegistrationRow';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import {
  DashboardDataTable,
  DashboardTableAction,
  DashboardTableColumn,
} from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';

@Component({
  selector: 'app-organizer-dashboard-registration-management',
  imports: [FormsModule, DashboardDataTable, DashboardPagination, Dropdown, DateRangeSelector],
  templateUrl: './organizer-dashboard-registration-management.html',
  styleUrl: './organizer-dashboard-registration-management.scss',
})
/** 報名管理列表，負責查詢、狀態篩選、分頁及導向報名處理頁。 */
export class OrganizerDashboardRegistrationManagement implements OnInit {
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;

  currentPage = 1;
  readonly pageSize = 6;
  totalItems = 0;
  selectedStatus = ApplicationStatus.all;
  searchActivityKeyword = '';
  searchBrandKeyword = '';
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  displayRows: OrganizerRegistrationRow[] = [];
  readonly statusOptions = ApplicationStatus.filterList;

  readonly columns: DashboardTableColumn[] = [
    { key: 'activity', label: '活動名稱', type: 'imageText', width: '17%', truncate: true },
    { key: 'activityTime', label: '活動日期', width: '18%', nowrap: true },
    { key: 'status', label: '報名狀態', type: 'status', align: 'center', width: '9%', nowrap: true },
    { key: 'brandName', label: '品牌名稱', width: '12%', nowrap: true },
    { key: 'brandType', label: '品牌類型', width: '8%', nowrap: true },
    { key: 'vendorName', label: '攤主姓名', width: '8%', nowrap: true },
    { key: 'registeredAt', label: '報名時間', width: '13%', nowrap: true },
    { key: 'action', label: '', type: 'action', align: 'end', width: '15%' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
    private readonly alert: AlertService,
  ) {}

  /** 從網址還原篩選條件與頁碼，接著向後端載入報名列表。 */
  ngOnInit(): void {
    const pageFromUrl = Number(this.route.snapshot.queryParamMap.get('page'));
    const statusFromUrl = this.route.snapshot.queryParamMap.get('status') ?? '';
    this.searchActivityKeyword = this.route.snapshot.queryParamMap.get('activity') ?? '';
    this.searchBrandKeyword = this.route.snapshot.queryParamMap.get('brand') ?? '';
    this.filterStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.filterEndDate = this.route.snapshot.queryParamMap.get('endDate');

    if (Number.isInteger(pageFromUrl) && pageFromUrl > 0) this.currentPage = pageFromUrl;
    if (this.statusOptions.includes(statusFromUrl)) this.selectedStatus = statusFromUrl;
    this.loadApplications();
  }

  onPageChange(page: number): void {
    if (page === this.currentPage) return;
    this.currentPage = page;
    this.syncListQueryParams();
    this.loadApplications();
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.syncListQueryParams();
    this.loadApplications();
  }

  searchRegistrations(): void {
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
    this.loadApplications();
  }

  onTableRowClick(row: Record<string, unknown>): void {
    this.openRegistration(row as unknown as OrganizerRegistrationRow, 'view');
  }

  onTableAction(action: DashboardTableAction): void {
    const registration = action.row as unknown as OrganizerRegistrationRow;
    if (action.key === 'refund-confirm' || action.key === 'refund-info' || action.key === 'deposit-info') {
      this.router.navigate(['/organizer/dash-board/collection/detail', registration.id], {
        queryParams: { returnPage: this.currentPage, returnStatus: this.appliedStatus },
      });
      return;
    }
    this.openRegistration(registration, action.key ?? 'view');
  }

  private get appliedStatus(): string | null {
    return this.selectedStatus === ApplicationStatus.all ? null : this.selectedStatus;
  }

  /** 依目前搜尋條件查詢報名資料，並同步待辦統計與分頁資訊。 */
  private loadApplications(): void {
    this.organizerApi.searchOrganizerApplications({
      eventTitle: this.searchActivityKeyword.trim() || undefined,
      status: this.appliedStatus ?? undefined,
      brandName: this.searchBrandKeyword.trim() || undefined,
      registrationStartAt: this.filterStartDate,
      registrationEndAt: this.filterEndDate,
      page: this.currentPage,
      pageSize: this.pageSize,
    }).subscribe({
      next: (response) => {
        if (!isApiSuccessStatus(response.statusCode) || !response.data?.applications) {
          this.displayRows = [];
          this.totalItems = 0;
          void this.alert.error('報名列表載入失敗', response.message || '請稍後再試。');
          return;
        }
        const page = response.data.applications;
        this.currentPage = page.page;
        this.totalItems = page.totalItems;
        this.displayRows = page.items.map((item) => this.toRegistrationRow(item));
      },
      error: () => {
        this.displayRows = [];
        this.totalItems = 0;
        void this.alert.error('報名列表載入失敗', '目前無法取得報名資料，請稍後再試。');
      },
    });
  }

  /** 將 API 報名摘要轉成共用表格需要的顯示模型。 */
  private toRegistrationRow(item: OrganizerApplicationSummary): OrganizerRegistrationRow {
    const row: OrganizerRegistrationRow = {
      id: item.applicationId,
      activity: item.eventTitle || '-',
      activityImage: item.eventCoverImageUrl || 'assets/images/shared/no-image-placeholder.svg',
      activityTime: formatDisplayDateRange(item.eventTime),
      brandName: item.vendorName || '-',
      vendorName: item.vendorOwnerName || '-',
      brandType: item.category?.name || '-',
      registeredAt: item.appliedAt || '-',
      status: item.applicationStatus || '-',
    };
    return { ...row, actions: this.getRowActions(row) };
  }

  /** 依報名狀態決定列表可執行的操作，避免前端顯示不適用的按鈕。 */
  private getRowActions(row: OrganizerRegistrationRow): OrganizerRegistrationAction[] {
    switch (row.status) {
      case ApplicationStatus.pendingReview:
        return [
          { key: 'review', label: '審核', variant: 'primary' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ApplicationStatus.completed:
        return [
          { key: 'deposit-return', label: '退還保證金', variant: 'muted', disabled: true, hint: '請至報名詳情確認退還條件' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ApplicationStatus.depositReturned:
        return [
          { key: 'deposit-info', label: '保證金資訊', variant: 'outline' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ApplicationStatus.refundPending:
        return [
          { key: 'refund-confirm', label: '退款確認', variant: 'primary' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ApplicationStatus.refunding:
      case ApplicationStatus.refunded:
      case ApplicationStatus.cancelled:
        return [
          { key: 'refund-info', label: '退款資訊', variant: 'outline' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      default:
        return [{ key: 'view', label: '查看', variant: 'outline' }];
    }
  }

  private openRegistration(registration: OrganizerRegistrationRow, action: string): void {
    this.router.navigate(['/organizer/dash-board/register/detail', registration.id], {
      queryParams: {
        returnPage: this.currentPage,
        returnStatus: this.appliedStatus,
        action,
      },
    });
  }

  private syncListQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage,
        status: this.appliedStatus,
        activity: this.searchActivityKeyword.trim() || null,
        brand: this.searchBrandKeyword.trim() || null,
        startDate: this.filterStartDate || null,
        endDate: this.filterEndDate || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
