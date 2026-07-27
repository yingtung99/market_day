import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { OrganizerDashboardInit } from '../../models/interface/organizer/OrganizerDashboardInit';
import {
  OrganizerProfile,
  OrganizerProfileSaveRequest,
} from '../../models/interface/organizer/OrganizerProfile';
import { ApiResult } from '../../models/interface/shared/ApiResult';
import { OrganizerEventSearchResponse } from '../../models/interface/organizer/OrganizerEventSearch';
import {
  OrganizerApplicationDetailResponse,
  OrganizerApplicationReviewRequest,
  OrganizerApplicationReviewResponse,
  OrganizerApplicationSearchResponse,
  OrganizerDepositRefundResponse,
} from '../../models/interface/organizer/OrganizerApplicationSearch';
import { OrganizerEventDetail } from '../../models/interface/organizer/OrganizerEventDetail';
import {
  OrganizerEventSaveRequest,
  OrganizerEventSubmitReviewResponse,
  OrganizerEventDeleteResponse,
  OrganizerEventWithdrawResponse,
  OrganizerEventPublishResponse,
  OrganizerEventUnpublishRequestResponse,
  StoredEventImage,
} from '../../models/interface/organizer/OrganizerEventEditor';
import { HttpService } from '../http/http.service';
import {
  OrganizerAccountingDetailResponse,
  OrganizerAccountingSearchResponse,
  OrganizerEquipmentDetailResponse,
  OrganizerEquipmentSearchResponse,
  OrganizerOperationSearchParams,
  OrganizerStallDetailResponse,
  OrganizerStallMapResponse,
  OrganizerStallSearchResponse,
} from '../../models/interface/organizer/OrganizerOperations';
import {
  OrganizerPaymentDetailResponse,
  OrganizerPaymentSearchResponse,
  OrganizerRefundResponse,
} from '../../models/interface/organizer/OrganizerPayment';
import {
  OrganizerNotificationFilter,
  OrganizerNotificationSearchResponse,
} from '../../models/interface/organizer/OrganizerNotification';
import {
  OrganizerNewebPayAccount,
  OrganizerNewebPayPortal,
  OrganizerNewebPaySaveRequest,
  OrganizerNewebPaySaveResponse,
  OrganizerNewebPayVerificationForm,
} from '../../models/interface/organizer/OrganizerNewebPay';

@Injectable({
  providedIn: 'root',
})
/** 主辦方後台 API 封裝，統一管理活動、報名、收款、攤位、設備、帳務與通知請求。 */
export class OrganizerApiService {
  constructor(private readonly httpService: HttpService) {}

  // 首頁與通知中心
  getOrganizerDashboardInit(): Observable<ApiResult<OrganizerDashboardInit>> {
    return this.httpService.get<OrganizerDashboardInit>('api/organizer/dashboard/init');
  }

  getOrganizerNewebPayPortal(): Observable<ApiResult<OrganizerNewebPayPortal>> {
    return this.httpService.get<OrganizerNewebPayPortal>('api/organizer/newebpay/portal');
  }

  getOrganizerNewebPayAccount(): Observable<ApiResult<OrganizerNewebPayAccount>> {
    return this.httpService.get<OrganizerNewebPayAccount>('api/organizer/newebpay/load');
  }

  saveOrganizerNewebPayAccount(
    payload: OrganizerNewebPaySaveRequest,
  ): Observable<ApiResult<OrganizerNewebPaySaveResponse>> {
    return this.httpService.post<OrganizerNewebPaySaveResponse>(
      'api/organizer/newebpay/save',
      payload,
    );
  }

  verifyOrganizerNewebPayAccount(): Observable<ApiResult<OrganizerNewebPayVerificationForm>> {
    return this.httpService.post<OrganizerNewebPayVerificationForm>(
      'api/organizer/newebpay/verify',
      null,
    );
  }

  getOrganizerNotifications(params: {
    filter?: OrganizerNotificationFilter;
    page?: number;
    pageSize?: number;
  } = {}): Observable<ApiResult<OrganizerNotificationSearchResponse>> {
    const query = new URLSearchParams();
    query.set('filter', params.filter ?? '全部');
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 8));
    return this.httpService.get<OrganizerNotificationSearchResponse>(
      `api/organizer/notices?${query.toString()}`,
      { skipLoading: true },
    );
  }

  // 活動查詢、編輯與工作流操作
  searchOrganizerEvents(params: {
    keyword?: string;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    sort?: 'DEFAULT' | 'UPCOMING_FIRST';
    page?: number;
    pageSize?: number;
    registrationOverview?: boolean;
  } = {}): Observable<ApiResult<OrganizerEventSearchResponse>> {
    const query = new URLSearchParams();
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.status) query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    query.set('sort', params.sort ?? 'DEFAULT');
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 6));
    if (params.registrationOverview) query.set('registrationOverview', 'true');
    return this.httpService.get<OrganizerEventSearchResponse>(
      `api/organizer/events/search?${query.toString()}`,
    );
  }

  getOrganizerEventDetail(eventId: number): Observable<ApiResult<OrganizerEventDetail>> {
    return this.httpService.get<OrganizerEventDetail>(
      `api/organizer/events/${eventId}`,
      { skipLoading: true, timeoutMs: 15000 },
    );
  }

  saveOrganizerEvent(payload: OrganizerEventSaveRequest): Observable<ApiResult<OrganizerEventDetail>> {
    return this.httpService.post<OrganizerEventDetail>('api/organizer/events', payload);
  }

  deleteOrganizerEvent(
    eventId: number,
  ): Observable<ApiResult<OrganizerEventDeleteResponse>> {
    return this.httpService.delete<OrganizerEventDeleteResponse>(
      `api/organizer/events/${eventId}`,
    );
  }

  submitOrganizerEventReview(
    eventId: number,
  ): Observable<ApiResult<OrganizerEventSubmitReviewResponse>> {
    return this.httpService.post<OrganizerEventSubmitReviewResponse>(
      `api/organizer/events/${eventId}/submit-review`,
      null,
    );
  }

  withdrawOrganizerEventReview(
    eventId: number,
  ): Observable<ApiResult<OrganizerEventWithdrawResponse>> {
    return this.httpService.post<OrganizerEventWithdrawResponse>(
      `api/organizer/events/${eventId}/withdraw`,
      null,
    );
  }

  publishOrganizerEvent(
    eventId: number,
  ): Observable<ApiResult<OrganizerEventPublishResponse>> {
    return this.httpService.post<OrganizerEventPublishResponse>(
      `api/organizer/events/${eventId}/publish`,
      null,
    );
  }

  requestOrganizerEventUnpublish(
    eventId: number,
    reason: string,
  ): Observable<ApiResult<OrganizerEventUnpublishRequestResponse>> {
    return this.httpService.post<OrganizerEventUnpublishRequestResponse>(
      `api/organizer/events/${eventId}/unpublish-request`,
      { reason },
    );
  }

  uploadOrganizerEventImage(
    eventId: number,
    purpose: 'EVENT_COVER' | 'EVENT_MAP',
    file: File,
  ): Observable<ApiResult<StoredEventImage>> {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('eventId', String(eventId));
    formData.append('file', file);
    return this.httpService.upload<StoredEventImage>('api/images', formData);
  }

  // 報名查詢、審核與保證金退還
  searchOrganizerApplications(params: {
    eventTitle?: string;
    status?: string;
    brandName?: string;
    registrationStartAt?: string | null;
    registrationEndAt?: string | null;
    page?: number;
    pageSize?: number;
  } = {}): Observable<ApiResult<OrganizerApplicationSearchResponse>> {
    const query = new URLSearchParams();
    if (params.eventTitle?.trim()) query.set('eventTitle', params.eventTitle.trim());
    if (params.status?.trim()) query.set('status', params.status.trim());
    if (params.brandName) query.set('brandName', params.brandName);
    if (params.registrationStartAt) query.set('registration_start_at', params.registrationStartAt);
    if (params.registrationEndAt) query.set('registration_end_at', params.registrationEndAt);
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 6));
    return this.httpService.get<OrganizerApplicationSearchResponse>(
      `api/organizer/applications/search?${query.toString()}`,
    );
  }

  getOrganizerApplicationDetail(
    applicationId: number,
  ): Observable<ApiResult<OrganizerApplicationDetailResponse>> {
    return this.httpService.get<OrganizerApplicationDetailResponse>(
      `api/organizer/applications/${applicationId}`,
    );
  }

  approveOrganizerApplication(
    applicationId: number,
  ): Observable<ApiResult<OrganizerApplicationReviewResponse>> {
    return this.httpService.post<OrganizerApplicationReviewResponse>(
      `api/organizer/applications/${applicationId}/approve`,
      null,
    );
  }

  rejectOrganizerApplication(
    applicationId: number,
    payload: OrganizerApplicationReviewRequest,
  ): Observable<ApiResult<OrganizerApplicationReviewResponse>> {
    return this.httpService.post<OrganizerApplicationReviewResponse>(
      `api/organizer/applications/${applicationId}/reject`,
      payload,
    );
  }

  refundOrganizerDeposit(
    applicationId: number,
  ): Observable<ApiResult<OrganizerDepositRefundResponse>> {
    return this.httpService.post<OrganizerDepositRefundResponse>(
      `api/organizer/deposits/refund?applicationId=${encodeURIComponent(applicationId)}`,
      null,
    );
  }

  // 收款、退款確認與失敗重試
  searchOrganizerPayments(params: {
    keyword?: string;
    paymentStatus?: string;
    startDate?: string | null;
    endDate?: string | null;
    page?: number;
    pageSize?: number;
  } = {}): Observable<ApiResult<OrganizerPaymentSearchResponse>> {
    const query = new URLSearchParams();
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
    if (params.paymentStatus?.trim()) query.set('paymentStatus', params.paymentStatus.trim());
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 6));
    return this.httpService.post<OrganizerPaymentSearchResponse>(
      `api/organizer/payments/search?${query.toString()}`,
      null,
    );
  }

  getOrganizerPaymentDetail(
    applicationId: number,
  ): Observable<ApiResult<OrganizerPaymentDetailResponse>> {
    return this.httpService.get<OrganizerPaymentDetailResponse>(
      `api/organizer/payments/${applicationId}`,
    );
  }

  reviewOrganizerRefund(refundNo: string): Observable<ApiResult<OrganizerRefundResponse>> {
    return this.httpService.post<OrganizerRefundResponse>('api/organizer/refunds/review', {
      refundNo,
    });
  }

  retryOrganizerRefundPayment(refundNo: string): Observable<ApiResult<OrganizerRefundResponse>> {
    return this.httpService.post<OrganizerRefundResponse>('api/organizer/refunds/payment', {
      refundNo,
    });
  }

  // 攤位、設備與帳務管理
  searchOrganizerStalls(params: OrganizerOperationSearchParams = {}): Observable<ApiResult<OrganizerStallSearchResponse>> {
    return this.httpService.get<OrganizerStallSearchResponse>(
      `api/organizer/stalls/search?${this.buildOperationSearchQuery(params)}`,
    );
  }

  getOrganizerStallMap(eventId: number, params: { applyDate?: string; keyword?: string; status?: string } = {}): Observable<ApiResult<OrganizerStallMapResponse>> {
    const query = new URLSearchParams();
    if (params.applyDate) query.set('applyDate', params.applyDate);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.status) query.set('status', params.status);
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.httpService.get<OrganizerStallMapResponse>(`api/organizer/stall/${eventId}${suffix}`);
  }

  getOrganizerStallDetail(eventId: number, stallNo: string, applyDate?: string): Observable<ApiResult<OrganizerStallDetailResponse>> {
    const query = applyDate ? `?applyDate=${encodeURIComponent(applyDate)}` : '';
    return this.httpService.get<OrganizerStallDetailResponse>(
      `api/organizer/stall/${eventId}/${encodeURIComponent(stallNo)}${query}`,
    );
  }

  searchOrganizerEquipment(params: OrganizerOperationSearchParams = {}): Observable<ApiResult<OrganizerEquipmentSearchResponse>> {
    return this.httpService.get<OrganizerEquipmentSearchResponse>(
      `api/organizer/equipment/search?${this.buildOperationSearchQuery(params)}`,
    );
  }

  getOrganizerEquipmentDetail(eventId: number, params: { equipmentRentalPage?: number; equipmentRentalPageSize?: number; extraPowerPage?: number; extraPowerPageSize?: number; vehiclePage?: number; vehiclePageSize?: number } = {}): Observable<ApiResult<OrganizerEquipmentDetailResponse>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && query.set(key, String(value)));
    return this.httpService.get<OrganizerEquipmentDetailResponse>(
      `api/organizer/equipment/${eventId}?${query.toString()}`,
    );
  }

  downloadOrganizerEquipmentReport(eventId: number): Observable<Blob> {
    return this.httpService.download(`api/organizer/equipment/${eventId}/export`);
  }

  searchOrganizerAccounts(params: OrganizerOperationSearchParams = {}): Observable<ApiResult<OrganizerAccountingSearchResponse>> {
    return this.httpService.get<OrganizerAccountingSearchResponse>(
      `api/organizer/accounts/search?${this.buildOperationSearchQuery(params)}`,
    );
  }

  getOrganizerAccountDetail(eventId: number, params: { status?: string; paymentPage?: number; paymentPageSize?: number } = {}): Observable<ApiResult<OrganizerAccountingDetailResponse>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    query.set('paymentPage', String(params.paymentPage ?? 1));
    query.set('paymentPageSize', String(params.paymentPageSize ?? 5));
    return this.httpService.get<OrganizerAccountingDetailResponse>(
      `api/organizer/accounts/${eventId}?${query.toString()}`,
    );
  }

  downloadOrganizerAccountReport(eventId: number): Observable<Blob> {
    return this.httpService.download(`api/organizer/accounts/${eventId}/export`);
  }

  // 主辦方個人與聯絡資料
  getOrganizerProfile(): Observable<ApiResult<OrganizerProfile>> {
    return this.httpService.get<OrganizerProfile>('api/organizer/profile/load');
  }

  postOrganizerProfile(
    payload: OrganizerProfileSaveRequest,
  ): Observable<ApiResult<OrganizerProfile>> {
    return this.httpService.post<OrganizerProfile>('api/organizer/profile/save', payload);
  }

  private buildOperationSearchQuery(params: OrganizerOperationSearchParams): string {
    const query = new URLSearchParams();
    if (params.eventTitle?.trim()) query.set('eventTitle', params.eventTitle.trim());
    if (params.status?.trim()) query.set('status', params.status.trim());
    if (params.eventStartAt) query.set('event_start_at', params.eventStartAt);
    if (params.eventEndAt) query.set('event_end_at', params.eventEndAt);
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 6));
    return query.toString();
  }
}
