import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { ActivityListItem } from '../../../../models/interface/admin/ActivityListItem';
import { AdminEventListDto, AdminEventSearchRequest } from '../../../../models/interface/admin/AdminEventSearch';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { ClickableTableRowDirective } from '../../../shared/dashboard/clickable-table-row/clickable-table-row.directive';

@Component({
  selector: 'app-admin-dashboard-market-management',
  imports: [
    Dropdown,
    DateRangeSelector,
    DashboardPagination,
    ClickableTableRowDirective,
  ],
  templateUrl: './admin-dashboard-market-management.html',
  styleUrl: './admin-dashboard-market-management.scss',
})
export class AdminDashboardMarketManagement implements OnInit, AfterViewInit {
  constructor(
    private router: Router,
    private readonly route: ActivatedRoute,
    private readonly adminApiService: AdminApiService,
    private readonly alert: AlertService,
  ) {}

  @ViewChild(DateRangeSelector) timeSelectorRef!: DateRangeSelector;
  @ViewChild('statusDropdown') statusDropdownRef!: Dropdown;
  @ViewChild('tableWrapper') tableWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('resultSection') resultSectionRef!: ElementRef<HTMLDivElement>;


  /** 每列高度，需與 SCSS `.activity-table tbody tr` 的高度一致 */
  private readonly rowHeight = 56;
  /** 表頭高度，需與 SCSS `.activity-table thead tr` 的高度一致 */
  private readonly headerHeight = 48;

  /** 主辦方下拉選單 */
  organizerOptions = ['全部', '森林生活市集', '日日好市', '春語市集', '歡樂市集團隊'];

  /** 狀態下拉選單（排除草稿，草稿由後端過濾不會出現在此頁） */
  statusOptions: string[] = [
    ActivityStatus.all,
    ActivityStatus.pendingReview,
    ActivityStatus.revisionRequired,
    ActivityStatus.mapBuilding,
    ActivityStatus.readyToPublish,
    ActivityStatus.registrationOpen,
    ActivityStatus.full,
    ActivityStatus.published,
    ActivityStatus.finalConfirmation,
    ActivityStatus.brandsPublished,
    ActivityStatus.active,
    ActivityStatus.ended,
    ActivityStatus.unpublishRequested,
    ActivityStatus.unpublished,
  ];

  /** 需要管理員處理（同時顯示「審核」與「查看」按鈕）的狀態。 */
  private readonly needsReviewStatuses: string[] = [
    ActivityStatus.pendingReview,
    ActivityStatus.mapBuilding,
    ActivityStatus.unpublishRequested,
  ];

  /** 目前篩選條件：狀態 */
  selectedStatus = '';
  /** 目前輸入的搜尋關鍵字 */
  searchKeyword = '';

  /** 目前頁面顯示的活動列表（已套用篩選＋分頁） */
  activities: ActivityListItem[] = [];

  /** 目前頁碼 */
  currentPage = 1;
  /** 每頁筆數，依畫面剩餘高度動態計算（見 Task 8），初始為合理預設值 */
  /** 管理頁統一每頁顯示 6 筆。 */
  pageSize = 6;
  /** 篩選後的總筆數 */
  totalItems = 0;

  /** 從網址 query params 還原預設篩選狀態（例如從首頁待辦卡片帶入的 status）。 */
  ngOnInit(): void {
    const statusFromUrl = this.route.snapshot.queryParamMap.get('status') ?? '';

    if (this.statusOptions.includes(statusFromUrl) && statusFromUrl !== ActivityStatus.all) {
      this.selectedStatus = statusFromUrl;
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.recalculatePageSize();
      this.fetchActivities();
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const previousPageSize = this.pageSize;
    this.recalculatePageSize();

    if (this.pageSize !== previousPageSize) {
      this.currentPage = 1;
      this.fetchActivities();
    }
  }

  onStatusSelected(value: string): void {
    this.selectedStatus = value === '全部' ? '' : value;
  }

  /** 更新搜尋關鍵字 */
  onSearchKeywordInput(event: Event): void {
    this.searchKeyword = (event.target as HTMLInputElement).value;
  }

  /** 搜尋按鈕：彙整篩選條件後重新查詢（回到第一頁） */
  onSearch(): void {
    this.currentPage = 1;
    this.fetchActivities();
  }

  /** 切換頁碼：每次切頁都重新呼叫一次「後端」 */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.fetchActivities();
  }

  /** 產生操作欄位按鈕的點擊處理函式，導向活動詳細頁 */
  getDetailHandler(activity: ActivityListItem): () => void {
    return () => this.goToDetail(activity);
  }

  private goToDetail(activity: ActivityListItem): void {
    this.router.navigate(['/admin/dash-board/activity/detail', activity.id], {
      state: { activity },
    });
  }

  /**
   * 串接 API："/api/admin/events/search"，依搜尋列篩選條件與目前頁碼查詢活動列表
   */
  private fetchActivities(): void {
    const keyword = this.searchKeyword.trim();
    const { startDate, endDate } = this.timeSelectorRef?.getTimeRange() ?? {
      startDate: null,
      endDate: null,
    };

    const request: AdminEventSearchRequest = {
      keyword: keyword || null,
      organizer: null,
      status: this.selectedStatus ? ActivityStatus.toApiStatus(this.selectedStatus) : null,
      startDate: this.toRequestDateTime(startDate),
      endDate: this.toRequestDateTime(endDate),
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
    };

    this.adminApiService.searchEvents(request).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('查詢失敗', res.message);
          return;
        }

        this.activities = res.data.items.map((item) => this.mapEventListItem(item));
        this.totalItems = res.data.totalItems;
      },
      error: async (error) => {
        await this.alert.error('查詢失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  /** 把日期選擇器的 yyyy-MM-dd 轉成後端 LocalDateTime 需要的格式 */
  private toRequestDateTime(date: string | null): string | null {
    return date ? `${date}T00:00:00` : null;
  }

  /** 把 API 回傳的活動列表項目轉成畫面用的 ActivityListItem */
  private mapEventListItem(item: AdminEventListDto): ActivityListItem {
    const [startDate = '', endDate = ''] = item.date.split(' - ');

    return {
      id: item.id,
      image: item.imgUrl,
      name: item.event,
      organizer: item.organizer,
      startDate,
      endDate,
      status: ActivityStatus.fromApiStatus(item.status),
      submittedAt: item.reviewTime,
    };
  }

  /** 依表格容器目前的高度，重新計算一頁可顯示的列數 */
  private recalculatePageSize(): void {
    this.pageSize = 6;
  }

  /** 取得狀態對應的標籤顏色 class */
  getStatusClass(status: string): string {
    return ActivityStatus.getClass(status);
  }

  /** 將 API 使用的 ISO 日期轉成全站統一的活動日期區間格式。 */
  formatDateRange(startDate: string, endDate: string): string {
    return `${startDate.replaceAll('-', '/')} - ${endDate.replaceAll('-', '/')}`;
  }

  /** 日期時間顯示統一為 YYYY/MM/DD HH:mm；後端「活動尚未送審」等純文字提示則原樣顯示。 */
  formatDateTime(value: string): string {
    const normalized = value.trim().replace('T', ' ');
    if (!normalized) return '-';
    if (!/\d/.test(normalized)) return normalized;

    const [date, time = '00:00'] = normalized.split(/\s+/, 2);
    return `${date.replaceAll('-', '/')} ${time.slice(0, 5)}`;
  }

  /** 是否需要在固定顯示的「查看」按鈕左側加上「審核」按鈕。 */
  isReviewNeeded(status: string): boolean {
    return this.needsReviewStatuses.includes(status);
  }

  /** 依活動狀態提供明確的審核按鈕名稱。 */
  getReviewButtonLabel(status: string): string {
    return status === ActivityStatus.unpublishRequested ? '下架審核' : '審核';
  }
}

