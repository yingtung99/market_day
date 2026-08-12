import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../../../core/services/alert.service';
import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import type {
  ApplicationRecord,
  ApplicationRecordStatus,
  RecordAction,
  RecordTab,
} from '../../../../models/interface/vendor/VendorApplicationDetail';
import type { VendorApplicationSummary } from '../../../../models/interface/vendor/VendorApplicationSearch';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { ClickableTableRowDirective } from '../../../shared/dashboard/clickable-table-row/clickable-table-row.directive';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { formatDisplayDateText } from '../../../../core/utils/date-display.util';

const DETAIL_LINK = '/vendor/dash-board/application-record/detail';

type RecordActionType = 'view' | 'payment' | 'booth' | 'refund' | 'cancel';

const RECORD_ACTION_MAP: Record<RecordActionType, RecordAction> = {
  view: { label: '查看', style: 'outline', link: DETAIL_LINK },
  payment: { label: '前往付款', style: 'primary', link: DETAIL_LINK },
  booth: { label: '選擇攤位', style: 'primary', link: DETAIL_LINK },
  refund: { label: '退款申請', style: 'outline', link: DETAIL_LINK },
  cancel: { label: '取消報名', style: 'outline', link: DETAIL_LINK },
};

interface ApiStatusConfig {
  status: ApplicationRecordStatus;
  statusClass: string;
  actionTypes: RecordActionType[];
}

const API_STATUS_CONFIG: Record<string, ApiStatusConfig> = {
  待審核: {
    status: 'reviewing',
    statusClass: 'reviewing',
    actionTypes: ['cancel', 'view'],
  },
  待付款: {
    status: 'payment',
    statusClass: 'payment',
    actionTypes: ['payment', 'cancel', 'view'],
  },
  待選位: {
    status: 'booth',
    statusClass: 'booth',
    actionTypes: ['booth', 'refund', 'view'],
  },
  報名完成: {
    status: 'completed',
    statusClass: 'completed',
    actionTypes: ['view'],
  },
  保證金已退還: {
    status: 'depositRefunded',
    statusClass: 'deposit-refunded',
    actionTypes: ['view'],
  },
  退款申請中: {
    status: 'refundApplying',
    statusClass: 'refund-applying',
    actionTypes: ['view'],
  },
  退款處理中: {
    status: 'refundProcessing',
    statusClass: 'refund-processing',
    actionTypes: ['view'],
  },
  已退款: {
    status: 'refunded',
    statusClass: 'refunded',
    actionTypes: ['view'],
  },
  已取消: {
    status: 'history',
    statusClass: 'history',
    actionTypes: ['view'],
  },
  審核未通過: {
    status: 'history',
    statusClass: 'history',
    actionTypes: ['view'],
  },
};

@Component({
  selector: 'app-vendor-application-record',
  imports: [
    CommonModule,
    RouterLink,
    DashboardPagination,
    Dropdown,
    DateRangeSelector,
    ClickableTableRowDirective,
  ],
  templateUrl: './vendor-application-record.html',
  styleUrl: './vendor-application-record.scss',
})
export class VendorApplicationRecord implements OnInit {
  activeTab: RecordTab['value'] = 'all';
  currentPage = 1;
  readonly pageSize = 6;

  readonly statusOptions = [
    '全部狀態',
    '待審核',
    '待付款',
    '待選位',
    '報名完成',
    '保證金已退還',
    '退款申請中',
    '退款處理中',
    '已退款',
    '歷史紀錄',
  ];

  private readonly statusValueMap: Record<string, RecordTab['value']> = {
    全部狀態: 'all',
    待審核: 'reviewing',
    待付款: 'payment',
    待選位: 'booth',
    報名完成: 'completed',
    保證金已退還: 'depositRefunded',
    退款申請中: 'refundApplying',
    退款處理中: 'refundProcessing',
    已退款: 'refunded',
    歷史紀錄: 'history',
  };

  tabs: RecordTab[] = [
    { label: '全部', value: 'all' },
    { label: '待審核', value: 'reviewing' },
    { label: '待付款', value: 'payment' },
    { label: '待選位', value: 'booth' },
    { label: '報名完成', value: 'completed' },
    { label: '保證金已退還', value: 'depositRefunded' },
    { label: '退款申請中', value: 'refundApplying' },
    { label: '退款處理中', value: 'refundProcessing' },
    { label: '已退款', value: 'refunded' },
    { label: '歷史紀錄', value: 'history' },
  ];

  records: ApplicationRecord[] = [];
  totalItems = 0;
  eventTitle = '';
  eventStartAt: string | null = null;
  eventEndAt: string | null = null;
  isLoading = false;

  constructor(
    private readonly alert: AlertService,
    private readonly vendorDashboardService: VendorDashboardService,
  ) {}

  ngOnInit(): void {
    this.loadApplications();
  }

  get selectedStatusLabel(): string {
    return this.statusOptions.find((option) => this.statusValueMap[option] === this.activeTab) ?? '';
  }

  get filteredRecords(): ApplicationRecord[] {
    return this.records;
  }

  get pagedRecords(): ApplicationRecord[] {
    return this.records;
  }

  setActiveTab(tab: RecordTab['value']): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadApplications();
  }

  selectStatus(status: string): void {
    this.activeTab = this.statusValueMap[status] ?? 'all';
    this.currentPage = 1;
    this.loadApplications();
  }

  setPage(page: number): void {
    this.currentPage = page;
    this.loadApplications();
  }

  onEventTitleInput(event: Event): void {
    this.eventTitle = (event.target as HTMLInputElement).value;
  }

  onDateRangeChange(range: { startDate: string | null; endDate: string | null }): void {
    this.eventStartAt = range.startDate;
    this.eventEndAt = range.endDate;
  }

  search(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  getActionRoute(action: RecordAction, record: ApplicationRecord): Array<string | number> {
    if (action.label === '前往付款') {
      return [DETAIL_LINK, record.applicationNo, 'payment'];
    }
    if (action.label === '選擇攤位') {
      return [DETAIL_LINK, record.applicationNo, 'booth'];
    }
    return [DETAIL_LINK, record.id];
  }

  getActionQueryParams(action: RecordAction, record: ApplicationRecord): { applicationId: number } | null {
    return ['前往付款', '選擇攤位'].includes(action.label)
      ? { applicationId: record.id }
      : null;
  }

  private loadApplications(): void {
    this.isLoading = true;
    this.vendorDashboardService.searchVendorApplications({
      eventTitle: this.eventTitle,
      status: this.getApiStatus(),
      eventStartAt: this.eventStartAt ?? undefined,
      eventEndAt: this.eventEndAt ?? undefined,
      page: this.currentPage,
      pageSize: this.pageSize,
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!isApiSuccessStatus(response.statusCode)) {
          this.records = [];
          this.totalItems = 0;
          void this.alert.error('報名紀錄載入失敗', response.message);
          return;
        }

        const page = response.data.applications;
        this.currentPage = page.page;
        this.totalItems = page.totalItems;
        this.records = page.items.map(createApiRecord);
      },
      error: () => {
        this.isLoading = false;
        this.records = [];
        this.totalItems = 0;
        void this.alert.error('報名紀錄載入失敗', '無法連線至伺服器，請稍後再試。');
      },
    });
  }

  private getApiStatus(): string | undefined {
    if (this.activeTab === 'all') {
      return undefined;
    }
    if (this.activeTab === 'history') {
      return '已取消';
    }
    return this.selectedStatusLabel || undefined;
  }
}

/** 清單列完全由搜尋 API 摘要建立，不再附加本地詳情或市集假資料。 */
function createApiRecord(item: VendorApplicationSummary): ApplicationRecord {
  const config = API_STATUS_CONFIG[item.applicationStatus] ?? API_STATUS_CONFIG['待審核'];

  return {
    id: item.applicationId,
    image: item.eventImageUrl ?? '',
    marketName: item.eventTitle,
    eventDate: formatDisplayDateText(item.eventDate),
    location: item.location,
    applicationNo: item.applicationNo,
    status: config.status,
    statusText: item.applicationStatus,
    statusClass: config.statusClass,
    actions: config.actionTypes.map((type) => ({ ...RECORD_ACTION_MAP[type] })),
  };
}
