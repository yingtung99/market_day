import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerAccountingSummary } from '../../../../models/interface/organizer/OrganizerOperations';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { DashboardDataTable, DashboardTableAction, DashboardTableColumn } from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';

interface AccountRow {
  id: number;
  activity: string;
  activityImage: string;
  activityStatus: string;
  activityDate: string;
  paidBooths: string;
  grossAmount: string;
  refundAmount: string;
  returnedDeposit: string;
  forfeitedDeposit: string;
  netAmount: string;
  activityStatusClass?: string;
  actions?: { key: string; label: string; variant?: 'primary' | 'outline' | 'danger' | 'success' | 'muted' }[];
}

@Component({
  selector: 'app-organizer-dashboard-account-management',
  imports: [FormsModule, DashboardDataTable, DashboardPagination, Dropdown, DateRangeSelector],
  templateUrl: './organizer-dashboard-account-management.html',
  styleUrl: './organizer-dashboard-account-management.scss',
})
/** 帳務管理列表，彙整各活動收款、退款與保證金統計。 */
export class OrganizerDashboardAccountManagement implements OnInit {
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;
  currentPage = 1;
  readonly pageSize = 6;
  totalItems = 0;
  keyword = '';
  selectedStatus = ActivityStatus.all;
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  displayRows: AccountRow[] = [];
  readonly statusOptions = ActivityStatus.filterList;

  readonly columns: DashboardTableColumn[] = [
    { key: 'activity', label: '活動名稱', type: 'imageText', nowrap: true, minWidth: '178px', truncate: true },
    { key: 'activityDate', label: '活動日期', nowrap: true, minWidth: '134px' },
    { key: 'activityStatus', label: '活動狀態', type: 'status', align: 'center', minWidth: '78px' },
    { key: 'paidBooths', label: '已付款攤位數', align: 'center', nowrap: true, minWidth: '96px' },
    { key: 'grossAmount', label: '收款總額', align: 'end', nowrap: true, minWidth: '78px' },
    { key: 'refundAmount', label: '退款總額', align: 'end', nowrap: true, minWidth: '72px' },
    { key: 'returnedDeposit', label: '已退保證金', align: 'end', nowrap: true, minWidth: '82px' },
    { key: 'forfeitedDeposit', label: '未退保證金', align: 'end', nowrap: true, minWidth: '82px' },
    { key: 'netAmount', label: '實收金額', align: 'end', nowrap: true, minWidth: '78px' },
    { key: 'action', label: '', type: 'action', align: 'end', minWidth: '72px' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 還原網址查詢條件並載入活動帳務列表。 */
  ngOnInit(): void {
    this.currentPage = Math.max(1, Number(this.route.snapshot.queryParamMap.get('page')) || 1);
    this.keyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
    this.selectedStatus = this.route.snapshot.queryParamMap.get('status') ?? ActivityStatus.all;
    this.filterStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.filterEndDate = this.route.snapshot.queryParamMap.get('endDate');
    void this.loadRows();
  }

  selectStatus(status: string): void {
    this.selectedStatus = status || ActivityStatus.all;
    this.currentPage = 1;
    this.syncListQueryParams();
    void this.loadRows();
  }

  searchAccounts(): void {
    const range = this.dateRangeSelector?.getTimeRange();
    this.filterStartDate = range?.startDate ?? this.filterStartDate;
    this.filterEndDate = range?.endDate ?? this.filterEndDate;
    this.currentPage = 1;
    this.syncListQueryParams();
    void this.loadRows();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncListQueryParams();
    void this.loadRows();
  }

  onTableRowClick(row: Record<string, unknown>): void {
    this.onTableAction({ key: 'view', label: '查看', variant: 'outline', row });
  }

  onTableAction(action: DashboardTableAction): void {
    const row = action.row as unknown as AccountRow;
    this.router.navigate(['/organizer/dash-board/account/detail', row.id], {
      queryParams: { returnPage: this.currentPage, returnStatus: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus },
    });
  }

  /** 查詢各活動的收款、退款與保證金彙總資料。 */
  private async loadRows(): Promise<void> {
    try {
      const response = await firstValueFrom(this.organizerApi.searchOrganizerAccounts({
        eventTitle: this.keyword.trim() || undefined,
        status: this.selectedStatus === ActivityStatus.all ? undefined : ActivityStatus.toApiStatus(this.selectedStatus) ?? this.selectedStatus,
        eventStartAt: this.filterStartDate,
        eventEndAt: this.filterEndDate,
        page: this.currentPage,
        pageSize: this.pageSize,
      }));
      this.totalItems = response.data.accounts.totalItems ?? response.data.totalCount ?? 0;
      this.displayRows = (response.data.accounts.items ?? []).map((item) => this.mapRow(item));
    } catch {
      this.totalItems = 0;
      this.displayRows = [];
    }
  }

  /** 將後端帳務摘要轉成列表顯示欄位。 */
  private mapRow(item: OrganizerAccountingSummary): AccountRow {
    const status = ActivityStatus.fromApiStatus(item.publishStatusText || item.publishStatus || '');
    return {
      id: item.eventId,
      activity: item.eventTitle || '-',
      activityImage: item.coverImageUrl || 'assets/images/market/cards/market-card-01.png',
      activityStatus: status,
      activityStatusClass: ActivityStatus.getClass(status),
      activityDate: item.eventDate || '-',
      paidBooths: item.paidStallText || `${item.paidStallCount ?? 0} / ${item.totalStallCount ?? 0}`,
      grossAmount: this.money(item.grossRevenue),
      refundAmount: this.money(item.refundAmount),
      returnedDeposit: this.money(item.returnedDepositAmount),
      forfeitedDeposit: this.money(item.unreturnedDepositAmount),
      netAmount: this.money(item.netRevenue),
      actions: [{ key: 'view', label: '查看', variant: 'outline' }],
    };
  }

  private money(value: number | null | undefined): string {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private syncListQueryParams(): void {
    this.router.navigate([], { relativeTo: this.route, replaceUrl: true, queryParams: {
      page: this.currentPage,
      status: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus,
      keyword: this.keyword.trim() || null,
      startDate: this.filterStartDate || null,
      endDate: this.filterEndDate || null,
    }});
  }
}
