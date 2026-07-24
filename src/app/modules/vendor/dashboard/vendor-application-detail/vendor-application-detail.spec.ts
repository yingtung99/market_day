import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { AlertService } from '../../../../core/services/alert.service';
import type { VendorApplicationApiDetail } from '../../../../models/interface/vendor/VendorApplicationApiDetail';
import { VendorApplicationDetail } from './vendor-application-detail';

describe('VendorApplicationDetail', () => {
  let component: VendorApplicationDetail;
  let fixture: ComponentFixture<VendorApplicationDetail>;
  let dashboardService: jasmine.SpyObj<VendorDashboardService>;
  let alertService: jasmine.SpyObj<AlertService>;

  beforeEach(async () => {
    // 模擬詳情端點，驗證頁面不再依賴 VENDOR_APPLICATION_RECORDS 假資料。
    dashboardService = jasmine.createSpyObj<VendorDashboardService>('VendorDashboardService', [
      'getVendorApplicationDetail',
      'getVendorStallMap',
      'cancelVendorApplication',
      'requestVendorRefund',
    ]);
    dashboardService.getVendorApplicationDetail.and.returnValue(of({
      statusCode: 200,
      message: '攤主報名詳情取得成功',
      messageDetails: null,
      data: createApiDetail(),
    }));
    dashboardService.getVendorStallMap.and.returnValue(of({
      statusCode: 200,
      message: 'Vendor stall map retrieved successfully',
      messageDetails: null,
      data: {
        application: {
          applicationNo: 'MD202607170025',
          applicationStatus: '報名完成',
          vendorName: '測試品牌',
          currentApplyDate: '2026-07-18',
          applyDates: '2026-07-18',
          applyDateCount: 1,
          selectedStalls: [{
            selectedStallId: 12,
            applyDate: '2026-07-18',
            stallNo: 'A12',
            zoneName: 'A 區',
            width: 3,
            length: 3,
          }],
          alreadyselectdate: ['2026-07-18'],
        },
        event: {
          eventTitle: '夏日手作市集',
          startAt: '2026-07-18T10:00:00',
          endAt: '2026-07-19T18:00:00',
          address: '台北市中正區八德路一段1號',
        },
        stalls: [],
      },
    }));
    dashboardService.cancelVendorApplication.and.returnValue(of({
      statusCode: 200,
      message: '報名取消成功',
      messageDetails: null,
      data: undefined,
    }));
    dashboardService.requestVendorRefund.and.returnValue(of({
      statusCode: 200,
      message: '退款申請送出成功',
      messageDetails: null,
      data: {
        refundId: 9,
        refundNo: 'REF2026071900001',
        applicationId: 25,
        applicationNo: 'MD202607170025',
        paymentId: 7,
        paymentNo: 'PAY2026071900001',
        merchantOrderNo: 'PAY2026071900001',
        providerTradeNo: 'NP123',
        refundAmount: 2800,
        depositAmount: 1000,
        refundMethod: 'NEWEBPAY',
        refundStatus: 'REFUND_REQUESTED',
        reason: '行程異動',
        requestedAt: '2026-07-19T20:00:00',
      },
    }));
    alertService = jasmine.createSpyObj<AlertService>('AlertService', [
      'confirmNotice',
      'requiredReason',
      'confirmReason',
      'success',
      'error',
    ]);
    alertService.confirmNotice.and.resolveTo(true);
    alertService.requiredReason.and.resolveTo('行程異動');
    alertService.confirmReason.and.resolveTo(true);
    alertService.success.and.resolveTo({} as never);
    alertService.error.and.resolveTo({} as never);

    await TestBed.configureTestingModule({
      imports: [VendorApplicationDetail],
      providers: [
        provideRouter([]),
        { provide: VendorDashboardService, useValue: dashboardService },
        { provide: AlertService, useValue: alertService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '25' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorApplicationDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the detail by application id', () => {
    expect(component).toBeTruthy();
    expect(dashboardService.getVendorApplicationDetail).toHaveBeenCalledOnceWith(25);
    expect(dashboardService.getVendorStallMap).toHaveBeenCalledOnceWith('MD202607170025');
    expect(component.currentApplicationNo).toBe('MD202607170025');
  });

  it('should render API application, payment and fee data', () => {
    const textContent: string = fixture.nativeElement.textContent;

    expect(component.currentStatus).toBe('payment');
    expect(textContent).toContain('夏日手作市集');
    expect(textContent).toContain('MD202607170025');
    expect(textContent).toContain('NT$3,800');
    expect(textContent).toContain('桌子');
  });

  it('should map API stall and status-flow data', () => {
    expect(component.boothAssignments).toEqual([
      {
        date: '2026-07-18',
        number: 'A12',
        zone: 'A 區',
        selectedAt: '',
      },
    ]);
    expect(component.statusProgress[0]).toEqual({
      label: '報名日期',
      value: '2026/07/01 10:30',
    });
    expect(component.statusProgress).toEqual([
      { label: '報名日期', value: '2026/07/01 10:30' },
    ]);
    const progressCard: HTMLElement = fixture.nativeElement.querySelector('.progress-card');
    expect(progressCard.querySelectorAll('.progress-step').length).toBe(1);
    expect(progressCard.textContent).not.toContain('尚未完成');
  });

  it('should format registration periods consistently', () => {
    const registrationPeriods = component.detail.applicationRows.find(
      (row) => row.label === '報名場次',
    );

    expect(registrationPeriods?.value).toBe(
      '2026/07/18 10:00 - 18:00、 2026/07/19 09:00 - 17:00',
    );
  });

  it('should display the rental fee returned by the equipment API as unit price', () => {
    expect(component.rentalEquipment[0].price).toBe('NT$150 / 張');
  });

  it('should render one blank row in every resource table without data', () => {
    component.basicEquipment = [];
    component.rentalEquipment = [];
    component.basicPower = [];
    component.extraPower = [];
    fixture.detectChanges();

    const resourceTables = Array.from(
      fixture.nativeElement.querySelectorAll('.resource-card tbody'),
    ) as HTMLTableSectionElement[];

    expect(resourceTables.length).toBe(4);
    resourceTables.forEach((tableBody) => {
      const rows = tableBody.querySelectorAll('tr.resource-empty-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent?.trim()).toBe('');
    });
  });

  it('should display an unpublish request notice without suspending the existing application flow', () => {
    component.marketWorkflowStatus = 'UNPUBLISH_REQUESTED';
    (component as unknown as { marketWorkflowLoaded: boolean }).marketWorkflowLoaded = true;
    fixture.detectChanges();

    const textContent: string = fixture.nativeElement.textContent;
    expect(textContent).toContain('活動目前處於下架申請中');
    expect(textContent).toContain('原有報名流程維持正常');
  });

  it('should tell a paid vendor that an unpublished event will enter the refund process', () => {
    component.marketWorkflowStatus = 'UNPUBLISHED';
    (component as unknown as { marketWorkflowLoaded: boolean }).marketWorkflowLoaded = true;
    fixture.detectChanges();

    const textContent: string = fixture.nativeElement.textContent;
    expect(textContent).toContain('活動已下架');
    expect(textContent).toContain('平台將進行後續退款流程');
  });

  it('should call the cancel API before changing the application status', async () => {
    await component.cancelRegistration();

    expect(dashboardService.cancelVendorApplication).toHaveBeenCalledOnceWith(25);
    expect(component.currentStatus).toBe('cancelled');
    expect(alertService.success).toHaveBeenCalled();
    expect(alertService.error).not.toHaveBeenCalled();
  });

  it('should submit a vendor refund request after the two confirmations', async () => {
    await component.handleAction('requestRefund');

    expect(dashboardService.requestVendorRefund).toHaveBeenCalledOnceWith({
      applicationNo: 'MD202607170025',
      reason: '行程異動',
    });
    expect(alertService.success).toHaveBeenCalled();
    expect(alertService.error).not.toHaveBeenCalled();
  });
});

function createApiDetail(): VendorApplicationApiDetail {
  return {
    application: {
      applicationId: 25,
      applicationNo: 'MD202607170025',
      applicationStatus: '待付款',
    },
    event: {
      eventId: 8,
      eventCoverImageUrl: '/images/events/8.jpg',
      eventTitle: '夏日手作市集',
      eventStatus: '活動預告',
      statusNote: '報名中',
      eventTime: '2026/07/18 - 2026/07/19',
      eventStartAt: '2026-07-18T10:00:00',
      eventEndAt: '2026-07-19T18:00:00',
      locationName: '台北市中正區 華山文創園區',
      address: '台北市中正區八德路一段1號',
    },
    vendor: {
      vendorOwnerName: '王小明',
      vendorPhone: '0912345678',
      vendorEmail: 'vendor@example.com',
      address: '台北市中正區',
    },
    brand: {
      brandName: '測試品牌',
      categoryName: '文創手作',
      brandDescription: '手作商品',
    },
    applicationdetail: {
      registrationPeriods: '2026-07-18 10:00-18:00 - 2026/07/19 9:00至17:00',
      width: 3,
      length: 3,
      stallZone: 'A 區',
      stallCategory: '文創手作',
      vehicleNo: 'ABC-1234',
      applicantNote: null,
      reviewNote: null,
      reviewNoteDetail: null,
    },
    stall: [
      {
        applyDate: '2026/07/18',
        stallNo: 'A12',
        zoneName: 'A 區',
        selectionStatus: '已選擇',
      },
    ],
    fee: {
      paymentStatus: '待付款',
      paymentMethod: null,
      paymentNo: null,
      providerTradeNo: null,
      paidAt: null,
      paymentAmount: 3800,
    },
    refund: {
      refundStatus: null,
      refundStatusText: null,
      refundMethod: null,
      refundNo: null,
      refundAmount: null,
      refundedAt: null,
    },
    feedetail: [
      { item: '報名費', content: '1 天', amount: 650 },
      { item: '設備租借費', content: '桌子 × 1', amount: 150 },
      { item: '額外電費', content: '110V', amount: 2000 },
      { item: '保證金', content: '保證金', amount: 1000 },
      { item: '總計', content: null, amount: 3800 },
    ],
    equipmentRentals: {
      freeEquipments: [
        {
          equipmentName: '椅子',
          specification: '塑膠椅',
          quantity: 2,
          unit: '個',
          subtotal: 0,
        },
      ],
      freeBasicPower: [],
      rentalEquipments: [
        {
          equipmentName: '桌子',
          specification: '180 × 60 公分',
          quantity: 1,
          unit: '張',
          unitPrice: 150,
          pricingUnit: 'DAY',
          subtotal: 150,
          total: 150,
        },
      ],
      extraPower: [],
    },
    status: [
      {
        key: 'APPLIED',
        label: '報名日期',
        value: '已報名',
        createdAt: '2026/07/01 10:30',
      },
      {
        key: 'REVIEWED',
        label: '審核時間',
        value: null,
        createdAt: null,
      },
    ],
  };
}
