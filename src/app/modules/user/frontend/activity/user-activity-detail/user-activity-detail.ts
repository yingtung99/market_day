import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MarketCardItem } from '../../../../../models/interface/shared/MarketCardItem';
import { MarketMapBrand, MarketMapData } from '../../../../../models/interface/shared/MarketMap';
import { TrafficItem } from '../../../../../models/interface/user/TrafficItem';
import {
  UserEventStallStatusApi,
  UserMarketDetailApi,
  UserMarketStallBrandApi,
} from '../../../../../models/interface/user/UserPublicApi';
import { MarketStatus } from '../../../../../models/status/MarketStatus';
import { Dropdown } from '../../../../shared/dropdown/dropdown';
import { DEFAULT_MARKET_MAP_DATA, MarketMap } from '../../../../shared/market-map/market-map';
import { UserMarketApiService } from '../../../services/user-market-api.service';

const DAY_MS = 1000 * 60 * 60 * 24;

@Component({
  selector: 'app-user-activity-detail',
  imports: [CommonModule, RouterLink, MarketMap, Dropdown],
  templateUrl: './user-activity-detail.html',
  styleUrl: './user-activity-detail.scss',
})
export class UserActivityDetail {
  @ViewChild('marketMap') private marketMapComponent?: MarketMap;

  private readonly destroyRef = inject(DestroyRef);
  private readonly marketApi = inject(UserMarketApiService);
  private marketId: string | number | null = null;
  private latestDetail: UserMarketDetailApi | null = null;
  private marketMapsByDate: Record<string, MarketMapData> = {};

  market: MarketCardItem | null = null;
  activityDateOptions: string[] = [];
  selectedActivityDate = '';
  selectedPublicStallNo = '';
  selectedMarketMap: MarketMapData = this.createMapForDate('');

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    const nav = this.router.currentNavigation();
    const stateMarket = (nav?.extras.state?.['market'] ?? history.state?.['market']) as MarketCardItem | undefined;
    const routeId = this.route.snapshot.paramMap.get('id')
      ?? this.route.snapshot.queryParamMap.get('id')
      ?? this.route.snapshot.queryParamMap.get('marketId')
      ?? stateMarket?.id
      ?? null;

    this.marketId = routeId;

    if (stateMarket) {
      this.market = stateMarket;
      this.initializeActivityMaps();
    }

    if (this.marketId !== null && this.marketId !== undefined && this.marketId !== '') {
      this.loadMarketDetail(this.marketId);
    }
  }

  get trafficItems(): TrafficItem[] {
    const transportation = this.market?.transportation ?? [];
    const defaults = [
      '尚未提供捷運資訊。',
      '尚未提供公車資訊。',
      '尚未提供自行開車資訊。',
    ];
    const labels = ['捷運', '公車', '開車'];

    return labels.map((label, index) => ({
      icon: ['bi bi-train-front', 'bi bi-bus-front', 'bi bi-car-front-fill'][index],
      label,
      text: transportation[index] || defaults[index],
    }));
  }

  get showBoothInfo(): boolean {
    return this.latestDetail?.brandsPublic === true
      && this.market?.status !== MarketStatus.preview;
  }

  get showAnnouncement(): boolean {
    return !this.showBoothInfo;
  }

  get activityIntroExtra(): string {
    return this.latestDetail?.brandsPublic === false
      ? '主辦方尚未公開品牌與攤位資訊。'
      : '可點擊攤位查看已公開的品牌資訊。';
  }

  get organizerName(): string {
    return this.market?.organizer ?? '小集日主辦方';
  }

  get organizerEmail(): string {
    return this.latestDetail?.organizer?.contactEmail ?? 'service@marketday.tw';
  }

  get organizerPhone(): string {
    return this.latestDetail?.organizer?.contactPhone ?? '-';
  }

  get organizerServiceTime(): string {
    const organizer = this.latestDetail?.organizer;
    const days = organizer?.serviceDays ?? '-';
    const start = organizer?.serviceStartTime ?? '';
    const end = organizer?.serviceEndTime ?? '';
    const time = [start, end].filter(Boolean).join(' - ');
    return time ? `${days} ${time}` : days;
  }

  get breadcrumbSectionLabel(): string {
    return this.market?.status === MarketStatus.ended ? '歷史活動' : '市集活動';
  }

  get breadcrumbSectionLink(): string {
    return this.market?.status === MarketStatus.ended
      ? '/user/activity-list/history'
      : '/user/activity-list';
  }

  openMarketInfo(): boolean {
    return !this.showBoothInfo;
  }

  selectActivityDate(date: string): void {
    if (!date || date === this.selectedActivityDate) {
      return;
    }

    this.selectedActivityDate = date;
    this.selectedPublicStallNo = '';
    this.selectedMarketMap = this.ensureMapForDate(date);
    this.marketMapComponent?.resetPublicMapState();

    if (this.marketId === null) {
      return;
    }

    this.loadDailyStallLayout(this.marketId, date);
  }

  onMapBoothSelected(stallNo: string): void {
    if (!stallNo || !this.selectedActivityDate || this.marketId === null) {
      return;
    }

    const selectedBooth = this.selectedMarketMap.booths.find((booth) => booth.code === stallNo);
    if (!selectedBooth || selectedBooth.status !== 'occupied') {
      return;
    }

    this.selectedPublicStallNo = stallNo;

    this.marketApi.getMarketDetailByStall(
      this.marketId,
      this.toApiDate(this.selectedActivityDate),
      stallNo,
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.statusCode !== 200 || !res.data) {
          return;
        }

        this.applySelectedStallBrand(stallNo, res.data.selectedStall?.brand ?? null, true);
      },
    });
  }

  countMarketDays(startDate: string): number {
    if (!startDate) {
      return 0;
    }

    const today = this.todayStart();
    const start = this.parseDate(startDate);
    return Math.max(0, Math.ceil((start.getTime() - today.getTime()) / DAY_MS));
  }

  marketDaysText(startDate: string, endDate = this.market?.end_date ?? ''): string {
    if (!startDate) {
      return '';
    }

    const today = this.todayStart();
    const start = this.parseDate(startDate);
    const end = endDate ? this.parseDate(endDate) : start;

    if (today > end) {
      return '已結束';
    }

    if (today >= start && today <= end) {
      return '進行中';
    }

    return '即將開始';
  }

  private loadMarketDetail(
    id: string | number,
  ): void {
    this.marketApi.getMarketDetail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.statusCode !== 200 || !res.data) {
            return;
          }

          const detail = res.data;
          this.latestDetail = detail;

          this.market = this.mapMarketDetail(detail);
          this.initializeActivityMaps(this.toDisplayDate(detail.selectedDate));
          if (this.selectedActivityDate) {
            this.loadDailyStallLayout(id, this.selectedActivityDate);
          }
        },
      });
  }

  private loadDailyStallLayout(id: string | number, displayDate: string): void {
    this.marketApi.getEventStallsStatus(id, this.toApiDate(displayDate))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.statusCode !== 200 || !res.data || displayDate !== this.selectedActivityDate) {
            return;
          }

          this.applyDailyStallLayout(displayDate, res.data);
        },
      });
  }

  private applyDailyStallLayout(date: string, stalls: UserEventStallStatusApi[]): void {
    const stallsByNo = new Map(
      stalls
        .filter((stall) => Boolean(stall.stallNo))
        .map((stall) => [stall.stallNo!.trim().toUpperCase(), stall]),
    );
    const currentMap = this.ensureMapForDate(date);
    const existingBrands = new Map(
      currentMap.booths
        .filter((booth) => Boolean(booth.brand))
        .map((booth) => [booth.code.trim().toUpperCase(), booth.brand]),
    );
    const nextMap: MarketMapData = {
      ...currentMap,
      booths: DEFAULT_MARKET_MAP_DATA.booths.map((booth) => {
        if (booth.id === 'service-booth') {
          return { ...booth };
        }

        const stall = stallsByNo.get(booth.code.trim().toUpperCase());
        if (!stall) {
          return { ...booth, status: 'available' as const, brand: undefined };
        }

        const occupied = this.isOccupiedStall(stall);

        return {
          ...booth,
          zone: stall.zoneName || booth.zone,
          size: stall.width && stall.length ? `${stall.width}m x ${stall.length}m` : booth.size,
          status: occupied ? 'occupied' : 'available',
          brand: occupied
            ? existingBrands.get(booth.code.trim().toUpperCase())
            : undefined,
        };
      }),
    };

    this.marketMapsByDate[date] = nextMap;
    this.selectedMarketMap = nextMap;
    this.loadDailyStallBrands(date, stalls.filter((stall) => this.isOccupiedStall(stall)));
  }

  private loadDailyStallBrands(date: string, stalls: UserEventStallStatusApi[]): void {
    if (this.marketId === null) return;

    for (const stall of stalls) {
      const stallNo = stall.stallNo?.trim().toUpperCase();
      if (!stallNo) continue;

      this.marketApi.getMarketDetailByStall(this.marketId, this.toApiDate(date), stallNo)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          if (res.statusCode === 200 && res.data && date === this.selectedActivityDate) {
            this.applySelectedStallBrand(stallNo, res.data.selectedStall?.brand ?? null, false);
          }
        });
    }
  }

  private isOccupiedStall(stall: UserEventStallStatusApi): boolean {
    if (stall.vendorName?.trim()) {
      return true;
    }

    const status = stall.status?.trim().toLowerCase() ?? '';
    return status !== '' && !['available', 'open', '可選擇', '空位', '未配置'].includes(status);
  }

  private initializeActivityMaps(preferredDate?: string): void {
    if (!this.market) {
      this.selectedMarketMap = this.createMapForDate('');
      return;
    }

    this.activityDateOptions = this.createActivityDateOptions(this.market.start_date, this.market.end_date);
    this.selectedActivityDate = preferredDate && this.activityDateOptions.includes(preferredDate)
      ? preferredDate
      : this.activityDateOptions[0] ?? this.market.start_date;

    this.marketMapsByDate = this.activityDateOptions.reduce<Record<string, MarketMapData>>((maps, date) => {
      maps[date] = this.createMapForDate(date);
      return maps;
    }, {});

    this.selectedMarketMap = this.ensureMapForDate(this.selectedActivityDate);
  }

  private ensureMapForDate(date: string): MarketMapData {
    if (!this.marketMapsByDate[date]) {
      this.marketMapsByDate[date] = this.createMapForDate(date);
    }

    return this.marketMapsByDate[date];
  }

  private createMapForDate(date: string): MarketMapData {
    return {
      ...DEFAULT_MARKET_MAP_DATA,
      name: this.market?.title ?? DEFAULT_MARKET_MAP_DATA.name,
      booths: DEFAULT_MARKET_MAP_DATA.booths.map((booth) => ({
        ...booth,
        status: booth.id === 'service-booth' ? booth.status : 'available',
        brand: undefined,
      })),
      facilities: [...DEFAULT_MARKET_MAP_DATA.facilities],
    };
  }

  private applySelectedStallBrand(
    stallNo: string,
    brand: UserMarketStallBrandApi | null,
    reveal: boolean,
  ): void {
    const boothIndex = this.selectedMarketMap.booths.findIndex((booth) => booth.code === stallNo);
    if (boothIndex < 0) {
      return;
    }

    const nextBooths = this.selectedMarketMap.booths.map((booth, index) => {
      if (index !== boothIndex) {
        return { ...booth };
      }

      if (!brand) {
        return {
          ...booth,
          brand: undefined,
        };
      }

      return {
        ...booth,
        status: 'occupied' as const,
        brand: this.mapSelectedStallBrand(brand),
      };
    });

    this.selectedMarketMap = {
      ...this.selectedMarketMap,
      booths: nextBooths,
    };
    this.marketMapsByDate[this.selectedActivityDate] = this.selectedMarketMap;

    if (!reveal) return;

    window.setTimeout(() => {
      if (brand) {
        this.marketMapComponent?.showPublicBoothBrand(stallNo);
      } else {
        this.marketMapComponent?.resetPublicMapState();
      }
    }, 0);
  }

  private mapSelectedStallBrand(brand: UserMarketStallBrandApi): MarketMapBrand {
    const links = [
      { type: 'facebook' as const, label: 'Facebook', url: brand.facebookUrl },
      { type: 'instagram' as const, label: 'Instagram', url: brand.instagramUrl },
      { type: 'website' as const, label: '官方網站', url: brand.websiteUrl },
    ].filter((link): link is { type: 'facebook' | 'instagram' | 'website'; label: string; url: string } => Boolean(link.url));

    return {
      id: String(brand.vendorProfileId),
      name: brand.brandName ?? '未命名品牌',
      category: brand.category?.name ?? '',
      summary: brand.brandSummary ?? '',
      logo: brand.avatarImageUrl ?? brand.coverImageUrl ?? '',
      socialLinks: links,
    };
  }

  private mapMarketDetail(detail: UserMarketDetailApi): MarketCardItem {
    const categories = (detail.categories ?? []).map((category) => category.name).filter(Boolean);
    const status = MarketStatus.fromApiStatus(detail.eventStatus) || MarketStatus.upcoming;
    const address = this.formatFullAddress(detail.city, detail.district, detail.address);

    return {
      id: String(detail.id),
      title: detail.title,
      time: [detail.startTime, detail.endTime].filter(Boolean).join(' - '),
      start_date: this.toDisplayDate(detail.startDate),
      end_date: this.toDisplayDate(detail.endDate),
      description: detail.description ?? detail.summary ?? '',
      location: detail.locationName?.trim() ?? '',
      address,
      city: detail.city ?? '',
      area: detail.district ?? '',
      image: detail.coverImageUrl ?? 'assets/images/market/cards/market-card-01.png',
      status,
      statusClass: MarketStatus.getClass(status),
      tags: categories,
      category: categories[0] ?? '',
      organizer: detail.organizer?.organizerName ?? '',
      transportation: (detail.trafficInfos ?? []).map((item) => item.details ?? '').filter(Boolean),
    };
  }

  private formatFullAddress(
    city: string | null | undefined,
    district: string | null | undefined,
    address: string | null | undefined,
  ): string {
    let fullAddress = address?.trim() ?? '';

    if (district?.trim() && !fullAddress.includes(district.trim())) {
      fullAddress = `${district.trim()} ${fullAddress}`.trim();
    }

    if (city?.trim() && !fullAddress.includes(city.trim())) {
      fullAddress = `${city.trim()} ${fullAddress}`.trim();
    }

    return fullAddress;
  }

  private createActivityDateOptions(startDate: string, endDate: string): string[] {
    if (!startDate) {
      return [];
    }

    const start = this.parseDate(startDate);
    const end = endDate ? this.parseDate(endDate) : start;
    const dates: string[] = [];

    for (let date = start; date <= end; date = new Date(date.getTime() + DAY_MS)) {
      dates.push(this.formatDate(date));
    }

    return dates;
  }

  private toDisplayDate(value?: string | null): string {
    return value ? value.replace(/-/g, '/') : '';
  }

  private toApiDate(value: string): string {
    return value.replace(/\//g, '-');
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private parseDate(value: string): Date {
    const normalized = value.replace(/-/g, '/');
    const [year, month, day] = normalized.split('/').map(Number);
    return new Date(year, month - 1, day);
  }

  private todayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
