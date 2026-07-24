import { Router } from '@angular/router';
import { of } from 'rxjs';

import { VendorService } from '../../../../core/Vendor/vendorApi/vendor.service';
import { ApiResult } from '../../../../models/interface/shared/ApiResult';
import {
  VendorMarketSearchItem,
  VendorMarketSearchResponse,
} from '../../../../models/interface/vendor/VendorMarketSearch';
import { VendorMarketSignupList } from './vendor-market-signup-list';

describe('VendorMarketSignupList', () => {
  let component: VendorMarketSignupList;
  let vendorService: jasmine.SpyObj<VendorService>;

  beforeEach(() => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    vendorService = jasmine.createSpyObj<VendorService>('VendorService', ['searchMarkets']);
    component = new VendorMarketSignupList(router, vendorService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filters out markets whose registration deadline has passed', () => {
    const closedMarket = createMarket({
      eventId: 1,
      eventTitle: '已截止市集',
      registrationEndAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const availableMarket = createMarket({
      eventId: 2,
      eventTitle: '可報名市集',
      registrationEndAt: new Date(Date.now() + 60_000).toISOString(),
    });
    vendorService.searchMarkets.and.returnValue(
      of(createResponse([closedMarket, availableMarket])),
    );

    component.ngOnInit();

    expect(component.markets.map((market) => market.title)).toEqual(['可報名市集']);
    expect(component.totalItems).toBe(1);
  });
});

function createMarket(
  overrides: Partial<VendorMarketSearchItem> = {},
): VendorMarketSearchItem {
  return {
    eventId: 1,
    eventTitle: '測試市集',
    summary: '測試摘要',
    locationName: '測試場地',
    city: '臺北市',
    district: '中正區',
    address: '測試地址',
    maxBooths: 20,
    startAt: '2026-08-01T10:00:00',
    endAt: '2026-08-02T18:00:00',
    registrationStartAt: '2026-07-01T00:00:00',
    registrationEndAt: '2026-07-31T23:59:59',
    baseFee: 500,
    trafficTitle: null,
    trafficDetail: null,
    organizerName: '測試主辦方',
    imageUrl: null,
    registrationStatus: 'OPEN',
    ...overrides,
  };
}

function createResponse(
  items: VendorMarketSearchItem[],
): ApiResult<VendorMarketSearchResponse> {
  return {
    statusCode: 200,
    message: 'success',
    messageDetails: null,
    data: {
      markets: {
        items,
        page: 1,
        pageSize: 6,
        totalItems: items.length,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    },
  };
}
