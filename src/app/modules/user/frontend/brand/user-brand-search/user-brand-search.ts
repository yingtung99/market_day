import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AlertService } from '../../../../../core/services/alert.service';
import { BrandItem } from '../../../../../models/interface/shared/BrandItem';
import {
  UserBrandSearchParams,
  UserBrandSummaryApi,
} from '../../../../../models/interface/user/UserPublicApi';
import { BrandType } from '../../../../../models/type/BrandType ';
import { Dropdown } from '../../../../shared/dropdown/dropdown';
import { Pagination } from '../../../../shared/pagination/pagination';
import { UserBrandApiService } from '../../../services/user-brand-api.service';
import { UserBrandSearchCard } from '../user-brand-search-card/user-brand-search-card';

const fallbackBrandImage = (fileName: string): string =>
  `assets/images/user/brand/brands/brand-01/${fileName}`;

const mapBrandSummary = (brand: UserBrandSummaryApi): BrandItem => {
  const category = brand.category?.name ?? '';
  const representativeProducts = (brand.representativeProducts ?? [])
    .map((product) => product.productName)
    .filter(Boolean);

  return {
    id: String(brand.brandId),
    name: brand.brandName,
    description: brand.brandSummary ?? '',
    introduction: brand.brandSummary ?? '',
    tags: category ? [category] : [],
    historyMarkets: [],
    image: brand.mainImageUrl ?? fallbackBrandImage('cover.png'),
    logo: brand.avatarImageUrl ?? fallbackBrandImage('logo.png'),
    goodat_works: representativeProducts.join('、'),
    products: [],
    links: { instagram: '', facebook: '', officialWebsite: '' },
  };
};

@Component({
  selector: 'app-user-brandserch',
  imports: [UserBrandSearchCard, Dropdown, Pagination],
  templateUrl: './user-brand-search.html',
  styleUrl: './user-brand-search.scss',
})
export class UserBrandSearch {
  private readonly destroyRef = inject(DestroyRef);

  brandTypeOptions = BrandType.filterList;
  currentPage = 1;
  pageSize = 6;
  keyword = '';
  selectedCategory = '';
  totalItems = 0;
  brands: BrandItem[] = [];
  isLoading = false;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly brandApi: UserBrandApiService,
    private readonly alert: AlertService,
  ) {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.currentPage = Number(params.get('page')) || 1;
        this.keyword = params.get('keyword') ?? '';
        this.selectedCategory = params.get('category') ?? '';
        this.loadBrands();
      });
  }

  get pagedBrands(): BrandItem[] {
    return this.brands;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.currentQueryParams(page),
      queryParamsHandling: 'merge',
    });
  }

  onKeywordInput(event: Event): void {
    this.keyword = (event.target as HTMLInputElement).value;
  }

  onCategorySelected(category: string): void {
    this.selectedCategory = category === '全部類型' ? '' : category;
  }

  search(): void {
    this.currentPage = 1;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.currentQueryParams(1),
    });
  }

  goToBrandDetail(brand: BrandItem): void {
    void this.router.navigate(['/user/brand-detail'], {
      queryParams: { brand: brand.id },
      state: { brand },
    });
  }

  private currentQueryParams(page: number): Record<string, string | number | null> {
    return {
      page,
      keyword: this.keyword || null,
      category: this.selectedCategory || null,
    };
  }

  private loadBrands(): void {
    const params: UserBrandSearchParams = {
      keyword: this.keyword,
      categoryName: this.selectedCategory,
      page: this.currentPage,
      pageSize: this.pageSize,
    };

    this.isLoading = true;
    this.brandApi.searchBrands(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (res) => {
          this.isLoading = false;
          if (res.statusCode !== 200 || !res.data) {
            this.clearBrands();
            await this.alert.error('取得品牌列表失敗', res.message || '請稍後再試');
            return;
          }

          this.brands = res.data.brands.items.map(mapBrandSummary);
          this.totalItems = res.data.brands.totalItems ?? res.data.totalCount;
        },
        error: async (error) => {
          this.isLoading = false;
          this.clearBrands();
          await this.alert.error(
            '取得品牌列表失敗',
            error.error?.message || '請確認網路連線後再試'
          );
        },
      });
  }

  private clearBrands(): void {
    this.brands = [];
    this.totalItems = 0;
  }
}
