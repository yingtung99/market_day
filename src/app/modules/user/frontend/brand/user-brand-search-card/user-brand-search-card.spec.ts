import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandItem } from '../../../../../models/interface/shared/BrandItem';
import { UserBrandSearchCard } from './user-brand-search-card';

const brand: BrandItem = {
  id: '1',
  name: '測試品牌',
  description: '品牌摘要',
  introduction: '品牌介紹',
  tags: ['手作設計'],
  historyMarkets: [],
  image: 'assets/images/user/brand/brands/brand-01/cover.png',
  logo: 'assets/images/user/brand/brands/brand-01/logo.png',
  goodat_works: '測試商品',
  products: [],
  links: { instagram: '', facebook: '', officialWebsite: '' },
};

describe('UserBrandSearchCard', () => {
  let component: UserBrandSearchCard;
  let fixture: ComponentFixture<UserBrandSearchCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserBrandSearchCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserBrandSearchCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('brand', brand);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display representative product names from the brand summary', () => {
    expect(component.representativeProducts).toBe('測試商品');
  });
});
