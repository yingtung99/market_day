import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { AlertService } from '../../../../core/services/alert.service';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { UserStatus } from '../../../../models/status/UserStatus';
import { UserType } from '../../../../models/type/UserType';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { PaymentStatus } from '../../../../models/status/PaymentStatus';
import { AdminVendorDetail, AdminVenderDetailDto, AdminVenderRegDto } from '../../../../models/interface/admin/AdminVendorDetail';
import { AdminUserLoginDto } from '../../../../models/interface/admin/AdminUserLoginLog';
import { UserStatusChangeDto } from '../../../../models/interface/admin/AdminUserAction';
import { ApiResult, isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { formatDisplayDateText } from '../../../../core/utils/date-display.util';

@Component({
  selector: 'app-admin-dashboard-user-detail-vender',
  imports: [CommonModule, DashboardPagination],
  templateUrl: './admin-dashboard-user-detail-vender.html',
  styleUrl: './admin-dashboard-user-detail-vender.scss',
})
export class AdminDashboardUserDetailVender implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private readonly adminApiService: AdminApiService,
  ) {}

  readonly UserStatus = UserStatus;

  detail: AdminVendorDetail | null = null;
  private userId: number | null = null;

  loginCurrentPage = 1;
  readonly loginPageSize = 5;

  get loginRecordTotal(): number {
    return this.detail?.detail.loginRecords.total ?? 0;
  }

  get paginatedLoginRecords(): AdminVendorDetail['detail']['loginRecords']['items'] {
    return this.detail?.detail.loginRecords.items ?? [];
  }

  onLoginPageChange(page: number): void {
    this.loginCurrentPage = page;
    if (!this.userId || !this.detail) return;

    this.adminApiService.getUserLoginLogs(this.userId, page, this.loginPageSize).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('查詢失敗', res.message);
          return;
        }
        this.detail!.detail.loginRecords = {
          total: res.data.totalItems,
          items: res.data.items.map((item) => this.mapLoginItem(item)),
        };
      },
      error: async (error) => {
        await this.alert.error('查詢失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  registrationCurrentPage = 1;
  readonly registrationPageSize = 5;

  get registrationRecordTotal(): number {
    return this.detail?.detail.activityRegistrationRecords.total ?? 0;
  }

  get paginatedRegistrationRecords(): AdminVendorDetail['detail']['activityRegistrationRecords']['items'] {
    return this.detail?.detail.activityRegistrationRecords.items ?? [];
  }

  onRegistrationPageChange(page: number): void {
    this.registrationCurrentPage = page;
    if (!this.userId || !this.detail) return;

    this.adminApiService.getVenderRegLogs(this.userId, page, this.registrationPageSize).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('查詢失敗', res.message);
          return;
        }
        this.detail!.detail.activityRegistrationRecords = {
          total: res.data.totalItems,
          items: res.data.items.map((item) => this.mapRegItem(item)),
        };
      },
      error: async (error) => {
        await this.alert.error('查詢失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.params['id']);
    this.userId = id;
    this.loadDetail(id);
  }

  /** 串接 API："/api/admin/users/{id}?role=vender"，依網址上的 id 查詢攤主詳細資料 */
  private loadDetail(id: number): void {
    this.adminApiService.getVenderDetail(id, this.loginPageSize).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('查詢失敗', res.message);
          return;
        }
        this.detail = this.mapDetail(res.data);
      },
      error: async (error) => {
        await this.alert.error('查詢失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  private mapDetail(data: AdminVenderDetailDto): AdminVendorDetail {
    return {
      userId: data.userId,
      detail: {
        userInfo: {
          username: data.userName,
          role: UserType.fromApiRole(data.role),
          accountStatus: UserStatus.fromApiStatus(data.accountStatus),
          googleLinked: data.isGoogleBound,
          registeredAt: formatDisplayDateText(data.regAt),
          lastLoginAt: data.lastLoginAt ? formatDisplayDateText(data.lastLoginAt) : '-',
          registrationCount: data.ongoingEventCount,
          completedEventCount: data.endedEventCount,
        },
        vendorInfo: {
          brandName: data.brandName,
          brandType: data.brandType,
          owner: data.owner,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          contactAddress: data.contactAddress,
        },
        activityRegistrationRecords: {
          total: data.eventRegLogs.totalItems,
          items: data.eventRegLogs.items.map((item) => this.mapRegItem(item)),
        },
        loginRecords: {
          total: data.loginLogs.totalItems,
          items: data.loginLogs.items.map((item) => this.mapLoginItem(item)),
        },
      },
    };
  }

  private mapRegItem(item: AdminVenderRegDto): AdminVendorDetail['detail']['activityRegistrationRecords']['items'][number] {
    const booths = item.regBooths.map((booth) => ({
      date: formatDisplayDateText(booth.regDate),
      code: booth.boothNo,
    }));
    return {
      activityId: item.eventId,
      activityName: item.eventName,
      registrationDates: booths.map((booth) => booth.date),
      registrationStatus: item.regStatus,
      paymentStatus: PaymentStatus.fromApiStatus(item.paymentStatus),
      booths,
    };
  }

  private mapLoginItem(item: AdminUserLoginDto): AdminVendorDetail['detail']['loginRecords']['items'][number] {
    return {
      loginTime: formatDisplayDateText(item.loginTime),
      loginMethod: item.loginMethod,
      loginStatus: item.loginStatus,
    };
  }

  get accountStatus(): string {
    return this.detail?.detail.userInfo.accountStatus ?? '';
  }

  get isAccountActive(): boolean {
    return this.accountStatus === UserStatus.active;
  }

  getStatusClass(status: string): string {
    return UserStatus.getClass(status);
  }

  getLoginStatusClass(status: string): string {
    if (status === '成功') return 'green';
    if (status === '失敗') return 'red';
    return 'grey';
  }

  getRegistrationStatusClass(status: string): string {
    return ApplicationStatus.getClass(status);
  }

  getPaymentStatusClass(status: string): string {
    return PaymentStatus.getClass(status);
  }

  goBack(): void {
    this.router.navigate(['/admin/dash-board/users']);
  }

  async toggleAccountStatus(): Promise<void> {
    if (!this.detail || !this.userId) return;
    const username = this.detail.detail.userInfo.username;
    const email = this.detail.detail.vendorInfo.contactEmail;

    if (this.isAccountActive) {
      const confirmed = await this.alert.confirmHtml({
        html: `
          <div class="registration-swal-content">
            <div class="registration-swal-icon warning"><i class="bi bi-exclamation-lg"></i></div>
            <h3>停用帳號確認</h3>
            <p class="registration-swal-main">確定要停用使用者「${username}」(${email})的帳號嗎？</p>
            <div class="restore-confirm-effects">
              <ul>
                <li>該帳號將無法登入管理後台與使用相關功能</li>
                <li>進行中的活動或報名資料不會被刪除</li>
                <li>可隨時在使用者管理頁面中恢復該帳號</li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonText: '確認停用',
        cancelButtonText: '取消',
        popupClass: 'restore-confirm-swal',
      });
      if (!confirmed) return;
      await this.runAccountStatusChange(
        this.adminApiService.disableUserAccount(this.userId),
        '帳號已停用',
        (result) => `使用者「${result.userName}」 的帳號已成功停用。 <br />停用期間將無法登入系統，且無法進行報名、付款及其他操作。`,
      );
    } else {
      const confirmed = await this.alert.confirmHtml({
        html: `
          <div class="registration-swal-content">
            <div class="registration-swal-icon warning"><i class="bi bi-exclamation-lg"></i></div>
            <h3>恢復帳號確認</h3>
            <p class="registration-swal-main">確定要恢復使用者「${username}」(${email})的帳號嗎？</p>
            <div class="restore-confirm-effects">
              <ul>
                <li>該帳號可重新登入系統</li>
                <li>可繼續使用原本角色的相關功能</li>
                <li>原有資料與紀錄將保留</li>
              </ul>
            </div>
          </div>
        `,
        confirmButtonText: '確認恢復',
        cancelButtonText: '取消',
        popupClass: 'restore-confirm-swal',
      });
      if (!confirmed) return;
      await this.runAccountStatusChange(
        this.adminApiService.restoreUserAccount(this.userId),
        '帳號已恢復',
        (result) => `使用者「${result.userName}」 的帳號已成功恢復。<br />該帳號可重新登入系統並使用原本角色的相關功能。`,
      );
    }
  }

  private async runAccountStatusChange(
    request$: Observable<ApiResult<UserStatusChangeDto>>,
    successTitle: string,
    successMessage: (result: UserStatusChangeDto) => string,
  ): Promise<void> {
    try {
      const res = await firstValueFrom(request$);
      if (!isApiSuccessStatus(res.statusCode)) {
        await this.alert.error('操作失敗', res.message);
        return;
      }
      if (this.userId) this.loadDetail(this.userId);
      await this.alert.success(successTitle, successMessage(res.data));
    } catch (error: any) {
      await this.alert.error('操作失敗', error.error?.message || '請稍後再試。');
    }
  }

  onViewRecord(record: AdminVendorDetail['detail']['activityRegistrationRecords']['items'][number]): void {
    this.router.navigate(['/admin/dash-board/activity/detail', record.activityId]);
  }
}
