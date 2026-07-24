import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { NotificationApiService } from '../../../../core/services/notification-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { VendorDashboardHome } from './vendor-dashboard-home';

describe('VendorDashboardHome', () => {
  let component: VendorDashboardHome;
  let fixture: ComponentFixture<VendorDashboardHome>;
  let vendorDashboardService: jasmine.SpyObj<VendorDashboardService>;
  let notificationApi: jasmine.SpyObj<NotificationApiService>;

  beforeEach(async () => {
    vendorDashboardService = jasmine.createSpyObj<VendorDashboardService>(
      'VendorDashboardService',
      ['getVendorFirstLogin', 'searchVendorApplications'],
    );
    notificationApi = jasmine.createSpyObj<NotificationApiService>('NotificationApiService', ['markAsRead']);
    notificationApi.markAsRead.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: { id: 30, isRead: true },
    }));
    vendorDashboardService.getVendorFirstLogin.and.returnValue(of({
      statusCode: 200,
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
    vendorDashboardService.searchVendorApplications.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: {
        totalCount: 0,
        applications: {
          items: [],
          page: 1,
          pageSize: 1,
          totalItems: 0,
          totalPages: 0,
          hasPrevious: false,
          hasNext: false,
        },
      },
    }));

    await TestBed.configureTestingModule({
      imports: [VendorDashboardHome],
      providers: [
        provideRouter([]),
        { provide: VendorDashboardService, useValue: vendorDashboardService },
        { provide: AuthService, useValue: { getUser: () => null } },
        { provide: NotificationApiService, useValue: notificationApi },
        { provide: AlertService, useValue: jasmine.createSpyObj('AlertService', ['error']) },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorDashboardHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show first-login guide when profile setup is required', () => {
    expect(component.hasRecords).toBeFalse();
    expect(component.guideMessage).toBe('請先完成攤位資料');
    expect(vendorDashboardService.getVendorFirstLogin).toHaveBeenCalled();
  });

  it('should bind dashboard counts, vendor name and notifications', () => {
    vendorDashboardService.searchVendorApplications.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: {
        totalCount: 27,
        applications: {
          items: [],
          page: 1,
          pageSize: 1,
          totalItems: 27,
          totalPages: 27,
          hasPrevious: false,
          hasNext: true,
        },
      },
    }));
    vendorDashboardService.getVendorFirstLogin.and.returnValue(of({
      statusCode: 200,
      message: 'ok',
      messageDetails: null,
      data: {
        needsProfile: false,
        guideMessage: null,
        name: '小集日',
        pendingReviewCount: 12,
        pendingPaymentCount: 6,
        pendingStallSelectionCount: 2,
        pendingRefundCount: 4,
        notifications: [{
          id: 30,
          category: 'APPLICATION_REVIEW',
          type: 'APPLICATION_SUBMITTED',
          targetType: 'EVENT_APPLICATION',
          targetId: 9,
          title: '待審核',
          content: '報名已送出',
          isRead: false,
          readAt: null,
          createdAt: '2026-07-15T10:00:00',
        }],
      },
    }));

    component.ngOnInit();

    expect(component.hasRecords).toBeTrue();
    expect(component.vendorName).toBe('小集日');
    expect(component.todoItems).toEqual([
      jasmine.objectContaining({ label: '待審核報名', count: 12 }),
      jasmine.objectContaining({ label: '待付款報名', count: 6 }),
      jasmine.objectContaining({ label: '待選擇攤位', count: 2 }),
      jasmine.objectContaining({
        icon: 'bi-journal-check',
        label: '我的報名紀錄',
        count: 27,
        unit: '筆',
        path: '/vendor/dash-board/application-record',
        iconColor: 'purple',
      }),
    ]);
    expect(vendorDashboardService.searchVendorApplications).toHaveBeenCalledOnceWith({
      page: 1,
      pageSize: 1,
    });
    expect(component.notifications[0]).toEqual(jasmine.objectContaining({
      id: 30,
      status: '新申請',
      title: '報名已送出',
      date: '2026/07/15 10:00',
      unread: true,
    }));
  });

  it('persists a homepage notification read state', () => {
    const item = {
      id: 30,
      icon: 'bi bi-bell',
      iconClass: 'blue',
      status: '通知',
      title: '測試通知',
      date: '2026/07/15 10:00',
      unread: false,
      type: 'systemAnnouncement',
    };

    component.onMarkRead(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith(30, { skipLoading: true });
  });

  it('should show an error instead of the first-login guide when initialization fails', () => {
    vendorDashboardService.getVendorFirstLogin.and.returnValue(
      throwError(() => new Error('network error')),
    );

    component.ngOnInit();

    expect(component.hasRecords).toBeNull();
    expect(component.loadError).toBe('首頁資料載入失敗，請重新整理後再試。');
  });
});
