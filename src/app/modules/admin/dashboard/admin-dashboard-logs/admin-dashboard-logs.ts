import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { OperationType } from '../../../../models/type/OperationType';
import { LogTargetType } from '../../../../models/type/LogTargetType';
import { AdminLogItem } from '../../../../models/interface/admin/AdminLogItem';
import { AdminLogsSearchRequest, AdminOperationLogDto } from '../../../../models/interface/admin/AdminLogSearch';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';

@Component({
  selector: 'app-admin-dashboard-logs',
  imports: [
    Dropdown,
    DateRangeSelector,
    DashboardPagination,
  ],
  templateUrl: './admin-dashboard-logs.html',
  styleUrl: './admin-dashboard-logs.scss',
})
export class AdminDashboardLogs implements AfterViewInit {
  constructor(
    private router: Router,
    private readonly adminApiService: AdminApiService,
    private readonly alert: AlertService,
  ) {}

  @ViewChild(DateRangeSelector) timeSelectorRef!: DateRangeSelector;
  @ViewChild('operationDropdown') operationDropdownRef!: Dropdown;
  @ViewChild('tableWrapper') tableWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('resultSection') resultSectionRef!: ElementRef<HTMLDivElement>;


  /** 每列高度，需與 SCSS `.activity-table tbody tr` 的高度一致 */
  private readonly rowHeight = 56;
  /** 表頭高度，需與 SCSS `.activity-table thead tr` 的高度一致 */
  private readonly headerHeight = 48;

  /** 操作類型下拉選單*/
  operationOptions: string[] = [
    "全部",
    OperationType.activityReview,
    OperationType.requestRevision,
    OperationType.mapBuildCompleted,
    OperationType.eventUnpublishReview,
    OperationType.accountRestored,
    OperationType.accountDisabled,
    OperationType.systemSetting,
  ];

  /** 操作對象角色篩選選項。 */
  targetRoleOptions: string[] = [
    '全部',
    LogTargetType.system,
    LogTargetType.event,
    LogTargetType.organizer,
    LogTargetType.vendor,
  ];

  /** 目前篩選條件：操作類型 */
  private selectedOperation = '';
  /** 目前篩選條件：操作對象角色。 */
  private selectedTargetRole: '' | AdminLogItem['targetRole'] = '';
  /** 目前輸入的搜尋關鍵字 */
  searchKeyword = '';

  /** 目前頁面顯示的活動列表（已套用篩選＋分頁） */
  logs: AdminLogItem[] = [];

  /** 目前頁碼 */
  currentPage = 1;
  /** 每頁筆數，依畫面剩餘高度動態計算（見 Task 8），初始為合理預設值 */
  /** 管理頁統一每頁顯示 6 筆。 */
  pageSize = 6;
  /** 篩選後的總筆數 */
  totalItems = 0;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.recalculatePageSize();
      this.fetchLogs();
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const previousPageSize = this.pageSize;
    this.recalculatePageSize();

    if (this.pageSize !== previousPageSize) {
      this.currentPage = 1;
      this.fetchLogs();
    }
  }

  onOperationSelected(value: string): void {
    this.selectedOperation = value === "全部" ? '' : value;
  }

  onTargetRoleSelected(value: string): void {
    this.selectedTargetRole = value === '全部' ? '' : (value as AdminLogItem['targetRole']);
  }

  /** 更新搜尋關鍵字 */
  onSearchKeywordInput(event: Event): void {
    this.searchKeyword = (event.target as HTMLInputElement).value;
  }


  /** 搜尋按鈕：彙整篩選條件後重新查詢（回到第一頁） */
  onSearch(): void {
    this.currentPage = 1;
    this.fetchLogs();
  }

  /** 切換頁碼：每次切頁都重新呼叫一次「後端」 */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.fetchLogs();
  }

  /**
   * 串接 API："/api/admin/logs/search"，依搜尋列篩選條件與目前頁碼查詢操作紀錄
   */
  private fetchLogs(): void {
    const keyword = this.searchKeyword.trim();
    const { startDate, endDate } = this.timeSelectorRef?.getTimeRange() ?? {
      startDate: null,
      endDate: null,
    };

    const request: AdminLogsSearchRequest = {
      keyWord: keyword || null,
      operationType: this.selectedOperation ? OperationType.toApiOperationType(this.selectedOperation) : null,
      targetType: this.selectedTargetRole ? LogTargetType.toApiTargetType(this.selectedTargetRole) : null,
      startAt: this.toRequestDateTime(startDate),
      endAt: this.toRequestDateTime(endDate),
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
    };

    this.adminApiService.searchLogs(request).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('查詢失敗', res.message);
          return;
        }

        this.logs = res.data.items.map((item) => this.mapLogItem(item));
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

  /** 把 API 回傳的操作紀錄項目轉成畫面用的 AdminLogItem */
  private mapLogItem(item: AdminOperationLogDto): AdminLogItem {
    return {
      id: item.id,
      createdAt: item.createdAt,
      operator: item.operator,
      actionType: OperationType.fromApiOperationType(item.operationType),
      target: item.targetName,
      targetRole: LogTargetType.fromApiTargetType(item.targetType) as AdminLogItem['targetRole'],
      targetEmail: item.email ?? '-',
      details: item.content,
    };
  }

  /** 依表格容器目前的高度，重新計算一頁可顯示的列數 */
  private recalculatePageSize(): void {
    this.pageSize = 6;
  }

  /** 取得操作類型對應的標籤顏色 class */
  getOperationClass(type: string): string {
    return OperationType.getClass(type);
  }

  /** 取得操作對象類型對應的標籤顏色 class */
  getTargetRoleClass(role: string): string {
    return LogTargetType.getClass(role);
  }

  /** 統一操作時間格式；API 僅回傳日期時補上 00:00。 */
  formatDateTime(value: string): string {
    const normalized = value.trim().replace('T', ' ');
    if (!normalized) return '-';

    const [date, time = '00:00'] = normalized.split(/\s+/, 2);
    return `${date.replaceAll('-', '/')} ${time.slice(0, 5)}`;
  }

}

