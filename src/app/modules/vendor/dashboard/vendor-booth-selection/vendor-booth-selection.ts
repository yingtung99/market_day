import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { VendorService } from '../../../../core/Vendor/vendorApi/vendor.service';
import { AlertService } from '../../../../core/services/alert.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import type { MarketMapBooth, MarketMapData } from '../../../../models/interface/shared/MarketMap';
import type { VendorMarketDetail } from '../../../../models/interface/vendor/VendorMarketDetail';
import type {
  VendorSelectedStall,
  VendorStallMap,
  VendorStallMapItem,
} from '../../../../models/interface/vendor/VendorStallMap';
import { VendorStatus } from '../../../../models/status/VendorStatus';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { DEFAULT_MARKET_MAP_DATA, MarketMap } from '../../../shared/market-map/market-map';
import {
  VendorBoothSelectionDialog,
  VendorBoothSelectionModal,
} from '../modals/vendor-booth-selection-modal/vendor-booth-selection-modal';

interface DaySelection {
  date: string;
  booth: MarketMapBooth | null;
  selectedAt: string | null;
}

@Component({
  selector: 'app-vendor-booth-selection',
  imports: [CommonModule, RouterLink, MarketMap, Dropdown, VendorBoothSelectionModal],
  templateUrl: './vendor-booth-selection.html',
  styleUrl: './vendor-booth-selection.scss',
})
export class VendorBoothSelection implements OnInit {
  @ViewChild('marketMap') private marketMapComponent?: MarketMap;

  readonly vendorStatus = VendorStatus;
  readonly applicationNo: string;
  /** 返回報名詳情時使用的資料庫 applicationId。 */
  readonly applicationId: string;
  readonly days: DaySelection[] = [];

  activityTitle = '';
  activityDateText = '';
  activityAddress = '';
  boothTotal = 0;
  isLoading = true;
  isMapLoading = false;

  activeDayIndex = 0;
  viewMode = false;
  isSubmitting = false;
  dialog: VendorBoothSelectionDialog | null = null;
  private currentMapStalls = new Map<string, VendorStallMapItem>();
  private persistedSelections = new Map<string, VendorSelectedStall>();
  private mapRequestSequence = 0;
  private applicationDates: string[] = [];
  private registrationPeriodText = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly vendorDashboardService: VendorDashboardService,
    private readonly vendorService: VendorService,
    private readonly alert: AlertService,
  ) {
    this.applicationNo = this.route.snapshot.paramMap.get('applicationNo') ?? 'MD20260601001';
    this.applicationId = this.route.snapshot.queryParamMap.get('applicationId') ?? this.applicationNo;
    this.viewMode = this.route.snapshot.queryParamMap.get('mode') === 'view';
  }

  ngOnInit(): void {
    const applicationId = Number(this.applicationId);
    if (!Number.isInteger(applicationId) || applicationId < 1) {
      this.isLoading = false;
      void this.alert.error('活動資訊載入失敗', '報名資料不正確，無法取得活動資訊。');
      return;
    }

    this.vendorDashboardService.getVendorApplicationDetail(applicationId).subscribe({
      next: (response) => {
        if (!isApiSuccessStatus(response.statusCode) || !response.data?.event?.eventId) {
          this.handleActivityLoadFailure(response.message);
          return;
        }

        this.applicationDates = this.extractRegistrationDates(
          response.data.applicationdetail?.registrationPeriods,
        );
        if (this.applicationDates.length === 0) {
          this.applicationDates = this.uniqueDates(
            response.data.stall?.map((stall) => stall.applyDate) ?? [],
          );
        }
        this.registrationPeriodText = this.formatRegistrationPeriods(
          response.data.applicationdetail?.registrationPeriods,
        );

        this.loadActivity(response.data.event.eventId);
      },
      error: () => this.handleActivityLoadFailure(),
    });
  }

  get activeDay(): DaySelection | undefined { return this.days[this.activeDayIndex]; }
  get allSelected(): boolean { return this.days.length > 0 && this.days.every((day) => day.booth); }
  get dateOptions(): string[] { return this.days.map((day) => day.date); }

  get mapData(): MarketMapData {
    const selectedCode = this.activeDay?.booth?.code;
    const persistedCode = this.persistedSelections.get(
      this.normalizeDate(this.activeDay?.date ?? ''),
    )?.stallNo;
    return {
      ...DEFAULT_MARKET_MAP_DATA,
      booths: DEFAULT_MARKET_MAP_DATA.booths.map((booth) => {
        const apiStall = this.currentMapStalls.get(booth.code.toUpperCase());
        const size = apiStall
          ? `${apiStall.width ?? 3}m × ${apiStall.length ?? 3}m`
          : booth.size;

        return {
          ...booth,
          zone: apiStall?.zoneName || booth.zone,
          size,
          brand: undefined,
          status: booth.id === 'service-booth'
            ? 'occupied'
            : booth.code === persistedCode
              ? 'mine'
              : booth.code === selectedCode
                ? 'selected'
                : apiStall && this.isAvailableStall(apiStall)
                  ? 'available'
                  : 'occupied',
        };
      }),
    };
  }

  selectDay(index: number): void {
    if (index < 0 || index >= this.days.length) return;
    this.activeDayIndex = index;
    this.loadStallMap(this.days[index].date);
  }

  selectDayByDate(date: string): void {
    const index = this.days.findIndex((day) => day.date === date);
    if (index >= 0) this.selectDay(index);
  }

  selectBooth(booth: MarketMapBooth): void {
    const activeDay = this.activeDay;
    if (this.isMapLoading || !activeDay || this.viewMode || booth.status === 'occupied') return;
    activeDay.booth = booth;
  }

  handleFullscreenAction(): void {
    if (this.isMapLoading || !this.activeDay?.booth) {
      return;
    }

    if (this.allSelected) {
      this.marketMapComponent?.closeFullscreenMap();
      this.requestComplete();
      return;
    }

    const nextUnselectedIndex = this.days.findIndex((day) => !day.booth);
    if (nextUnselectedIndex >= 0) {
      this.selectDay(nextUnselectedIndex);
    }
  }

  requestComplete(): void {
    if (!this.allSelected) return;
    this.dialog = 'confirm';
  }

  confirmComplete(): void {
    if (!this.allSelected || this.isSubmitting) return;

    this.isSubmitting = true;
    // 畫面以 yyyy/MM/dd 顯示，送後端前轉成 LocalDate 可解析的 yyyy-MM-dd。
    const request = {
      applicationNo: this.applicationNo,
      selections: this.days.map((day) => ({
        applyDate: day.date.replaceAll('/', '-'),
        stallNo: day.booth!.code,
      })),
    };

    this.vendorDashboardService.selectEventStall(request).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (isApiSuccessStatus(response.statusCode)) {
          this.dialog = 'success';
          return;
        }

        this.handleSelectionFailure(response.message);
      },
      error: () => {
        this.isSubmitting = false;
        this.dialog = null;
        void this.alert.error('攤位選擇失敗', '無法連線至伺服器，請稍後再試。');
      },
    });
  }

  retrySelection(): void {
    this.days.forEach((day) => {
      if (!this.persistedSelections.has(this.normalizeDate(day.date))) {
        day.booth = null;
        day.selectedAt = null;
      }
    });
    this.activeDayIndex = 0;
    this.dialog = null;
    if (this.activeDay) this.loadStallMap(this.activeDay.date);
  }

  closeDialog(): void { this.dialog = null; }

  backToDetail(): void {
    this.router.navigate(['/vendor/dash-board/application-record/detail', this.applicationId]);
  }

  private loadActivity(eventId: number): void {
    this.vendorService.getMarketDetail(eventId).subscribe({
      next: (response) => {
        if (!isApiSuccessStatus(response.statusCode) || !response.data) {
          this.handleActivityLoadFailure(response.message);
          return;
        }

        this.applyActivity(response.data);
      },
      error: () => this.handleActivityLoadFailure(),
    });
  }

  private applyActivity(activity: VendorMarketDetail): void {
    this.activityTitle = activity.eventTitle;
    this.activityAddress = activity.locationName || activity.address;
    this.boothTotal = activity.dailyAvailability[0]?.totalStalls ?? activity.maxBooths;

    const viewDates = this.route.snapshot.queryParamMap.get('dates')?.split(',').filter(Boolean) ?? [];
    const selectedTimes = this.route.snapshot.queryParamMap.get('selectedAt')?.split(',') ?? [];
    const selectedTimeByDate = new Map(viewDates.map((date, index) => [
      this.normalizeDate(date),
      selectedTimes[index] || null,
    ]));

    const activityDates = this.applicationDates.length > 0
      ? this.applicationDates
      : this.uniqueDates(activity.dailyAvailability.map((item) => item.applyDate));
    this.activityDateText = this.registrationPeriodText
      || this.formatApplicationDates(activityDates);
    this.days.splice(0, this.days.length, ...activityDates.map((date) => {
      const normalizedDate = this.normalizeDate(date);
      return {
        date,
        booth: null,
        selectedAt: this.viewMode ? selectedTimeByDate.get(normalizedDate) ?? null : null,
      };
    }));
    this.activeDayIndex = 0;
    if (!this.activeDay) {
      this.handleActivityLoadFailure('此報名沒有可選擇的活動日期。');
      return;
    }
    this.loadStallMap(this.activeDay.date, true);
  }

  private loadStallMap(date: string, initialize = false): void {
    const normalizedDate = this.normalizeDate(date);
    const requestSequence = ++this.mapRequestSequence;
    this.isMapLoading = true;
    this.currentMapStalls = new Map<string, VendorStallMapItem>();

    this.vendorDashboardService.getVendorStallMap(this.applicationNo, normalizedDate).subscribe({
      next: (response) => {
        if (requestSequence !== this.mapRequestSequence) return;
        this.isMapLoading = false;
        if (!isApiSuccessStatus(response.statusCode) || !response.data) {
          this.handleMapLoadFailure(response.message, initialize);
          return;
        }

        this.applyStallMap(response.data);
        this.isLoading = false;
      },
      error: () => {
        if (requestSequence !== this.mapRequestSequence) return;
        this.isMapLoading = false;
        this.handleMapLoadFailure('', initialize);
      },
    });
  }

  private applyStallMap(stallMap: VendorStallMap): void {
    this.activityTitle = stallMap.event.eventTitle || this.activityTitle;
    this.activityAddress = stallMap.event.address || this.activityAddress;
    this.boothTotal = stallMap.stalls.length;
    this.currentMapStalls = new Map(
      stallMap.stalls.map((stall) => [stall.stallNo.toUpperCase(), stall]),
    );
    this.persistedSelections = new Map(
      stallMap.application.selectedStalls.map((stall) => [
        this.normalizeDate(stall.applyDate),
        stall,
      ]),
    );

    const apiDates = this.parseApplyDates(stallMap.application.applyDates);
    if (apiDates.length > 0) {
      this.applicationDates = apiDates;
      if (!this.registrationPeriodText) {
        this.activityDateText = this.formatApplicationDates(apiDates);
      }
    }
    if (apiDates.length > 0 && !this.sameDates(apiDates, this.days.map((day) => day.date))) {
      const selectedTimes = new Map(
        this.days.map((day) => [this.normalizeDate(day.date), day.selectedAt]),
      );
      this.days.splice(0, this.days.length, ...apiDates.map((date) => ({
        date,
        booth: null,
        selectedAt: selectedTimes.get(this.normalizeDate(date)) ?? null,
      })));
      const activeIndex = this.days.findIndex(
        (day) => this.normalizeDate(day.date) === this.normalizeDate(stallMap.application.currentApplyDate),
      );
      this.activeDayIndex = activeIndex >= 0 ? activeIndex : 0;
    }

    for (const day of this.days) {
      const persisted = this.persistedSelections.get(this.normalizeDate(day.date));
      if (!persisted) continue;
      day.booth = this.toMapBooth(persisted);
    }
  }

  private toMapBooth(stall: VendorSelectedStall): MarketMapBooth | null {
    const layoutBooth = DEFAULT_MARKET_MAP_DATA.booths.find(
      (booth) => booth.code.toUpperCase() === stall.stallNo.toUpperCase(),
    );
    if (!layoutBooth) return null;

    return {
      ...layoutBooth,
      zone: stall.zoneName || layoutBooth.zone,
      size: `${stall.width ?? 3}m × ${stall.length ?? 3}m`,
      status: 'mine',
      brand: undefined,
    };
  }

  private isAvailableStall(stall: VendorStallMapItem): boolean {
    if (stall.selectedApplicationId != null) return false;
    const status = stall.status.trim().toUpperCase();
    return status === 'AVAILABLE' || status === '可選擇' || status === '可選';
  }

  private parseApplyDates(value: string): string[] {
    return value
      .split(',')
      .map((date) => date.trim())
      .filter(Boolean);
  }

  private sameDates(left: string[], right: string[]): boolean {
    return left.length === right.length
      && left.every((date, index) => this.normalizeDate(date) === this.normalizeDate(right[index]));
  }

  private handleMapLoadFailure(message = '', initialize = false): void {
    if (initialize) this.isLoading = false;
    void this.alert.error('攤位地圖載入失敗', message || '無法取得最新攤位狀態，請稍後再試。');
  }

  private extractRegistrationDates(value: string | null | undefined): string[] {
    return this.uniqueDates(value?.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g) ?? []);
  }

  private uniqueDates(dates: string[]): string[] {
    return [...new Set(
      dates
        .map((date) => date.trim())
        .filter(Boolean)
        .map((date) => this.normalizeDate(date)),
    )];
  }

  private formatRegistrationPeriods(value: string | null | undefined): string {
    if (!value?.trim()) return '';

    return value.trim().replace(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g,
      (_, year, month, day) =>
        `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
    );
  }

  private formatApplicationDates(dates: string[]): string {
    return dates.map((date) => date.replaceAll('-', '/')).join('、');
  }

  private normalizeDate(date: string): string {
    return date.replaceAll('/', '-');
  }

  private handleActivityLoadFailure(message = ''): void {
    this.isLoading = false;
    void this.alert.error('活動資訊載入失敗', message || '無法取得活動資訊，請稍後再試。');
  }

  /** 攤位被搶先選走時導向重選流程，其他業務錯誤則顯示後端訊息。 */
  private handleSelectionFailure(message: string): void {
    const isStallConflict = message.includes('已被選走') || message.includes('不可選擇');
    if (isStallConflict) {
      this.dialog = 'conflict';
      return;
    }

    this.dialog = null;
    void this.alert.error('攤位選擇失敗', message || '請稍後再試。');
  }
}
