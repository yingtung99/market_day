import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { OrganizerApiService } from './organizer-api.service';

describe('OrganizerApiService operations APIs', () => {
  let service: OrganizerApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrganizerApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('uses the organizer stall search query parameter names', () => {
    service.searchOrganizerStalls({
      eventTitle: ' 夏日市集 ', status: '進行中', eventStartAt: '2026-07-01', eventEndAt: '2026-07-31', page: 2, pageSize: 6,
    }).subscribe();

    const request = httpTesting.expectOne((candidate) => {
      const url = new URL(candidate.urlWithParams);
      return `${url.origin}${url.pathname}` === `${environment.apiBaseUrl}api/organizer/stalls/search`
        && url.searchParams.get('eventTitle') === '夏日市集'
        && url.searchParams.get('status') === '進行中'
        && url.searchParams.get('event_start_at') === '2026-07-01'
        && url.searchParams.get('event_end_at') === '2026-07-31'
        && url.searchParams.get('page') === '2'
        && url.searchParams.get('pageSize') === '6';
    });
    expect(request.request.method).toBe('GET');
    request.flush({ statusCode: 200, message: 'ok', data: { totalCount: 0, events: { items: [], page: 2, pageSize: 6, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } } });
  });

  it('loads the stall map and selected stall detail', () => {
    service.getOrganizerStallMap(8, { applyDate: '2026-07-18' }).subscribe();
    const mapRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/stall/8?applyDate=2026-07-18`);
    expect(mapRequest.request.method).toBe('GET');
    mapRequest.flush({ statusCode: 200, message: 'ok', data: { event: {}, stalls: [] } });

    service.getOrganizerStallDetail(8, 'A 01', '2026-07-18').subscribe();
    const detailRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/stall/8/A%2001?applyDate=2026-07-18`);
    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush({ statusCode: 200, message: 'ok', data: { stall: {}, application: null, vendor: null } });
  });

  it('loads equipment detail with all table page parameters', () => {
    service.getOrganizerEquipmentDetail(9, {
      equipmentRentalPage: 2, equipmentRentalPageSize: 5, extraPowerPage: 3, extraPowerPageSize: 5, vehiclePage: 4, vehiclePageSize: 5,
    }).subscribe();

    const request = httpTesting.expectOne((candidate) => {
      const url = new URL(candidate.urlWithParams);
      return `${url.origin}${url.pathname}` === `${environment.apiBaseUrl}api/organizer/equipment/9`
        && url.searchParams.get('equipmentRentalPage') === '2'
        && url.searchParams.get('extraPowerPage') === '3'
        && url.searchParams.get('vehiclePage') === '4';
    });
    expect(request.request.method).toBe('GET');
    request.flush({ statusCode: 200, message: 'ok', data: {} });
  });

  it('loads accounting detail with the displayed accounting status', () => {
    service.getOrganizerAccountDetail(10, { status: '退款處理中', paymentPage: 2, paymentPageSize: 5 }).subscribe();

    const request = httpTesting.expectOne((candidate) => {
      const url = new URL(candidate.urlWithParams);
      return `${url.origin}${url.pathname}` === `${environment.apiBaseUrl}api/organizer/accounts/10`
        && url.searchParams.get('status') === '退款處理中'
        && url.searchParams.get('paymentPage') === '2'
        && url.searchParams.get('paymentPageSize') === '5';
    });
    expect(request.request.method).toBe('GET');
    request.flush({ statusCode: 200, message: 'ok', data: {} });
  });

  it('downloads equipment and accounting reports as blobs', () => {
    service.downloadOrganizerEquipmentReport(11).subscribe();
    const equipmentRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/equipment/11/export`);
    expect(equipmentRequest.request.method).toBe('GET');
    expect(equipmentRequest.request.responseType).toBe('blob');
    equipmentRequest.flush(new Blob());

    service.downloadOrganizerAccountReport(12).subscribe();
    const accountRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/accounts/12/export`);
    expect(accountRequest.request.method).toBe('GET');
    expect(accountRequest.request.responseType).toBe('blob');
    accountRequest.flush(new Blob());
  });

  it('searches organizer payments with the collection filters', () => {
    service.searchOrganizerPayments({
      keyword: ' 夏日市集 ',
      paymentStatus: '退款申請中',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      page: 2,
      pageSize: 6,
    }).subscribe();

    const request = httpTesting.expectOne((candidate) => {
      const url = new URL(candidate.urlWithParams);
      return `${url.origin}${url.pathname}` === `${environment.apiBaseUrl}api/organizer/payments/search`
        && url.searchParams.get('keyword') === '夏日市集'
        && url.searchParams.get('paymentStatus') === '退款申請中'
        && url.searchParams.get('startDate') === '2026-07-01'
        && url.searchParams.get('endDate') === '2026-07-31'
        && url.searchParams.get('page') === '2'
        && url.searchParams.get('pageSize') === '6';
    });
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ statusCode: 200, message: 'ok', data: { payments: { items: [], page: 2, pageSize: 6, totalItems: 0, totalPages: 0, hasPrevious: true, hasNext: false } } });
  });

  it('loads payment detail and sends refund confirmation to NewebPay flow', () => {
    service.getOrganizerPaymentDetail(23).subscribe();
    const detailRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/payments/23`);
    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush({ statusCode: 200, message: 'ok', data: {} });

    service.reviewOrganizerRefund('REF202607200001').subscribe();
    const reviewRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/refunds/review`);
    expect(reviewRequest.request.method).toBe('POST');
    expect(reviewRequest.request.body).toEqual({ refundNo: 'REF202607200001' });
    reviewRequest.flush({ statusCode: 200, message: 'ok', data: { refundStatus: 'REFUNDED' } });

    service.retryOrganizerRefundPayment('REF202607200001').subscribe();
    const retryRequest = httpTesting.expectOne(`${environment.apiBaseUrl}api/organizer/refunds/payment`);
    expect(retryRequest.request.method).toBe('POST');
    expect(retryRequest.request.body).toEqual({ refundNo: 'REF202607200001' });
    retryRequest.flush({ statusCode: 200, message: 'ok', data: { refundStatus: 'REFUNDED' } });
  });

  it('uses the organizer NewebPay setup endpoints', () => {
    service.getOrganizerNewebPayPortal().subscribe();
    const portalRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}api/organizer/newebpay/portal`,
    );
    expect(portalRequest.request.method).toBe('GET');
    portalRequest.flush({
      statusCode: 200,
      message: 'ok',
      data: { registrationUrl: 'https://www.newebpay.com', loginUrl: 'https://cwww.newebpay.com' },
    });

    service.getOrganizerNewebPayAccount().subscribe();
    const loadRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}api/organizer/newebpay/load`,
    );
    expect(loadRequest.request.method).toBe('GET');
    loadRequest.flush({
      statusCode: 200,
      message: 'ok',
      data: { bound: false, verificationStatus: 'UNVERIFIED' },
    });

    const payload = {
      merchantId: 'MS123456789',
      hashKey: '12345678901234567890123456789012',
      hashIv: '1234567890123456',
    };
    service.saveOrganizerNewebPayAccount(payload).subscribe();
    const saveRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}api/organizer/newebpay/save`,
    );
    expect(saveRequest.request.method).toBe('POST');
    expect(saveRequest.request.body).toEqual(payload);
    saveRequest.flush({ statusCode: 200, message: 'ok', data: { bound: true } });

    service.verifyOrganizerNewebPayAccount().subscribe();
    const verifyRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}api/organizer/newebpay/verify`,
    );
    expect(verifyRequest.request.method).toBe('POST');
    expect(verifyRequest.request.body).toBeNull();
    verifyRequest.flush({ statusCode: 200, message: 'ok', data: {} });
  });
});
