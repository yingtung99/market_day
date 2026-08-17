import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import type { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import type { AlertService } from '../../../../core/services/alert.service';
import type { VendorApplicationApiDetail } from '../../../../models/interface/vendor/VendorApplicationApiDetail';
import { VendorBoothSelection } from './vendor-booth-selection';

describe('VendorBoothSelection', () => {
  it('reloads the selected activity and creates days from its dates', () => {
    const route = {
      snapshot: {
        paramMap: convertToParamMap({ applicationNo: 'MD20260801001' }),
        queryParamMap: convertToParamMap({ applicationId: '25' }),
      },
    };
    const router = { navigate: jasmine.createSpy('navigate') };
    const dashboardService = {
      getVendorApplicationDetail: jasmine.createSpy('getVendorApplicationDetail').and.returnValue(of({
        statusCode: 200,
        message: 'ok',
        messageDetails: null,
        data: {
          event: { eventId: 82 },
          applicationdetail: {
            registrationPeriods: '2026-08-02 10:00-18:00',
          },
          stall: [],
        } as unknown as VendorApplicationApiDetail,
      })),
      getVendorStallMap: jasmine.createSpy('getVendorStallMap').and.returnValue(of({
        statusCode: 200,
        message: 'ok',
        messageDetails: null,
        data: {
          application: {
            applicationNo: 'MD20260801001',
            applicationStatus: '待選位',
            vendorName: '測試攤主',
            currentApplyDate: '2026-08-02',
            applyDates: '2026-08-02',
            applyDateCount: 1,
            selectedStalls: [{
              selectedStallId: 12,
              applyDate: '2026-08-02',
              stallNo: 'A12',
              zoneName: 'A區',
              width: 3,
              length: 3,
            }],
            alreadyselectdate: ['2026-08-02'],
          },
          event: {
            eventTitle: '夏日市集',
            startAt: '2026-08-01T10:00:00',
            endAt: '2026-08-02T18:00:00',
            address: '台北市測試路100號',
          },
          stalls: [
            {
              stallId: 3,
              zoneId: 1,
              zoneName: 'A區',
              stallNo: 'A03',
              width: 3,
              length: 3,
              status: 'AVAILABLE',
              selectedApplicationId: null,
            },
            {
              stallId: 4,
              zoneId: 1,
              zoneName: 'A區',
              stallNo: 'A04',
              width: 3,
              length: 3,
              status: 'SELECTED',
              selectedApplicationId: 99,
            },
          ],
        },
      })),
    };
    const alert = { error: jasmine.createSpy('error') };

    const component = new VendorBoothSelection(
      route as never,
      router as never,
      dashboardService as unknown as VendorDashboardService,
      alert as unknown as AlertService,
    );

    component.ngOnInit();

    expect(dashboardService.getVendorApplicationDetail).toHaveBeenCalledOnceWith(25);
    expect(dashboardService.getVendorStallMap)
      .toHaveBeenCalledOnceWith('MD20260801001', '2026-08-02');
    expect(component.dateOptions).toEqual(['2026-08-02']);
    expect(component.activityDateText).toBe('2026/08/02 10:00-18:00');
    expect(component.activityTitle).toBe('夏日市集');
    expect(component.activityAddress).toBe('台北市測試路100號');
    expect(component.boothTotal).toBe(2);
    expect(component.mapData.booths.find((booth) => booth.code === 'A03')?.status)
      .toBe('available');
    expect(component.mapData.booths.find((booth) => booth.code === 'A04')?.status)
      .toBe('occupied');
    expect(component.mapData.booths.find((booth) => booth.code === 'B03'))
      .toBeUndefined();
    expect(component.mapData.booths.filter((booth) => booth.id !== 'service-booth').length)
      .toBe(3);
    expect(component.days[0].booth?.code).toBe('A12');
    expect(component.isLoading).toBeFalse();
  });
});
