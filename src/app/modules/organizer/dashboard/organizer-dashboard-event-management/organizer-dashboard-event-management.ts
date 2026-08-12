import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerEventRow } from '../../../../models/interface/organizer/OrganizerEventRow';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { DashboardDataTable, DashboardTableAction, DashboardTableColumn } from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { AlertService } from '../../../../core/services/alert.service';
import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';

@Component({
  selector: 'app-organizer-dashboard-event-management',
  imports: [FormsModule, DashboardDataTable, DashboardPagination, Dropdown, DateRangeSelector, RouterLink],
  templateUrl: './organizer-dashboard-event-management.html',
  styleUrl: './organizer-dashboard-event-management.scss',
})
/** 活動管理列表，負責搜尋分頁及送審、撤回、發布與下架等快速操作。 */
export class OrganizerDashboardEventManagement implements OnInit {
  /** 日期區間元件，用來取得列表搜尋的起訖日期。 */
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;

  /** 目前分頁。 */
  currentPage = 1;

  /** 每頁顯示筆數。 */
  pageSize = 6;

  /** 目前選取的活動狀態。空字串代表全部狀態。 */
  selectedStatus = '';

  /** 活動名稱搜尋輸入值。 */
  searchKeyword = '';

  /** 日期篩選起日。 */
  filterStartDate: string | null = null;

  /** 日期篩選迄日。 */
  filterEndDate: string | null = null;

  /** 已套用的活動名稱搜尋條件。 */
  private appliedKeyword = '';

  /** 已套用的日期篩選起日。 */
  private appliedStartDate: string | null = null;

  /** 已套用的日期篩選迄日。 */
  private appliedEndDate: string | null = null;

  /** 活動狀態下拉選單選項。 */
  readonly statusOptions = ActivityStatus.filterList;

  /** 活動管理列表欄位設定。 */
  columns: DashboardTableColumn[] = [
    { key: 'name', label: '活動名稱', type: 'imageText', width: '14%', truncate: true },
    { key: 'date', label: '活動日期', nowrap: true, width: '18%' },
    { key: 'status', label: '活動狀態', type: 'status', align: 'center', width: '9%' },
    { key: 'location', label: '活動地點', width: '17%' },
    { key: 'signupProgress', label: '報名人數', type: 'progress', align: 'center', nowrap: true, width: '8%' },
    {
      key: 'applicationProgress',
      label: '報名處理進度',
      type: 'multiValue',
      align: 'center',
      nowrap: true,
      width: '18%',
      valueKeys: ['pendingReviewCount', 'paidCount', 'selectedCount'],
      valueLabels: ['待審核', '已付款', '已選位'],
    },
    { key: 'action', label: '', type: 'action', align: 'end', width: '16%' },
  ];

  /** 後端回傳的目前分頁活動資料。 */
  rows: OrganizerEventRow[] = [];
  /** 目前頁面實際顯示的資料。 */
  displayRows: OrganizerEventRow[] = [];
  private serverTotalItems = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly alert: AlertService,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 初始化列表，並從網址 query params 還原搜尋、篩選與分頁狀態。 */
  ngOnInit(): void {
    const pageFromUrl = Number(this.route.snapshot.queryParamMap.get('page'));
    const statusFromUrl = this.route.snapshot.queryParamMap.get('status') ?? '';
    this.searchKeyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
    this.filterStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.filterEndDate = this.route.snapshot.queryParamMap.get('endDate');
    this.appliedKeyword = this.searchKeyword.trim().toLocaleLowerCase();
    this.appliedStartDate = this.filterStartDate;
    this.appliedEndDate = this.filterEndDate;

    if (Number.isInteger(pageFromUrl) && pageFromUrl > 0) {
      this.currentPage = pageFromUrl;
    }

    if (this.statusOptions.includes(statusFromUrl) && statusFromUrl !== ActivityStatus.all) {
      this.selectedStatus = statusFromUrl;
    }

    this.loadEvents();
  }

  /** 篩選後的總筆數。 */
  get totalItems(): number {
    return this.serverTotalItems;
  }

  /** 切換分頁。 */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncListQueryParams();
    this.loadEvents();
  }

  /** 切換活動狀態篩選。 */
  selectStatus(status: string): void {
    this.selectedStatus = status === ActivityStatus.all ? '' : status;
    this.currentPage = 1;
    this.syncListQueryParams();
    this.loadEvents();
  }

  /** 套用搜尋條件並重新查詢活動列表。 */
  searchActivities(): void {
    const range = this.dateRangeSelector?.getTimeRange() ?? {
      startDate: this.filterStartDate,
      endDate: this.filterEndDate,
    };
    let startDate = range.startDate;
    let endDate = range.endDate;

    if (startDate && endDate && startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    this.filterStartDate = startDate;
    this.filterEndDate = endDate;
    this.appliedKeyword = this.searchKeyword.trim().toLocaleLowerCase();
    this.appliedStartDate = startDate;
    this.appliedEndDate = endDate;
    this.currentPage = 1;
    this.syncListQueryParams();
    this.loadEvents();
  }

  /** 點擊列表操作按鈕，帶著返回列表所需狀態前往活動詳情。 */
  onTableRowClick(row: Record<string, unknown>): void {
    void this.onTableAction({ key: 'view', label: '查看', variant: 'outline', row });
  }

  async onTableAction(action: DashboardTableAction): Promise<void> {
    const activity = action.row as unknown as OrganizerEventRow;
    if (action.key === 'unpublish') {
      await this.requestUnpublish(activity);
      return;
    }

    if (await this.handleQuickStatusAction(action.key ?? '', activity)) {
      return;
    }

    if (action.key === 'edit') {
      this.router.navigate(['/organizer/dash-board/activity/detail'], {
        queryParams: {
          edit: activity.id,
          returnPage: this.currentPage,
          returnStatus: this.selectedStatus || null,
        },
        state: {
          activity,
          returnPage: this.currentPage,
          returnStatus: this.selectedStatus,
        },
      });
      return;
    }

    this.router.navigate(['/organizer/dash-board/activity/detail', activity.id], {
      queryParams: {
        returnPage: this.currentPage,
        returnStatus: this.selectedStatus || null,
        returnKeyword: this.searchKeyword.trim() || null,
        returnStartDate: this.appliedStartDate,
        returnEndDate: this.appliedEndDate,
      },
      state: {
        activity,
        returnPage: this.currentPage,
        returnStatus: this.selectedStatus,
        returnKeyword: this.searchKeyword.trim(),
        returnStartDate: this.appliedStartDate,
        returnEndDate: this.appliedEndDate,
      },
    });
  }

  /** 列表上不需閱讀完整資料的單一步驟狀態操作，統一使用確認 Alert。 */
  private async handleQuickStatusAction(actionKey: string, activity: OrganizerEventRow): Promise<boolean> {
    switch (actionKey) {
      case 'submit':
        if (!await this.alert.confirm(
          '送出審核確認',
          `確定要送出「${activity.name}」進行審核嗎？<br>送出後將暫時無法編輯活動內容，需等待審核結果。`,
          '確定送出',
        )) return true;
        if (!await this.submitReviewFromList(activity)) return true;
        await this.alert.success(
          '送出審核成功',
          `活動「${activity.name}」已送出審核，審核結果將透過通知中心告知。`,
          '知道了',
        );
        return true;
      case 'withdraw':
        if (!await this.alert.confirm(
          '撤回申請確認',
          `確定要撤回「${activity.name}」的審核申請嗎？<br>撤回後活動將回到草稿狀態，可再次編輯與送審。`,
          '確定撤回',
        )) return true;
        if (!await this.withdrawReviewFromList(activity)) return true;
        await this.alert.success(
          '申請已撤回',
          `活動「${activity.name}」已回到草稿狀態。`,
          '知道了',
        );
        return true;
      case 'resubmit':
        if (!await this.alert.confirm(
          '重新送審確認',
          `確定要重新送審「${activity.name}」嗎？<br>送出後將再次進入審核流程。`,
          '確定重新送審',
        )) return true;
        if (!await this.submitReviewFromList(activity)) return true;
        await this.alert.success(
          '重新送審成功',
          `活動「${activity.name}」已重新送出審核。`,
          '知道了',
        );
        return true;
      case 'publish':
        if (!await this.alert.confirm(
          '發布活動確認',
          `確定要發布「${activity.name}」嗎？<br>發布後活動將對外公開並開放瀏覽與報名。`,
          '確定發布',
        )) return true;
        if (!await this.publishEventFromList(activity)) return true;
        await this.alert.success(
          '發布活動成功',
          `活動「${activity.name}」已發布並進入「報名中」狀態。`,
          '知道了',
        );
        return true;
      default:
        return false;
    }
  }

  private async submitReviewFromList(activity: OrganizerEventRow): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.submitOrganizerEventReview(activity.id),
      );
      if (isApiSuccessStatus(response.statusCode)) {
        this.updateActivityStatus(activity.id, ActivityStatus.pendingReview);
        return true;
      }

      const missingFields = response.data?.missingFields ?? [];
      await this.alert.error(
        '無法送出審核',
        missingFields.length > 0
          ? `${response.message}，請完成 ${missingFields.length} 項必要資料。`
          : response.message || '送出審核失敗。',
      );
      if (missingFields.length > 0) {
        this.router.navigate(['/organizer/dash-board/activity/detail'], {
          queryParams: {
            edit: activity.id,
            step: this.reviewStepForMissingFields(missingFields) + 1,
            validation: 'review',
            returnPage: this.currentPage,
            returnStatus: this.selectedStatus || null,
          },
        });
      }
      return false;
    } catch {
      await this.alert.error('無法送出審核', '送出審核失敗，請稍後再試。');
      return false;
    }
  }

  private async withdrawReviewFromList(activity: OrganizerEventRow): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.withdrawOrganizerEventReview(activity.id),
      );
      if (isApiSuccessStatus(response.statusCode) && response.data) {
        this.loadEvents();
        return true;
      }
      await this.alert.error(
        '無法撤回申請',
        response.statusCode === 409
          ? '活動狀態已變更，可能已由管理員完成審核，系統將重新載入最新資料。'
          : response.message || '撤回審核申請失敗。',
      );
      this.loadEvents();
      return false;
    } catch {
      await this.alert.error('無法撤回申請', '撤回審核申請失敗，請稍後再試。');
      this.loadEvents();
      return false;
    }
  }

  private async publishEventFromList(activity: OrganizerEventRow): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.publishOrganizerEvent(activity.id),
      );
      if (isApiSuccessStatus(response.statusCode) && response.data) {
        this.loadEvents();
        return true;
      }
      await this.alert.error(
        '無法發布活動',
        response.statusCode === 409
          ? '活動狀態已變更，系統將重新載入最新資料。'
          : this.publishFailureMessage(response.data?.missingFields, response.message),
      );
      this.loadEvents();
      return false;
    } catch {
      await this.alert.error('無法發布活動', '發布活動失敗，請稍後再試。');
      this.loadEvents();
      return false;
    }
  }

  private publishFailureMessage(fields: string[] | undefined, fallback: string): string {
    if (!fields?.length) return fallback || '活動尚未符合發布條件。';
    const labels: Record<string, string> = {
      coverImage: '活動封面圖片',
      categoryIds: '活動類型',
      'booth.mapImage': '攤位配置圖片',
      'booth.zones': '攤位分區',
      'booth.stalls': '互動式攤位數量',
      'schedule.startAt': '活動開始時間',
      'schedule.endAt': '活動結束時間',
      'schedule.registrationEndAt': '報名截止時間',
    };
    return `請確認：${fields.map((field) => labels[field] ?? field).join('、')}。`;
  }

  private reviewStepForMissingFields(fields: string[]): number {
    if (fields.some((field) => /^(eventTitle|summary|description|categoryIds|coverImage)/.test(field))) return 0;
    if (fields.some((field) => field.startsWith('schedule.') || field.startsWith('location.traffic'))) return 1;
    if (fields.some((field) => field.startsWith('location.') || field.startsWith('booth.'))) return 2;
    return 3;
  }

  private updateActivityStatus(
    activityId: number,
    status: string,
    changes: Partial<OrganizerEventRow> = {},
  ): void {
    this.rows = this.rows.map((row) => row.id === activityId ? { ...row, ...changes, status } : row);
    this.updateDisplayRows();
  }

  private async requestUnpublish(activity: OrganizerEventRow): Promise<void> {
    const reason = await this.alert.requiredReason({
      title: '申請下架活動',
      description: `請填寫「${activity.name}」的下架原因，送出後將由管理員審核。`,
      fieldLabel: '下架原因',
      placeholder: '請說明申請下架活動的原因',
      maxLength: 500,
      confirmButtonText: '下一步',
    });
    if (!reason) return;

    const confirmed = await this.alert.confirmReason({
      title: '確認送出下架申請',
      description: '請確認活動與下架原因，送出後將進入管理員審核流程。',
      subjectLabel: '活動名稱',
      subject: activity.name,
      reasonLabel: '下架原因',
      reason,
      confirmButtonText: '確認送出',
    });
    if (!confirmed) return;

    if (!await this.requestUnpublishFromList(activity, reason)) return;

    await this.alert.success(
      '下架申請已送出',
      `活動「${activity.name}」已進入下架審核流程。<br>審核完成前，活動狀態為「下架申請中」。`,
      '知道了',
    );
  }

  private async requestUnpublishFromList(
    activity: OrganizerEventRow,
    reason: string,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.requestOrganizerEventUnpublish(activity.id, reason),
      );
      if (isApiSuccessStatus(response.statusCode) && response.data) {
        this.loadEvents();
        return true;
      }
      await this.alert.error(
        '無法送出下架申請',
        response.statusCode === 409
          ? '活動狀態已變更，或已有待審核的下架申請，系統將重新載入最新資料。'
          : response.message || '下架申請送出失敗。',
      );
      this.loadEvents();
      return false;
    } catch {
      await this.alert.error('無法送出下架申請', '下架申請送出失敗，請稍後再試。');
      this.loadEvents();
      return false;
    }
  }

  /** 同步列表狀態到 query params，讓返回頁面時可以還原目前篩選條件。 */
  private syncListQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.currentPage,
        status: this.selectedStatus || null,
        keyword: this.searchKeyword.trim() || null,
        startDate: this.filterStartDate || null,
        endDate: this.filterEndDate || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadEvents(): void {
    this.organizerApi.searchOrganizerEvents({
      keyword: this.appliedKeyword || undefined,
      status: this.toApiStatus(this.selectedStatus),
      startDate: this.appliedStartDate,
      endDate: this.appliedEndDate,
      sort: 'UPCOMING_FIRST',
      page: this.currentPage,
      pageSize: this.pageSize,
    }).subscribe((response) => {
      if (!isApiSuccessStatus(response.statusCode) || !response.data) return;
      this.serverTotalItems = response.data.totalCount;
      this.rows = response.data.events.items.map((event) => ({
        id: event.eventId,
        name: event.eventTitle ?? '',
        nameImage: event.coverImageUrl || 'assets/images/shared/no-image-placeholder.svg',
        date: `${this.formatApiDate(event.eventStartAt)} - ${this.formatApiDate(event.eventEndAt)}`,
        location: [event.city, event.district, event.locationName].filter(Boolean).join(' '),
        status: event.statusText,
        signupProgress: `${event.registeredCount} / ${event.capacity ?? 0}`,
        signupProgressCurrent: event.registeredCount,
        signupProgressTotal: event.capacity ?? 0,
        pendingReviewCount: String(event.pendingReviewCount),
        paidCount: String(event.paidCount),
        selectedCount: String(event.selectedCount),
        actionLabel: '查看',
      }));
      this.displayRows = this.rows.map((row) => this.toDisplayRow(row));
    });
  }

  private toApiStatus(status: string): string | undefined {
    const mapping = new Map<string, string>([
      [ActivityStatus.draft, 'DRAFT'],
      [ActivityStatus.pendingReview, 'PENDING_REVIEW'],
      [ActivityStatus.revisionRequired, 'REVISION_REQUIRED'],
      [ActivityStatus.mapBuilding, 'MAP_BUILDING'],
      [ActivityStatus.readyToPublish, 'READY_TO_PUBLISH'],
      [ActivityStatus.registrationOpen, 'REGISTRATION_OPEN'],
      [ActivityStatus.full, 'FULL'],
      [ActivityStatus.published, 'PUBLISHED'],
      [ActivityStatus.brandsPublished, 'BRANDS_PUBLISHED'],
      [ActivityStatus.finalConfirmation, 'FINAL_CONFIRMATION'],
      [ActivityStatus.active, 'ACTIVE'],
      [ActivityStatus.ended, 'ENDED'],
      [ActivityStatus.unpublishRequested, 'UNPUBLISH_REQUESTED'],
      [ActivityStatus.unpublished, 'UNPUBLISHED'],
    ]);
    return mapping.get(status);
  }

  private formatApiDate(value: string | null): string {
    const date = value?.slice(0, 10);
    return date ? date.replaceAll('-', '/') : '';
  }

  /** 依目前後端分頁資料更新列表顯示。 */
  private updateDisplayRows(): void {
    this.displayRows = this.rows.map((row) => this.toDisplayRow(row));
  }

  /** 依活動狀態產生列表操作按鈕，避免列表按鈕和狀態規則不一致。 */
  private getRowActions(row: OrganizerEventRow): NonNullable<OrganizerEventRow['actions']> {
    switch (row.status) {
      case ActivityStatus.draft:
        return [
          { key: 'edit', label: '編輯', variant: 'outline' },
          {
            key: 'submit',
            label: '送出審核',
            variant: 'primary',
          },
        ];
      case ActivityStatus.pendingReview:
        return [
          { key: 'withdraw', label: '撤回申請', variant: 'outline' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ActivityStatus.revisionRequired:
        return [
          { key: 'edit', label: '編輯', variant: 'outline' },
          { key: 'resubmit', label: '重新送審', variant: 'primary' },
        ];
      case ActivityStatus.mapBuilding:
        return [{ key: 'view', label: '查看', variant: 'outline' }];
      case ActivityStatus.readyToPublish:
        return [
          { key: 'publish', label: '發布活動', variant: 'primary' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      case ActivityStatus.registrationOpen:
      case ActivityStatus.full:
      case ActivityStatus.published:
      case ActivityStatus.brandsPublished:
      case ActivityStatus.finalConfirmation:
      case ActivityStatus.active:
        return [
          { key: 'unpublish', label: '下架活動', variant: 'danger' },
          { key: 'view', label: '查看', variant: 'outline' },
        ];
      default:
        return [{ key: 'view', label: '查看', variant: 'outline' }];
    }
  }

  /** 依活動狀態整理列表操作按鈕與統計欄位顯示值。 */
  private toDisplayRow(row: OrganizerEventRow): OrganizerEventRow {
    const actions = this.getRowActions(row);
    const pendingStatisticStatuses = [
      ActivityStatus.pendingReview,
      ActivityStatus.revisionRequired,
      ActivityStatus.mapBuilding,
      ActivityStatus.readyToPublish,
      ActivityStatus.unpublished,
    ];

    if (row.status === ActivityStatus.draft) {
      return {
        ...row,
        signupProgress: '',
        pendingReviewCount: '',
        paidCount: '',
        selectedCount: '',
        actionLabel: actions[0]?.label ?? '查看',
        actions,
      };
    }

    return {
      ...row,
      signupProgress: pendingStatisticStatuses.includes(row.status) || row.signupProgress.startsWith('0 /')
        ? '-'
        : row.signupProgress,
      paidCount: pendingStatisticStatuses.includes(row.status) || row.paidCount === '0'
        ? '-'
        : row.paidCount,
      pendingReviewCount: pendingStatisticStatuses.includes(row.status) || row.pendingReviewCount === '0'
        ? '-'
        : row.pendingReviewCount,
      selectedCount: pendingStatisticStatuses.includes(row.status) || row.selectedCount === '0'
        ? '-'
        : row.selectedCount,
      actionLabel: actions[0]?.label ?? '查看',
      actions,
    };
  }
}

