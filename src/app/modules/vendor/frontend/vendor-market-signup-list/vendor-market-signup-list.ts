import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VendorService } from '../../../../core/Vendor/vendorApi/vendor.service';
import { EventSearch } from '../../../../models/interface/shared/EventSearch';
import {
  MarketRegistrationStatus,
  VendorMarketSearchItem,
} from '../../../../models/interface/vendor/VendorMarketSearch';
import { Pagination } from '../../../shared/pagination/pagination';
import { UserFooter } from '../../../user/frontend/shared/user-footer/user-footer';
import { VendorHeader } from '../vendor-header/vendor-header';
import { VendorMarketCard } from '../vendor-market-card/vendor-market-card';
// import { BrandType } from '../../../../models/type/BrandType ';
import { MarketStatus } from '../../../../models/status/MarketStatus';
import { MarketCardItem } from '../../../../models/interface/shared/MarketCardItem';
// import { UserMarketSearchPanel } from '../../../user/frontend/shared/user-market-search-panel/user-market-search-panel';
import { VendorMarketSearchPanel } from '../vendor-market-search-panel/vendor-market-search-panel';

@Component({
  selector: 'app-vendor-market-signup-list',
  imports: [VendorHeader, UserFooter, VendorMarketCard,  Pagination, VendorMarketSearchPanel],
  templateUrl: './vendor-market-signup-list.html',
  styleUrl: './vendor-market-signup-list.scss',
})
export class VendorMarketSignupList implements OnInit {
  /**目前頁面 */
  currentPage = 1;
  /** 預設每頁6筆資料 */
  readonly pageSize = 6;
  /** 總筆數 */
  totalItems = 0;
  /** 是否載入中 */
  isLoading = false;
  /** 載入失敗 */
  loadError = '';
  markets: MarketCardItem[] = [];

  /** 保留目前搜尋條件，換頁時會使用相同條件重新查詢後端。 */
  private searchCriteria: EventSearch = {};

  constructor(
    private readonly router: Router,
    private readonly vendorService: VendorService,
  ) {}

  ngOnInit(): void {
    this.loadMarkets();
    
  }

  /** 接收分頁元件的新頁碼，並向後端取得該頁資料。 */
  setPage(page: number): void {
    if (page < 1 || page === this.currentPage) return;
    this.currentPage = page;
    this.loadMarkets();
    
  }

  /** 接收搜尋面板已整理完成的 API 查詢條件。 */
  onSearch(criteria: EventSearch): void {
    this.searchCriteria = criteria;
    this.currentPage = 1;
    this.loadMarkets();
  }

  /** 依目前搜尋條件與頁碼，取得後端已發布的市集活動。 */
  private loadMarkets(): void {
    this.isLoading = true;
    this.loadError = '';

    this.vendorService
      .searchMarkets({
        ...this.searchCriteria,
        page: this.currentPage,
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (response) => {
          const marketPage = response.data.markets;
          const availableMarkets = marketPage.items.filter(
            (item) => !this.isRegistrationClosed(item),
          );
          const closedMarketCount = marketPage.items.length - availableMarkets.length;

          this.markets = availableMarkets.map((item) => this.toMarketCard(item));
          this.totalItems = Math.max(0, marketPage.totalItems - closedMarketCount);
          this.isLoading = false;
        },
        error: () => {
          this.markets = [];
          this.totalItems = 0;
          this.loadError = '活動列表載入失敗，請稍後再試。';
          this.isLoading = false;
        },
      });
  }

  /** 報名截止時間已到的活動不應出現在可報名市集列表。 */
  private isRegistrationClosed(item: VendorMarketSearchItem): boolean {
    if (!item.registrationEndAt) return false;

    const registrationEndAt = new Date(item.registrationEndAt);
    if (Number.isNaN(registrationEndAt.getTime())) return false;

    return registrationEndAt.getTime() <= Date.now();
  }

  /** 將搜尋 API DTO 轉成共用的市集卡片模型。 */
  private toMarketCard(item: VendorMarketSearchItem): MarketCardItem {
    /** 開始日期 原 >> yyyy-MM-dd hh:mm */
    const startAt = new Date(item.startAt);
    /** 結束日期 原 >> yyyy-MM-dd hh:mm */
    const endAt = new Date(item.endAt);
    const status = this.toMarketStatus(item.registrationStatus);
    const categoryNames = (item.categories ?? [])
      .map((category) => category.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (categoryNames.length === 0 && item.categoryName?.trim()) {
      categoryNames.push(item.categoryName.trim());
    }

    return {
      id: String(item.eventId),
      title: item.eventTitle,
      time: `${this.formatTime(startAt)} - ${this.formatTime(endAt)}`,
      start_date: this.formatDate(startAt),
      end_date: this.formatDate(endAt),
      description: item.summary,
      location: item.locationName,
      address: item.address,
      city: item.city,
      area: item.district,
      image: item.imageUrl || 'assets/images/market/cards/market-card-01.png',
      status,
      statusClass: MarketStatus.getClass(status),
      tags: categoryNames,
      category: categoryNames.join('、'),
      organizer: item.organizerName ?? '',
      transportation: [item.trafficTitle, item.trafficDetail].filter(
        (value): value is string => Boolean(value),
      ),
      price: item.baseFee,
      maxBooths: item.maxBooths,
      registrationStartAt: item.registrationStartAt ?? undefined,
      registrationEndAt: item.registrationEndAt ?? undefined,
      trafficTitle: item.trafficTitle ?? '',
      trafficDetail: item.trafficDetail ?? '',
      slots: [],
    };
  }

  /** 將後端狀態轉成卡片元件使用的中文狀態。 */
  private toMarketStatus(status: MarketRegistrationStatus): string {
    const statusMap: Record<MarketRegistrationStatus, string> = {
      OPEN: MarketStatus.registrationOpen,
      FULL: MarketStatus.full,
    };
    return statusMap[status];
  }

  /**
   * 處理日期格式
   * @param value 開始日期 or 結束日期
   * @returns yyyy/MM/dd
   */
  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * 處理時間格式
   * @param value 開始日期 or 結束日期
   * @returns hh:mm
   */
  private formatTime(value: Date): string {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** 只帶活動 ID 前往詳細頁，詳細頁會重新向後端取得最新資料。 */
  goToSignUpDetail(market: MarketCardItem): void {
    if (!market.id) return;
    this.router.navigate(['/vendor/sign-up-detail', market.id]);
  }
}
