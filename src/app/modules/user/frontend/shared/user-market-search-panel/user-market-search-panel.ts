import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AddressApiService } from '../../../../../core/services/address-api.service';
import { CategoryItem } from '../../../../../models/interface/user/CategoryItem';
import { isApiSuccessStatus } from '../../../../../models/interface/shared/ApiResult';
import { Dropdown } from '../../../../shared/dropdown/dropdown';
import { DateRangeSelector } from '../../../../shared/date-range-selector/date-range-selector';
import { BrandType } from '../../../../../models/type/BrandType ';
import { MarketStatus } from '../../../../../models/status/MarketStatus';

export interface UserMarketSearchParams {
  /** 活動名稱或關鍵字。 */
  keyword: string;
  /** 選取的縣市。 */
  city: string;
  /** 選取的活動狀態。 */
  status: string;
  /** 活動日期區間開始日。 */
  startDate: string;
  /** 活動日期區間結束日。 */
  endDate: string;
  /** 選取的活動類型。 */
  category: string;
}

@Component({
  selector: 'app-user-market-search-panel',
  imports: [Dropdown, DateRangeSelector],
  templateUrl: './user-market-search-panel.html',
  styleUrl: './user-market-search-panel.scss',
})
/** 一般使用者市集活動搜尋區塊，負責蒐集篩選條件並同步到 query params。 */
export class UserMarketSearchPanel implements OnInit {
  @ViewChild('cityDropdown') private cityDropdown?: Dropdown;
  @ViewChild('statusDropdown') private statusDropdown?: Dropdown;
  @ViewChild('dateRangeSelector') private dateRangeSelector?: DateRangeSelector;

  /** 搜尋送出後前往的頁面，讓前台不同入口共用同一套搜尋面板。 */
  @Input() searchRoute = '/user/activity-list';

  /** 是否顯示分類快捷標籤。 */
  @Input() showCategories = true;

  /** 日期區間元件的標題。 */
  @Input() dateRangeTitle = '';

  /** 目前輸入的活動名稱關鍵字。 */
  @Input() keyword = '';

  /** 目前選擇的縣市。 */
  @Input() selectedCity = '';

  /** 目前選擇的活動狀態。 */
  @Input() selectedStatus = '';

  /** 目前選擇的活動類型。 */
  @Input() selectedCategory = '';

  /** 目前選擇的開始日期。 */
  @Input() startDate = '';

  /** 目前選擇的結束日期。 */
  @Input() endDate = '';

  /** 使用者按下搜尋後，將篩選條件回傳父層。 */
  @Output() searchSubmit = new EventEmitter<UserMarketSearchParams>();

  /** 後端地址 API 回傳的台灣縣市選項。 */
  cityOptions: string[] = [];

  isCityLoading = false;
  cityLoadFailed = false;

  /** 前台活動狀態篩選選項。 */
  readonly statusOptions = MarketStatus.filterList;

  /** 活動類型快速篩選選項。 */
  readonly categories: CategoryItem[] = [
    { name: BrandType.food, icon: 'bi bi-shop-window' },
    { name: BrandType.handmade, icon: 'bi bi-fork-knife' },
    { name: BrandType.family, icon: 'bi bi-people' },
    { name: BrandType.pet, icon: 'bi bi-house-heart' },
    { name: BrandType.plant, icon: 'bi bi-flower1' },
    { name: BrandType.fashion, icon: 'bi bi-person-standing-dress' },
    { name: BrandType.toy, icon: 'bi bi-gift' },
  ];

  constructor(
    private readonly router: Router,
    private readonly addressApiService: AddressApiService,
  ) {}

  ngOnInit(): void {
    this.loadCityOptions();
  }

  get cityPlaceholder(): string {
    if (this.isCityLoading) return '縣市載入中...';
    if (this.cityLoadFailed) return '縣市載入失敗';
    return '選擇縣市';
  }

  private loadCityOptions(): void {
    this.isCityLoading = true;
    this.cityLoadFailed = false;

    this.addressApiService.getAddressCities().subscribe({
      next: (response) => {
        this.isCityLoading = false;
        if (!isApiSuccessStatus(response.statusCode) || !response.data) {
          this.cityLoadFailed = true;
          return;
        }

        this.cityOptions = response.data;
      },
      error: () => {
        this.isCityLoading = false;
        this.cityLoadFailed = true;
      },
    });
  }

  /** 選取活動類型。 */
  selectCategory(index: number): void {
    const category = this.categories[index]?.name ?? '';
    this.selectedCategory = this.selectedCategory === category ? '' : category;
  }

  /** 選取縣市。 */
  selectCity(city: string): void {
    this.selectedCity = city;
  }

  /** 選取狀態；全部狀態以空字串表示，方便 query params 清除條件。 */
  selectStatus(status: string): void {
    this.selectedStatus = status === '全部狀態' ? '' : status;
  }

  /** 同步關鍵字輸入值。 */
  onKeywordInput(event: Event): void {
    this.keyword = (event.target as HTMLInputElement).value;
  }

  /** 同步日期區間選擇值。 */
  onDateRangeChange(range: { startDate: string | null; endDate: string | null }): void {
    this.startDate = range.startDate ?? '';
    this.endDate = range.endDate ?? '';
  }

  /** 送出搜尋條件並更新網址，之後串 API 時可在父層或 service 使用這份條件查詢。 */
  search(): void {
    const params = this.getSearchParams();
    this.searchSubmit.emit(params);

    void this.router.navigate([this.searchRoute], {
      queryParams: this.toQueryParams(params),
    });
  }

  /** 清空所有條件並在同一路由重新查詢完整列表，不觸發整頁 reload。 */
  clearFilters(): void {
    this.keyword = '';
    this.selectedCity = '';
    this.selectedStatus = '';
    this.selectedCategory = '';
    this.startDate = '';
    this.endDate = '';
    this.cityDropdown?.reset();
    this.statusDropdown?.reset();
    this.dateRangeSelector?.reset();
    this.searchSubmit.emit(this.getSearchParams());
    void this.router.navigate([this.searchRoute], {
      queryParams: this.toQueryParams(this.getSearchParams()),
    });
  }

  /** 組合目前 UI 上的搜尋條件。 */
  private getSearchParams(): UserMarketSearchParams {
    return {
      keyword: this.keyword.trim(),
      city: this.selectedCity,
      status: this.selectedStatus,
      startDate: this.startDate,
      endDate: this.endDate,
      category: this.selectedCategory,
    };
  }

  /** 將空值轉成 null，避免網址保留無意義的 query params。 */
  private toQueryParams(params: UserMarketSearchParams): Record<string, string | null> {
    return {
      keyword: params.keyword || null,
      city: params.city || null,
      status: params.status || null,
      startDate: params.startDate || null,
      endDate: params.endDate || null,
      category: params.category || null,
      page: '1',
    };
  }
}
