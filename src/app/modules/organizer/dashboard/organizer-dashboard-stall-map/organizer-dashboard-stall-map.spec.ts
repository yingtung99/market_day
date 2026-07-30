import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import type { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerDashboardStallMap } from './organizer-dashboard-stall-map';

describe('OrganizerDashboardStallMap', () => {
  it('uses event dates and only renders stalls returned by the selected-date API', async () => {
    const route = {
      snapshot: {
        paramMap: convertToParamMap({ id: '82' }),
        queryParamMap: convertToParamMap({}),
      },
    };
    const router = { navigate: jasmine.createSpy('navigate') };
    const organizerApi = {
      getOrganizerStallMap: jasmine.createSpy('getOrganizerStallMap').and.callFake(
        (_eventId: number, params: { applyDate?: string }) => of({
          statusCode: 200,
          message: 'ok',
          messageDetails: null,
          data: {
            event: {
              eventId: 82,
              eventTitle: '審計夏日營運市集',
              locationName: '審計新村',
              eventStatus: 'PUBLISHED',
              statusNote: null,
              totalStallCount: 2,
              selectedStallCount: 1,
              availableStallCount: 1,
              startAt: '2026-09-13T10:00:00',
              endAt: '2026-09-14T18:00:00',
              currentApplyDate: params.applyDate ?? '2026-09-13',
              address: '台中市西區',
              mapImageUrl: null,
            },
            stalls: [{
              zoneName: 'A區',
              zoneId: 1,
              stalls: [
                {
                  stallId: 1,
                  stallNo: 'A01',
                  zoneId: 1,
                  width: 3,
                  length: 3,
                  status: 'AVAILABLE',
                  selectedApplicationId: null,
                },
                {
                  stallId: 2,
                  stallNo: 'A02',
                  zoneId: 1,
                  width: 3,
                  length: 3,
                  status: 'SELECTED',
                  selectedApplicationId: 99,
                  selectedVendor: {
                    name: '午後果子舖',
                    category: { id: 1, name: '餐飲美食', slug: 'food' },
                    ownerName: '陳小果',
                    selectedAt: '2026-09-13T14:30:00',
                  },
                },
              ],
            }],
          },
        }),
      ),
    };

    const component = new OrganizerDashboardStallMap(
      route as never,
      router as never,
      organizerApi as unknown as OrganizerApiService,
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(component.dateOptions).toEqual(['2026/09/13', '2026/09/14']);
    expect(component.selectedDate).toBe('2026/09/13');
    expect(component.mapData.booths.find((booth) => booth.code === 'A01')?.status)
      .toBe('available');
    expect(component.mapData.booths.find((booth) => booth.code === 'A02')?.status)
      .toBe('selected');
    expect(component.mapData.booths.find((booth) => booth.code === 'A02'))
      .toEqual(jasmine.objectContaining({
        size: '3m × 3m',
        applicationId: 99,
        vendorOwnerName: '陳小果',
        selectedAt: '2026-09-13T14:30:00',
        brand: jasmine.objectContaining({
          name: '午後果子舖',
          category: '餐飲美食',
        }),
      }));
    expect(component.mapData.booths.find((booth) => booth.code === 'A03'))
      .toBeUndefined();

    component.selectDate('2026/09/14');
    await Promise.resolve();

    expect(organizerApi.getOrganizerStallMap)
      .toHaveBeenCalledWith(82, { applyDate: '2026-09-14' });
    expect(component.selectedDate).toBe('2026/09/14');
  });
});
