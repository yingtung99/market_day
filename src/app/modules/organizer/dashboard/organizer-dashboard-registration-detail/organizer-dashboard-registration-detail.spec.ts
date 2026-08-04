import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { NEVER } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerDashboardRegistrationDetail } from './organizer-dashboard-registration-detail';

describe('OrganizerDashboardRegistrationDetail', () => {
  let component: OrganizerDashboardRegistrationDetail;
  let fixture: ComponentFixture<OrganizerDashboardRegistrationDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerDashboardRegistrationDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: OrganizerApiService,
          useValue: { getOrganizerApplicationDetail: () => NEVER },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizerDashboardRegistrationDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('待完成選位只提供查看攤位地圖，不顯示主辦方代選操作', () => {
    component.detail.status = '待完成選位';

    expect(component.pageActions).toEqual([
      jasmine.objectContaining({ key: 'viewBoothMap', label: '查看攤位地圖' }),
    ]);
  });

  it('桌機查看攤位地圖應導向完整地圖頁，不開啟 modal', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    component.detail.id = 12;
    component.detail.activity.eventId = 7;
    component.detail.boothAssignments = [
      { date: '2026/07/20', boothNo: '-', zone: '-', status: '未選擇' },
    ];

    await component.handlePageAction({ key: 'viewBoothMap', label: '查看攤位地圖' });

    expect(navigate).toHaveBeenCalledWith(
      ['/organizer/dash-board/stall/detail', 7, 'map'],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          applyDate: '2026-07-20',
          returnTo: 'registration',
          applicationId: 12,
        }),
      }),
    );
  });

  it('品牌 ID 為 0 時仍應帶入品牌詳情網址', async () => {
    component.detail.brand.id = 0;
    const openInNewTab = spyOn<any>(component, 'openInNewTab');

    await component.handlePageAction({ key: 'viewBrand', label: '查看品牌' });

    expect(openInNewTab).toHaveBeenCalledWith(
      '/user/brand-detail',
      { brand: '0' },
    );
  });
});
