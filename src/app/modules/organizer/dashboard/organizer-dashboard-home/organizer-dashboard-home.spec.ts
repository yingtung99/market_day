import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { NotificationApiService } from '../../../../core/services/notification-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { PaymentStatus } from '../../../../models/status/PaymentStatus';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { OrganizerDashboardHome } from './organizer-dashboard-home';

describe('OrganizerDashboardHome', () => {
  let component: OrganizerDashboardHome;
  let fixture: ComponentFixture<OrganizerDashboardHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerDashboardHome],
      providers: [
        provideRouter([]),
        {
          provide: OrganizerApiService,
          useValue: {
            getOrganizerNotifications: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                unreadCount: 0,
                notifications: {
                  items: [],
                  page: 1,
                  pageSize: 3,
                  totalItems: 0,
                  totalPages: 0,
                  hasPrevious: false,
                  hasNext: false,
                },
              },
            }),
            getOrganizerDashboardInit: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: { needsProfile: false },
            }),
            getOrganizerNewebPayAccount: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                bound: true,
                merchantId: 'MS123456789',
                hashKey: '',
                hashIv: '',
                status: 'ACTIVE',
                verificationStatus: 'VERIFIED',
                verifiedAt: '2026-07-27T10:00:00',
                updatedAt: '2026-07-27T10:00:00',
              },
            }),
            searchOrganizerEvents: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                totalCount: 3,
                events: {
                  items: [1, 2, 3].map((eventId) => ({
                    eventId,
                    eventTitle: `Market ${eventId}`,
                    capacity: 100,
                    registeredCount: 80,
                    paidCount: 70,
                    selectedCount: 60,
                  })),
                },
              },
            }),
            searchOrganizerApplications: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                taskSummary: {
                  pendingReviewCount: 12,
                  pendingRefundConfirmationCount: 3,
                  pendingStallSelectionCount: 50,
                  pendingPublishCount: 4,
                },
                totalCount: 0,
                applications: { items: [] },
              },
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getUser: () => ({
              email: 'organizer@example.com',
              name: '測試主辦方',
              role: 'ORGANIZER',
              status: 'ACTIVE',
              isLogin: true,
            }),
            getAuthMe: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                user: {
                  email: 'organizer@example.com',
                  name: '最新主辦方名稱',
                  role: 'ORGANIZER',
                  status: 'ACTIVE',
                  isLogin: true,
                },
              },
            }),
            saveUser: jasmine.createSpy('saveUser'),
          },
        },
        {
          provide: NotificationApiService,
          useValue: {
            markAsRead: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: { id: 1, isRead: true },
            }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganizerDashboardHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should provide three activities for the registration overview', () => {
    expect(component.activityRegistrationOverview.length).toBe(3);
  });

  it('should load todo card counts from the application task summary', () => {
    expect(component.todoItems.map((item) => item.count)).toEqual([12, 3, 50, 4]);
  });

  it('should display the current organizer name returned by auth API', () => {
    expect(component.displayName).toBe('最新主辦方名稱');
    expect(fixture.nativeElement.textContent).toContain('歡迎回來，最新主辦方名稱！');
  });

  it('should link todo cards to lists with the matching status filters', () => {
    expect(component.todoItems.map((item) => ({
      path: item.path,
      status: item.queryParams?.['status'],
    }))).toEqual([
      { path: '/organizer/dash-board/register', status: ApplicationStatus.pendingReview },
      { path: '/organizer/dash-board/collection', status: PaymentStatus.refundRequested },
      { path: '/organizer/dash-board/register', status: ApplicationStatus.pendingSelection },
      { path: '/organizer/dash-board/activity', status: ActivityStatus.readyToPublish },
    ]);
  });
});
