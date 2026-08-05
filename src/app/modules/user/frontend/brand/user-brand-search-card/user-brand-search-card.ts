import { Component, Input, Output, EventEmitter } from '@angular/core';
import { BrandItem } from '../../../../../models/interface/shared/BrandItem';

@Component({
  selector: 'app-user-brandserch-card',
  imports: [],
  templateUrl: './user-brand-search-card.html',
  styleUrl: './user-brand-search-card.scss',
})
/** 品牌探索卡片，顯示品牌封面、Logo、類型與代表作品摘要。 */
export class UserBrandSearchCard {
  /** 單一品牌資料。 */
  @Input({ required: true }) brand!: BrandItem;
  /** 通知父層使用者點擊了品牌卡片。 */
  @Output() cardClick = new EventEmitter<BrandItem>();

  /** 取前三個商品名稱作為卡片上的代表作品摘要。 */
  get representativeProducts(): string {
    const productNames = this.brand.products.map((product) => product.name).filter(Boolean);
    return productNames.length > 0 ? productNames.join('、') : this.brand.goodat_works;
  }

  /** 點擊卡片後回傳品牌資料給父層導頁。 */
  onCardClick(): void {
    this.cardClick.emit(this.brand);
  }
}
