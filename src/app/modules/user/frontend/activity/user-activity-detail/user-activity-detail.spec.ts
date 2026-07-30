import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UserMarketApiService } from '../../../services/user-market-api.service';
import { UserActivityDetail } from './user-activity-detail';

describe('UserActivityDetail', () => {
  let component: UserActivityDetail;
  let fixture: ComponentFixture<UserActivityDetail>;
  let marketApi: jasmine.SpyObj<UserMarketApiService>;

  beforeEach(async () => {
    marketApi = jasmine.createSpyObj<UserMarketApiService>('UserMarketApiService', [
      'getMarketDetail',
      'getMarketDetailByStall',
      'getEventStallsStatus',
    ]);
    marketApi.getEventStallsStatus.and.returnValue(of({ statusCode: 200, data: [] } as any));
    marketApi.getMarketDetailByStall.and.returnValue(of({
      statusCode: 200,
      data: { selectedStall: { brand: null } },
    } as any));

    await TestBed.configureTestingModule({
      imports: [UserActivityDetail],
      providers: [
        provideRouter([]),
        { provide: UserMarketApiService, useValue: marketApi },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserActivityDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the complete stall layout when the activity date changes', () => {
    (component as unknown as { marketId: number }).marketId = 7;
    component.selectedActivityDate = '2026/07/18';

    component.selectActivityDate('2026/07/19');

    expect(marketApi.getEventStallsStatus).toHaveBeenCalledOnceWith(7, '2026-07-19');
    expect(marketApi.getMarketDetailByStall).not.toHaveBeenCalled();
  });

  it('should request brand data only after a booth is selected', () => {
    (component as unknown as { marketId: number }).marketId = 7;
    component.selectedActivityDate = '2026/07/19';
    component.selectedMarketMap = {
      ...component.selectedMarketMap,
      booths: [{
        id: 'a01',
        code: 'A01',
        zone: 'A區',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        status: 'occupied',
        size: '3m x 3m',
      }],
    };

    component.onMapBoothSelected('A01');

    expect(marketApi.getMarketDetailByStall).toHaveBeenCalledOnceWith(7, '2026-07-19', 'A01');
  });

  it('should not request brand data for an available booth', () => {
    (component as unknown as { marketId: number }).marketId = 7;
    component.selectedActivityDate = '2026/07/19';
    component.selectedMarketMap = {
      ...component.selectedMarketMap,
      booths: [{
        id: 'a01',
        code: 'A01',
        zone: 'A區',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        status: 'available',
        size: '3m x 3m',
      }],
    };

    component.onMapBoothSelected('A01');

    expect(marketApi.getMarketDetailByStall).not.toHaveBeenCalled();
  });

  it('should hide the public booth map until brands are public', () => {
    (component as unknown as { latestDetail: { brandsPublic: boolean } }).latestDetail = {
      brandsPublic: false,
    };

    expect(component.showBoothInfo).toBeFalse();

    (component as unknown as { latestDetail: { brandsPublic: boolean } }).latestDetail.brandsPublic = true;
    expect(component.showBoothInfo).toBeTrue();
  });

  it('should preserve the complete map and apply stalls returned by the public stall API', () => {
    (component as any).applyDailyStallLayout('2026/07/19', [{
      stallId: 2,
      eventId: 7,
      zoneId: 2,
      zoneName: 'B區',
      stallNo: 'B01',
      width: 3,
      length: 3,
      status: '可選擇',
      vendorName: null,
    }]);

    expect(component.selectedMarketMap.booths.length).toBe(51);
    expect(component.selectedMarketMap.booths.some((booth) => booth.code === 'A01')).toBeTrue();
    expect(component.selectedMarketMap.booths.find((booth) => booth.code === 'B01')?.zone).toBe('B區');
    expect(component.selectedMarketMap.booths.find((booth) => booth.code === 'B01')?.status).toBe('available');
  });

  it('should preserve an occupied booth when its brand is not public', () => {
    component.selectedActivityDate = '2026/07/19';
    component.selectedMarketMap = {
      ...component.selectedMarketMap,
      booths: [{
        id: 'a01',
        code: 'A01',
        zone: 'A區',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        status: 'occupied',
        size: '3m x 3m',
      }],
    };

    (component as any).applySelectedStallBrand('A01', null);

    expect(component.selectedMarketMap.booths[0].status).toBe('occupied');
    expect(component.selectedMarketMap.booths[0].brand).toBeUndefined();
  });
});
