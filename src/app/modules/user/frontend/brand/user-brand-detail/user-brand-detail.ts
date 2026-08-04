import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BrandItem } from '../../../../../models/interface/shared/BrandItem';
import { UserBrandDetailApi } from '../../../../../models/interface/user/UserPublicApi';
import { AlertService } from '../../../../../core/services/alert.service';
import { UserBrandApiService } from '../../../services/user-brand-api.service';

const fallbackBrandImage = (brandId: string, fileName: string): string =>
  `assets/images/user/brand/brands/${brandId}/${fileName}`;

const formatMarketDate = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  return value.slice(5, 10).replace('-', '/');
};

const formatMarketYear = (value: string | null | undefined): string =>
  value ? value.slice(0, 4) : '';

const mapBrandDetail = (brand: UserBrandDetailApi): BrandItem => ({
  id: String(brand.brandId),
  name: brand.brandName,
  description: brand.brandSummary ?? '',
  introduction: brand.brandDescription ?? brand.brandSummary ?? '',
  tags: brand.category?.name ? [brand.category.name] : [],
  historyMarkets: (brand.participatedMarkets ?? []).map((market) => ({
    name: market.eventTitle,
    year: formatMarketYear(market.eventStartAt),
    startDate: formatMarketDate(market.eventStartAt),
    endDate: formatMarketDate(market.eventEndAt),
  })),
  image: brand.mainImageUrl ?? fallbackBrandImage('brand-01', 'cover.png'),
  logo: brand.avatarImageUrl ?? fallbackBrandImage('brand-01', 'logo.png'),
  goodat_works: (brand.representativeProducts ?? [])
    .map((product) => product.productName)
    .filter(Boolean)
    .join('、'),
  products: (brand.representativeProducts ?? []).map((product) => ({
    image: product.productImageUrl ?? fallbackBrandImage('brand-01', 'product-01.png'),
    name: product.productName,
    price: product.productPrice ?? 0,
    description: product.productShortDescription ?? '',
  })),
  links: {
    instagram: brand.links?.instagramUrl ?? '',
    facebook: brand.links?.facebookUrl ?? '',
    officialWebsite: brand.links?.websiteUrl ?? '',
  },
});

@Component({
  selector: 'app-user-brand-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './user-brand-detail.html',
  styleUrl: './user-brand-detail.scss',
})
/** 品牌詳情頁，依 query param 或導頁 state 還原品牌資料。 */
export class UserBrandDetail {
  /** 目前顯示的品牌資料；沒有指定品牌時顯示第一筆預設資料。 */
  brand: BrandItem | null = null;

  /** 優先使用導頁 state，其次用 query param，最後回到預設品牌。 */
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private readonly brandApi: UserBrandApiService,
    private readonly alert: AlertService,
  ) {
    const navigation = this.router.currentNavigation();
    const stateBrand =
      navigation?.extras.state?.['brand'] ??
      (history.state?.brand as BrandItem | undefined);
    const brandId = this.route.snapshot.queryParamMap.get('brand') ?? stateBrand?.id;

    this.brand = stateBrand ?? null;

    const numericBrandId = Number(brandId);
    if (Number.isInteger(numericBrandId) && numericBrandId > 0) {
      this.loadBrandDetail(brandId);
    } else if (brandId != null) {
      void this.alert.error('品牌詳情載入失敗', '品牌 ID 不正確，請返回品牌列表後重新選擇。');
    }
  }

  private loadBrandDetail(brandId: string): void {
    this.brandApi.getBrandDetail(brandId).subscribe({
      next: async (res) => {
        if (res.statusCode !== 200 || !res.data) {
          await this.alert.error('取得品牌詳情失敗', res.message || '請稍後再試');
          return;
        }

        this.brand = mapBrandDetail(res.data);
      },
      error: async (error) => {
        await this.alert.error(
          '取得品牌詳情失敗',
          error.error?.message || '請確認網路連線後再試'
        );
      },
    });
  }

  /** 品牌曾參與過的市集紀錄。 */
  get marketRecords() {
    return this.brand?.historyMarkets ?? [];
  }

  /** 從社群網址取出帳號名稱，讓畫面顯示更簡潔。 */
  getSocialAccount(url: string): string {
    try {
      const account = new URL(url).pathname.split('/').filter(Boolean)[0];
      return account ? `@${account}` : '@marketday.brand';
    } catch {
      return '@marketday.brand';
    }
  }

  /** 從官網網址取出網域名稱。 */
  getWebsiteHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'brand.marketday.tw';
    }
  }
}
