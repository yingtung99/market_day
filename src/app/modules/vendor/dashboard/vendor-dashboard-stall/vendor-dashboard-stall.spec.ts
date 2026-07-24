import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { AddressApiService } from '../../../../core/services/address-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { VendorAccessService } from '../../../../core/Vendor/dashboardApi/vendor-access.service';
import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { VendorStallInfo } from '../../../../models/interface/vendor/VendorStallInfo';
import { VendorDashboardStall } from './vendor-dashboard-stall';

describe('VendorDashboardStall', () => {
  let component: VendorDashboardStall;
  let fixture: ComponentFixture<VendorDashboardStall>;
  let alert: AlertService;
  let vendorDashboardService: jasmine.SpyObj<VendorDashboardService>;
  let authService: jasmine.SpyObj<AuthService>;
  let addressApiService: jasmine.SpyObj<AddressApiService>;
  let vendorAccess: jasmine.SpyObj<VendorAccessService>;

  const stallInfo: VendorStallInfo = {
    brandName: '小集日工作室',
    contactName: '小集日',
    contactPhone: '0975859025',
    contactEmail: 'littlemarket@gmail.com',
    city: '台中市',
    district: '南屯區',
    address: '公益路二段 537 號',
    instagramUrl: '@littlemarket_day',
    facebookUrl: '@littlemarket',
    websiteUrl: 'https://littlemarket.com',
    avatarImageUrl: 'avatar.png',
    coverImageUrl: 'cover.png',
    brandSummary: '品牌簡介',
    brandDescription: '品牌介紹',
    category: { id: 7, name: '玩具選物', slug: 'toys' },
    products: [
      {
        id: 1,
        productName: '小白狗尿尿',
        productSummary: '可愛造型',
        productPrice: 20,
        productImageUrl: 'product.png',
      },
    ],
  };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['getUser']);
    authService.getUser.and.returnValue({
      name: '登入者姓名',
      email: 'login@example.com',
      role: 'VENDOR',
      status: 'ACTIVE',
      isLogin: true,
    });
    addressApiService = jasmine.createSpyObj<AddressApiService>('AddressApiService', [
      'getAddressCities',
      'getAddressDistricts',
    ]);
    addressApiService.getAddressCities.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: ['台中市'],
    }));
    addressApiService.getAddressDistricts.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: ['南屯區'],
    }));
    vendorAccess = jasmine.createSpyObj<VendorAccessService>('VendorAccessService', ['refresh']);
    vendorAccess.refresh.and.resolveTo(false);
    vendorDashboardService = jasmine.createSpyObj<VendorDashboardService>('VendorDashboardService', [
      'getVendorFirstLogin',
      'getVendorStallInfo',
      'saveVendorStallInfo',
      'uploadVendorImage',
    ]);
    vendorDashboardService.getVendorFirstLogin.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: {
        needsProfile: false,
        guideMessage: null,
        name: '登入者姓名',
        pendingReviewCount: 0,
        pendingPaymentCount: 0,
        pendingStallSelectionCount: 0,
        pendingRefundCount: 0,
        notifications: [],
      },
    }));
    vendorDashboardService.getVendorStallInfo.and.returnValue(of({
      statusCode: 200,
      message: '取得成功',
      messageDetails: null,
      data: stallInfo,
    }));

    await TestBed.configureTestingModule({
      imports: [VendorDashboardStall],
      providers: [
        provideRouter([]),
        { provide: VendorDashboardService, useValue: vendorDashboardService },
        { provide: AuthService, useValue: authService },
        { provide: AddressApiService, useValue: addressApiService },
        { provide: VendorAccessService, useValue: vendorAccess },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorDashboardStall);
    component = fixture.componentInstance;
    alert = TestBed.inject(AlertService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render stall data by binding', () => {
    const textContent: string = fixture.nativeElement.textContent;
    const brandNameInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="text"]');
    const descriptionInput: HTMLTextAreaElement = fixture.nativeElement.querySelector(
      'textarea[name="brandDescription"]',
    );
    const avatarImage: HTMLImageElement = fixture.nativeElement.querySelector('.avatar-image');
    const coverImage: HTMLImageElement = fixture.nativeElement.querySelector('.cover-image');

    expect(textContent).toContain('基本資料');
    expect(brandNameInput.value).toBe(stallInfo.brandName);
    expect(descriptionInput.value).toBe(stallInfo.brandDescription);
    expect(avatarImage.getAttribute('src')).toBe(stallInfo.avatarImageUrl);
    expect(coverImage.getAttribute('src')).toBe(stallInfo.coverImageUrl);
    expect(component.brandInfo.category).toBe(stallInfo.category!.name);
    expect(component.brandInfo.categoryId).toBe(stallInfo.category!.id);
    expect(
      fixture.nativeElement.querySelector('.brand-grid app-dropdown .select-label').textContent,
    ).toContain(stallInfo.category!.name);
    expect(textContent).toContain(component.products[0].name);
    expect(vendorDashboardService.getVendorStallInfo).toHaveBeenCalled();
  });

  it('should block saving and list only missing required fields', async () => {
    component.basicFields.find((field) => field.name === 'brandName')!.value = '';
    component.basicFields.find((field) => field.name === 'instagram')!.value = '';
    component.brandInfo.description = '';
    const warningSpy = spyOn(alert, 'warning').and.resolveTo({} as never);

    await component.saveChanges();

    expect(warningSpy).toHaveBeenCalledWith(
      '必填資料尚未完成',
      '品牌名稱、品牌簡介尚未填寫，請完成後再儲存。',
    );
    expect(component.invalidFields.has('brandName')).toBeTrue();
    expect(component.invalidFields.has('description')).toBeTrue();
    expect(component.invalidFields.has('instagram')).toBeFalse();
    expect(vendorDashboardService.saveVendorStallInfo).not.toHaveBeenCalled();
  });

  it('should load saved stall fields even when profile is still incomplete', () => {
    vendorDashboardService.getVendorFirstLogin.and.returnValue(of({
      statusCode: 0,
      message: 'ok',
      messageDetails: null,
      data: {
        needsProfile: true,
        guideMessage: '請先完成攤位資料',
        name: null,
        pendingReviewCount: 0,
        pendingPaymentCount: 0,
        pendingStallSelectionCount: 0,
        pendingRefundCount: 0,
        notifications: [],
      },
    }));
    const errorSpy = spyOn(alert, 'error');

    component.ngOnInit();

    expect(component.basicFields.find((field) => field.name === 'brandName')?.value)
      .toBe(stallInfo.brandName);
    expect(vendorDashboardService.getVendorStallInfo).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should open the product modal and append the saved product', async () => {
    const newProduct = {
      name: '新商品',
      description: '商品介紹',
      price: 180,
      image: 'blob:new-product',
    };
    await component.openAddProduct();
    expect(component.isProductModalOpen).toBeTrue();

    component.handleProductSave(newProduct);

    expect(component.products.at(-1)).toEqual(newProduct);
    expect(component.isProductModalOpen).toBeFalse();
  });

  it('should omit non-positive product ids from the save request', () => {
    component.products = [
      { id: 0, name: '新增商品', description: '新品說明', price: 45, image: 'new.png' },
      { id: 88, name: '既有商品', description: '既有說明', price: 80, image: 'old.png' },
    ];

    const request = (component as any).createSaveRequest();

    expect(request.products[0].id).toBeUndefined();
    expect(request.products[1].id).toBe(88);
  });

  it('should never send data URL previews through the stall JSON API', () => {
    component.avatarPreview = 'data:image/png;base64,avatar-preview';
    component.coverPreview = 'data:image/png;base64,cover-preview';

    const request = (component as any).createSaveRequest();

    expect(request.avatarImageUrl).toBe('avatar.png');
    expect(request.coverImageUrl).toBe('cover.png');
    expect(request.categoryId).toBe(7);
  });

  it('should show warning instead of form when product limit is reached', async () => {
    component.products = [
      ...component.products,
      {
        name: '第三個商品',
        description: '商品介紹',
        price: 100,
        image: 'third-product.png',
      },
      {
        name: '第四個商品',
        description: '商品介紹',
        price: 120,
        image: 'fourth-product.png',
      },
    ];
    const warningSpy = spyOn(alert, 'warning').and.resolveTo({} as never);

    await component.openAddProduct();

    expect(warningSpy).toHaveBeenCalled();
    expect(component.isProductModalOpen).toBeFalse();
  });

  it('should update the selected product returned from the product modal', async () => {
    const editedProduct = {
      ...component.products[0],
      name: '編輯後商品',
      price: 320,
    };
    component.openEditProduct(0);
    expect(component.editingProduct).toEqual(component.products[0]);

    component.handleProductSave(editedProduct);

    expect(component.products[0]).toEqual(editedProduct);
  });

  it('should delete the selected product after confirmation', async () => {
    const deletedProduct = component.products[0];
    spyOn(alert, 'confirm').and.resolveTo(true);

    await component.deleteProduct(0);

    expect(component.products).not.toContain(deletedProduct);
  });

  it('should keep the product when deletion is cancelled', async () => {
    const originalProducts = [...component.products];
    spyOn(alert, 'confirm').and.resolveTo(false);

    await component.deleteProduct(0);

    expect(component.products).toEqual(originalProducts);
  });
});
