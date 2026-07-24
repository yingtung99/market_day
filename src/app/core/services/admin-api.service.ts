import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AdminDashboardOverview } from '../../models/interface/admin/AdminDashboardOverview';
import { EventRevisionRequest, EventStatusChangeDto } from '../../models/interface/admin/AdminEventAction';
import { AdminEventDetailDto, AdminEventStatusLogPage } from '../../models/interface/admin/AdminEventDetail';
import { AdminEventPage, AdminEventSearchRequest } from '../../models/interface/admin/AdminEventSearch';
import { AdminLogPage, AdminLogsSearchRequest } from '../../models/interface/admin/AdminLogSearch';
import { AdminNoticePage, AdminNoticeSearchRequest } from '../../models/interface/admin/AdminNoticeSearch';
import { AdminOrgDetailDto, AdminOrgEventPage } from '../../models/interface/admin/AdminOrganizerDetail';
import { UserStatusChangeDto } from '../../models/interface/admin/AdminUserAction';
import { AdminUserLoginPage } from '../../models/interface/admin/AdminUserLoginLog';
import { AdminUserPage, AdminUserSearchRequest } from '../../models/interface/admin/AdminUserSearch';
import { AdminVenderDetailDto, AdminVenderRegPage } from '../../models/interface/admin/AdminVendorDetail';
import { ApiResult } from '../../models/interface/shared/ApiResult';
import { HttpRequestOptions, HttpService } from '../http/http.service';

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  constructor(private readonly httpService: HttpService) {}

  getDashboardOverview(): Observable<ApiResult<AdminDashboardOverview>> {
    return this.httpService.get<AdminDashboardOverview>('api/admin/dashboard/overview');
  }

  searchNotices(
    request: AdminNoticeSearchRequest,
    options: HttpRequestOptions = {},
  ): Observable<ApiResult<AdminNoticePage>> {
    return this.httpService.post<AdminNoticePage>('api/admin/notices/search', request, options);
  }

  searchEvents(
    request: AdminEventSearchRequest,
    options: HttpRequestOptions = {},
  ): Observable<ApiResult<AdminEventPage>> {
    return this.httpService.post<AdminEventPage>('api/admin/events/search', request, options);
  }

  getEventDetail(id: number): Observable<ApiResult<AdminEventDetailDto>> {
    return this.httpService.get<AdminEventDetailDto>(`api/admin/events/${id}`);
  }

  getEventStatusLogs(
    id: number,
    page: number,
    size: number,
    options: HttpRequestOptions = {},
  ): Observable<ApiResult<AdminEventStatusLogPage>> {
    return this.httpService.get<AdminEventStatusLogPage>(
      `api/admin/events/${id}?page=${page}&size=${size}`,
      options,
    );
  }

  /** 活動審核通過，將活動狀態改為地圖建置中 */
  approveEvent(id: number, note: string | null = null): Observable<ApiResult<EventStatusChangeDto>> {
    return this.httpService.post<EventStatusChangeDto>(`api/admin/events/${id}/approve`, note);
  }

  /**
   * 活動要求補件，或退回下架申請（要求補件）
   *
   * isUnpublish 為 false/null 時 id 為活動 id；為 true 時 id 為下架申請單 id（EventUnpublishRequest.id）
   */
  requestEventRevision(
    id: number,
    request: EventRevisionRequest,
  ): Observable<ApiResult<EventStatusChangeDto>> {
    return this.httpService.post<EventStatusChangeDto>(`api/admin/events/${id}/request-revision`, request);
  }

  /** 活動地圖建置完成，將活動狀態改為待發布 */
  completeEventMapBuilding(id: number): Observable<ApiResult<EventStatusChangeDto>> {
    return this.httpService.post<EventStatusChangeDto>(`api/admin/events/${id}/map-complete`, null);
  }

  /** 確認活動下架（同意下架申請） */
  confirmEventUnpublish(id: number, note: string | null = null): Observable<ApiResult<EventStatusChangeDto>> {
    return this.httpService.post<EventStatusChangeDto>(`api/admin/events/${id}/unpublish-confirm`, note);
  }

  searchUsers(
    request: AdminUserSearchRequest,
    options: HttpRequestOptions = {},
  ): Observable<ApiResult<AdminUserPage>> {
    return this.httpService.post<AdminUserPage>('api/admin/users/search', request, options);
  }

  searchLogs(
    request: AdminLogsSearchRequest,
    options: HttpRequestOptions = {},
  ): Observable<ApiResult<AdminLogPage>> {
    return this.httpService.post<AdminLogPage>('api/admin/logs/search', request, options);
  }

  getOrganizerDetail(id: number, size: number): Observable<ApiResult<AdminOrgDetailDto>> {
    return this.httpService.get<AdminOrgDetailDto>(`api/admin/users/${id}?role=organizer&size=${size}`);
  }

  getVenderDetail(id: number, size: number): Observable<ApiResult<AdminVenderDetailDto>> {
    return this.httpService.get<AdminVenderDetailDto>(`api/admin/users/${id}?role=vender&size=${size}`);
  }

  getOrgEventLogs(id: number, page: number, size: number): Observable<ApiResult<AdminOrgEventPage>> {
    return this.httpService.get<AdminOrgEventPage>(`api/admin/users/${id}/orgEvent?page=${page}&size=${size}`);
  }

  getVenderRegLogs(id: number, page: number, size: number): Observable<ApiResult<AdminVenderRegPage>> {
    return this.httpService.get<AdminVenderRegPage>(`api/admin/users/${id}/venderReg?page=${page}&size=${size}`);
  }

  getUserLoginLogs(id: number, page: number, size: number): Observable<ApiResult<AdminUserLoginPage>> {
    return this.httpService.get<AdminUserLoginPage>(`api/admin/users/${id}/loginLog?page=${page}&size=${size}`);
  }

  /** 使用者帳號停用 */
  disableUserAccount(id: number): Observable<ApiResult<UserStatusChangeDto>> {
    return this.httpService.post<UserStatusChangeDto>(`api/admin/users/${id}/disable`, null);
  }

  /** 使用者帳號復原 */
  restoreUserAccount(id: number): Observable<ApiResult<UserStatusChangeDto>> {
    return this.httpService.post<UserStatusChangeDto>(`api/admin/users/${id}/restore`, null);
  }
}
