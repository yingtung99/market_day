import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { AlertService } from '../../../../core/services/alert.service';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { AdminMarketDetail } from '../../../../models/interface/admin/AdminMarketDetail';
import { AdminEventDetailDto, AdminEventStatusLog } from '../../../../models/interface/admin/AdminEventDetail';
import { EventStatusChangeDto } from '../../../../models/interface/admin/AdminEventAction';
import { ApiResult, isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { formatCombinedServiceHours } from '../../../../core/utils/service-time.util';

/** 後端 Role 的 API 值對應到畫面顯示用的中文角色名稱 */
const OPERATOR_ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  organizer: '主辦方',
  vender: '攤主',
};

@Component({
  selector: 'app-admin-dashboard-market-detail',
  imports: [CommonModule, DashboardPagination],
  templateUrl: './admin-dashboard-market-detail.html',
  styleUrl: './admin-dashboard-market-detail.scss',
})
export class AdminDashboardMarketDetail implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private readonly adminApiService: AdminApiService,
  ) { }

  detail: AdminMarketDetail | null = null;
  readonly ActivityStatus = ActivityStatus;
  readonly statusLogPageSize = 6;
  statusLogCurrentPage = 1;
  statusLogTotalItems = 0;

  private eventId: number | null = null;

  onStatusLogPageChange(page: number): void {
    if (!this.eventId) return;

    this.statusLogCurrentPage = page;
    this.loadStatusLogs(this.eventId, page);
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.params['id']);
    if (!id) {
      this.detail = null;
      return;
    }

    this.eventId = id;
    this.loadDetail(id);
  }

  /**
   * 串接 API："GET /api/admin/events/{id}"，取得活動詳細資料（含第一頁狀態紀錄）
   */
  private loadDetail(id: number): void {
    this.adminApiService.getEventDetail(id).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('讀取失敗', res.message);
          return;
        }

        this.detail = this.mapDetail(res.data);
        this.statusLogCurrentPage = res.data.logs.page;
        this.statusLogTotalItems = res.data.logs.totalItems;
      },
      error: async (error) => {
        await this.alert.error('讀取失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  /**
   * 串接 API："GET /api/admin/events/{id}?page=&size="，換頁時只重新查詢狀態紀錄
   */
  private loadStatusLogs(id: number, page: number): void {
    this.adminApiService.getEventStatusLogs(id, page, this.statusLogPageSize).subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('讀取失敗', res.message);
          return;
        }

        if (this.detail) {
          this.detail = { ...this.detail, statusLogs: res.data.items.map((log) => this.mapStatusLog(log)) };
        }
        this.statusLogTotalItems = res.data.totalItems;
      },
      error: async (error) => {
        await this.alert.error('讀取失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  /** 把 API 回傳的活動詳細資料轉成畫面用的 AdminMarketDetail */
  private mapDetail(data: AdminEventDetailDto): AdminMarketDetail {
    const categoryNames = data.categories?.map((category) => category.name) ?? ['-'];
    const boothZoneLabels = data.boothZones?.length
      ? data.boothZones.map((zone) => `${zone.name}：${zone.qty}攤`)
      : ['-'];

    return {
      activityId: data.eventId,
      activityStatus: ActivityStatus.fromApiStatus(data.eventStatus),
      activityInfo: {
        image: data.coverImg,
        name: data.eventName,
        types: categoryNames,
        time: data.eventTime,
        locationName: data.locationName,
        location: data.addr,
        description: data.description,
      },
      timeline: {
        registrationStartTime: data.registrationStartTime,
        registrationEndTime: data.registrationEndTime,
        finalListConfirmation: data.finalListCfmTime ?? '尚未確認',
        activityTime: data.eventTime,
      },
      organizerInfo: {
        organizerName: data.organizerName,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        email: data.contactEmail,
        address: data.contactAddr,
        taxId: data.taxId,
        serviceHours: formatCombinedServiceHours(data.serviceHours),
      },
      transportation: {
        mrt: data.mrt,
        bus: data.bus,
        drivingDirections: data.driving,
      },
      boothInfo: {
        boothSpec: this.formatBoothSpec(data.boothSpec),
        boothCount: data.boothCount,
        boothPrice: data.boothPrice,
        boothZones: boothZoneLabels,
      },
      boothLayoutImage: data.boothLayoutImage,
      statusLogs: data.logs.items.map((log) => this.mapStatusLog(log)),
      unpublishRequestId: data.unpublishRequestId,
      unpublishReason: data.unpublishReason,
      unpublishRequestedAt: data.unpublishRequestedAt,
    };
  }

  /** 把 API 回傳的狀態紀錄轉成畫面用的 StatusLog */
  private mapStatusLog(log: AdminEventStatusLog): AdminMarketDetail['statusLogs'][number] {
    return {
      dateTime: log.dateTime,
      status: ActivityStatus.fromWorkflowApiStatus(log.status),
      description: log.description,
      operator: {
        role: OPERATOR_ROLE_LABEL[log.operatorRole] ?? log.operatorRole,
        operatorName: log.operator,
      },
    };
  }

  /** 管理員活動詳情的攤位規格由前端統一補上乘號與公尺單位。 */
  private formatBoothSpec(boothSpec: string | null | undefined): string {
    if (!boothSpec?.trim()) return '-';

    const value = boothSpec.trim().replace(/\s*[*xX]\s*/g, ' × ');
    if (/公尺|\bm\b/i.test(value)) return value;

    return /^\d+(?:\.\d+)?\s*×\s*\d+(?:\.\d+)?$/.test(value)
      ? `${value} 公尺`
      : value;
  }

  /**
   * 呼叫活動狀態變更類 API 的共用流程：送出請求 → 檢查結果 → 提示訊息 → 重新讀取詳細資料
   */
  private async runEventAction(
    request$: Observable<ApiResult<EventStatusChangeDto>>,
    successTitle: string,
    successMessage: string,
    failTitle: string,
  ): Promise<void> {
    try {
      const res = await firstValueFrom(request$);
      if (!isApiSuccessStatus(res.statusCode)) {
        await this.alert.error(failTitle, res.message);
        return;
      }

      await this.alert.success(successTitle, successMessage);

      if (this.eventId) {
        this.loadDetail(this.eventId);
      }
    } catch (error: any) {
      await this.alert.error(failTitle, error.error?.message || '請稍後再試。');
    }
  }

  getStatusClass(status: string): string {
    return ActivityStatus.getClass(status);
  }

  goBack(): void {
    this.router.navigate(['/admin/dash-board/activity']);
  }

  onRequireSupplementHandler = async (): Promise<void> => {
    await this.openRequireSupplementForm();
  };

  private async openRequireSupplementForm(initialReason = ''): Promise<void> {
    const result = await this.alert.custom<string>({
      html: `
        <div class="registration-swal-content">
          <div class="supplement-swal-header">
            <div class="registration-swal-icon warning">
              <i class="bi bi-exclamation-lg"></i>
            </div>
            <h3>要求補件</h3>
            <p class="registration-swal-main">此活動申請資料需補件，<br>請填寫補件原因後送出通知。</p>
          </div>
          <label class="registration-swal-field required-reason-field">
            <span>補件原因</span>
            <span class="required-reason-control">
              <textarea id="supplementReason" class="supplement-swal-textarea" maxlength="300" placeholder="請輸入需補充或修正的內容"></textarea>
              <em class="supplement-swal-counter" id="supplementCount">0/300</em>
            </span>
          </label>
          <p class="registration-swal-field-error" aria-live="polite"></p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '確認送出',
      cancelButtonText: '取消',
      reverseButtons: true,
      customClass: {
        popup: 'require-supplement-swal admin-require-supplement-swal',
      },
      didOpen: () => {
        const textarea = document.getElementById('supplementReason') as HTMLTextAreaElement;
        const counter = document.getElementById('supplementCount');
        const error = document.querySelector<HTMLElement>('.registration-swal-field-error');
        if (initialReason && textarea) {
          textarea.value = initialReason;
          if (counter) counter.textContent = `${initialReason.length}/300`;
        }
        textarea?.addEventListener('input', () => {
          if (counter) counter.textContent = `${textarea.value.length}/300`;
          if (error) error.textContent = '';
          textarea.classList.remove('is-invalid');
        });
      },
      preConfirm: () => {
        const textarea = document.getElementById('supplementReason') as HTMLTextAreaElement;
        const value = textarea?.value?.trim() ?? '';
        const error = document.querySelector<HTMLElement>('.registration-swal-field-error');
        if (!value) {
          if (error) error.textContent = '請填寫補件原因';
          textarea?.classList.add('is-invalid');
          textarea?.focus();
          return false;
        }
        textarea?.classList.remove('is-invalid');
        if (error) error.textContent = '';
        return value;
      },
    });

    if (!result.isConfirmed || !result.value) return;
    await this.openRequireSupplementConfirm(result.value);
  }

  /** 把字串裡的 HTML 特殊字元轉義，避免帶進 Swal 的 html 字串時被當成標籤解析。 */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async openRequireSupplementConfirm(reason: string): Promise<void> {
    const escapedReason = this.escapeHtml(reason);

    const result = await this.alert.custom({
      html: `
        <div class="registration-swal-content">
          <div class="supplement-swal-header">
            <div class="registration-swal-icon warning">
              <i class="bi bi-exclamation-lg"></i>
            </div>
            <h3>要求補件確認</h3>
            <p class="registration-swal-main">確定要求此活動申請補件嗎？<br>送出後，主辦方將收到補件通知，<br>活動狀態將變更為「補件中」。</p>
          </div>
          <div class="registration-swal-field">
            <span>補件原因</span>
            <div class="supplement-swal-reason-box">${escapedReason}</div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '確認送出',
      cancelButtonText: '返回修改',
      reverseButtons: true,
      customClass: {
        popup: 'require-supplement-swal',
      },
    });

    if ((result.dismiss as string) === 'cancel') {
      await this.openRequireSupplementForm(reason);
      return;
    }

    if (!result.isConfirmed || !this.eventId) return;

    await this.runEventAction(
      this.adminApiService.requestEventRevision(this.eventId, { note: reason, isUnpublish: false }),
      '補件要求已送出',
      '補件要求成功送出。<br />活動狀態更新為「補件中」，已通知送主辦方補件。',
      '補件要求失敗',
    );
  }

  onApproveHandler = async (): Promise<void> => {
    const confirmed = await this.alert.confirm(
      '審核通過',
      '確定通過此活動申請?<br />活動將進入「地圖建置中」狀態，待完成攤位地圖建置後開放報名。',
      '確認送出',
      '取消',
    );

    if (!confirmed || !this.eventId) return;

    await this.runEventAction(
      this.adminApiService.approveEvent(this.eventId),
      '審核通過',
      '活動資料已審核通過。<br />活動已進入「地圖建置中狀態」，請盡速建立攤位地圖。',
      '審核失敗',
    );
  };

  onMapBuildingDoneHandler = async (): Promise<void> => {
    const confirmed = await this.alert.confirm(
      '確定送出地圖建置',
      '確定送出地圖建置嗎?<br />送出後活動狀態將更新為 「待發布」，主辦方確認後即可正式發布活動',
      '確認送出',
      '取消',
    );

    if (!confirmed || !this.eventId) return;

    await this.runEventAction(
      this.adminApiService.completeEventMapBuilding(this.eventId),
      '地圖建置已送出',
      '地圖建置成功送出。<br />活動狀態更新為「待發布」， 並通知主辦方確認活動內容。',
      '地圖建置失敗',
    );
  };

  onUnpublishHandler = async (): Promise<void> => {
    await this.openUnpublishForm();
  };

  // 定義按下下架審核通過要跳出的彈窗
  private async openUnpublishForm(initialReason = ''): Promise<void> {
    const result = await this.alert.custom<{ approved: boolean; reason: string }>({
      html: `
      <div class="registration-swal-content">
        <div class="supplement-swal-header">
            <div class="registration-swal-icon warning">
                <i class="bi bi-exclamation-lg"></i>
            </div>
            <h3>審核下架活動</h3>
            <p class="registration-swal-main">是否同意主辦方提出的活動下架申請，<br>審核結果將影響活動狀態並通知相關人員。</p>
        </div>
        <div class="admin-swal-unpublish-form-data-section">
            <div class="admin-swal-unpublish-form-data">
                <span>活動名稱</span><span>${ this.detail?.activityInfo.name }</span>
                <span>主辦方</span><span>${this.detail?.organizerInfo.organizerName}</span>
                <span>申請時間</span><span>${this.detail?.unpublishRequestedAt ?? '-'}</span>
            </div>
            <div class="admin-swal-unpublish-form-reason">
                <span>申請原因</span>
                <div>${this.escapeHtml(this.detail?.unpublishReason ?? '-')}</div>
            </div>
        </div>
        <div class="admin-swal-unpublish-form-option-section">
            <span>審核結果 <i class="required-mark">*</i></span>
            <div>
              <input type="radio" value="1" name="approval" id="agreeUnpublish" />
              <label for="agreeUnpublish">同意下架</label>
            </div>
            <div>
              <input type="radio" value="0" name="approval" id="disagreeUnpublish" />
              <label for="disagreeUnpublish">不同意下架</label>
            </div>
        </div>
        <label class="registration-swal-field required-reason-field">
            <span>審核說明 <i>*不同意時為必填欄位</i></span>
            <span class="required-reason-control">
              <textarea id="supplementReason" class="supplement-swal-textarea" maxlength="200"
                  placeholder="請輸入說明"></textarea>
              <em class="supplement-swal-counter" id="supplementCount">0/200</em>
            </span>
        </label>
        <p class="registration-swal-field-error" id="unpublishReviewError" aria-live="polite"></p>
    </div>
      `,
      showCancelButton: true,
      confirmButtonText: '確認送出',
      cancelButtonText: '取消',
      reverseButtons: true,
      customClass: {
        popup: 'require-supplement-swal admin-unpublish-review-swal'
      },
      didOpen: () => {
        const textarea = document.getElementById('supplementReason') as HTMLTextAreaElement;
        const counter = document.getElementById('supplementCount');
        const agreeRadio = document.getElementById('agreeUnpublish') as HTMLInputElement;
        const disagreeRadio = document.getElementById('disagreeUnpublish') as HTMLInputElement;
        const approvalSection = document.querySelector<HTMLElement>('.admin-swal-unpublish-form-option-section');
        const reminder = document.querySelector<HTMLElement>('.registration-swal-field span i')
        const error = document.querySelector<HTMLElement>('.registration-swal-field-error');
        if (initialReason && textarea) {
          textarea.value = initialReason;
          if (counter) counter.textContent = `${initialReason.length}/200`;
        }
        textarea?.addEventListener('input', () => {
          if (counter) counter.textContent = `${textarea.value.length}/200`;
          if (error) {
            error.textContent = '';
          }
          textarea.classList.remove('is-invalid');
        });
        const updateReminderColor = () => {
          approvalSection?.classList.remove('is-invalid');
          reminder?.style.setProperty("color", disagreeRadio.checked ? "#ef4444" : "var(--text-normal)");
          reminder?.style.setProperty("font-weight", disagreeRadio.checked ? "600" : "500");
          if (error && agreeRadio.checked) {
            error.textContent = '';
          }
          if (agreeRadio.checked) {
            textarea?.classList.remove('is-invalid');
          }
        };
        agreeRadio?.addEventListener('change', updateReminderColor);
        disagreeRadio?.addEventListener('change', updateReminderColor);
      },
      preConfirm: () => {
        const textarea = document.getElementById('supplementReason') as HTMLTextAreaElement;
        const value = textarea?.value?.trim() ?? '';
        const agreeRadio = document.getElementById('agreeUnpublish') as HTMLInputElement;
        const disagreeRadio = document.getElementById('disagreeUnpublish') as HTMLInputElement;
        const approvalSection = document.querySelector<HTMLElement>('.admin-swal-unpublish-form-option-section');
        const error = document.querySelector<HTMLElement>('.registration-swal-field-error');

        if (disagreeRadio.checked && !value) {
          if (error) error.textContent = '請填寫審核說明';
          textarea?.classList.add('is-invalid');
          textarea?.focus();
          return false;
        }
        if (!agreeRadio.checked && !disagreeRadio.checked) {
          if (error) error.textContent = '請選擇審核結果';
          approvalSection?.classList.add('is-invalid');
          return false;
        }
        approvalSection?.classList.remove('is-invalid');
        textarea?.classList.remove('is-invalid');
        if (error) {
          error.textContent = '';
        }
        return { approved: agreeRadio.checked, reason: value };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    if (result.value.approved) {
      await this.handleUnpublishApproved();
    } else {
      await this.handleUnpublishRejected(result.value.reason);
    }
  }

  private async handleUnpublishApproved(): Promise<void> {
    if (!this.eventId) return;

    await this.runEventAction(
      this.adminApiService.confirmEventUnpublish(this.eventId),
      '審核通過',
      '活動已成功下架。<br />活動狀態更新為「已下架」，已通知主辦方。',
      '下架審核失敗',
    );
  }

  private async handleUnpublishRejected(reason: string): Promise<void> {
    const unpublishRequestId = this.detail?.unpublishRequestId;
    if (!unpublishRequestId) {
      await this.alert.error('下架審核失敗', '找不到下架申請單，請重新整理頁面。');
      return;
    }

    const escapedReason = this.escapeHtml(reason);

    await this.runEventAction(
      this.adminApiService.requestEventRevision(unpublishRequestId, { note: reason, isUnpublish: true }),
      '已駁回下架申請',
      `已駁回主辦方的下架申請。<br />活動狀態維持不變，已通知主辦方。<br /><br />審核說明：${escapedReason}`,
      '下架審核失敗',
    );
  }

  downloadImg = async (): Promise<void> => {
    const imageUrl = this.detail?.boothLayoutImage;
    if (!imageUrl) {
      await this.alert.error('下載失敗', '找不到攤位配置圖。');
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('圖片下載失敗');
      }

      const blob = await response.blob();
      const fileName = `${this.sanitizeFileName(this.detail?.activityInfo.name ?? '活動')}-攤位配置圖${this.resolveImageExtension(response, imageUrl)}`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      await this.alert.error('下載失敗', '攤位配置圖下載失敗，請稍後再試。');
    }
  };

  /** 依回應的 Content-Type 或網址副檔名判斷下載檔案的副檔名，皆判斷不到時預設為 .png */
  private resolveImageExtension(response: Response, imageUrl: string): string {
    const contentType = response.headers.get('Content-Type');
    const extensionByContentType: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    if (contentType && extensionByContentType[contentType]) {
      return extensionByContentType[contentType];
    }

    const match = imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    return match ? `.${match[1]}` : '.png';
  }

  /** 把檔名中作業系統不允許的字元替換掉，避免下載時因特殊符號失敗 */
  private sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  }







}

