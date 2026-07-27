import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AlertService } from '../../../../core/services/alert.service';
import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import {
  OrganizerPaymentDetailResponse,
  OrganizerPaymentEquipment,
  OrganizerPaymentFeeDetail,
  OrganizerPaymentPower,
} from '../../../../models/interface/organizer/OrganizerPayment';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { DepositStatus } from '../../../../models/status/DepositStatus';
import { PaymentStatus } from '../../../../models/status/PaymentStatus';
import { paymentMethodLabel } from '../../../../core/utils/payment-method.util';

interface DetailAction {
  key: 'approve-refund' | 'retry-refund';
  label: string;
  variant: 'primary' | 'outline' | 'danger';
}

interface StatusRecord { label: string; value: string; highlight?: boolean; }
interface InfoRow { label: string; value: string; accent?: boolean; type?: 'status' | 'amount'; statusClass?: string; }
interface SummaryRow extends InfoRow { type?: 'status' | 'amount'; }
interface FeeRow { item: string; content: string; amount: string; }
interface EquipmentRow { name: string; spec: string; quantity: string; unit?: string; price?: string; subtotal?: string; }
interface ElectricityRow { spec: string; power: string; price?: string; subtotal?: string; }

interface CollectionDetail {
  id: number;
  eventId: number;
  activityName: string;
  activityImage: string;
  activityStatus: string;
  activityDate: string;
  activityLocation: string;
  activityAddress: string;
  registrationStatus: string;
  paymentStatus: string;
  depositStatus?: string;
  registrationNo: string;
  paymentNo?: string;
  depositNo?: string;
  refundNo?: string;
  records: StatusRecord[];
  vendor: InfoRow[];
  brand: { name: string; type: string; image: string; description: string; };
  paymentInfo: InfoRow[];
  refundInfo?: InfoRow[];
  depositRefundInfo?: InfoRow[];
  feeRows: FeeRow[];
  refundRows?: FeeRow[];
  equipmentRows: EquipmentRow[];
  rentalRows: EquipmentRow[];
  electricityRows: ElectricityRow[];
  extraElectricityRows: ElectricityRow[];
  feeTotal: string;
  refundTotal?: string;
  rentalTotal: string;
  electricityTotal: string;
  actions?: DetailAction[];
}

@Component({
  selector: 'app-organizer-dashboard-collection-detail',
  imports: [RouterLink],
  templateUrl: './organizer-dashboard-collection-detail.html',
  styleUrl: './organizer-dashboard-collection-detail.scss',
})
/** 收款詳情頁，呈現費用明細並處理退款確認與退款付款重試。 */
export class OrganizerDashboardCollectionDetail implements OnInit {
  returnPage = 1;
  returnStatus = '';
  detail: CollectionDetail = this.emptyDetail();
  private applicationId = 0;
  private pendingAction = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly alert: AlertService,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 驗證報名 ID、還原返回條件，並載入收款詳情。 */
  ngOnInit(): void {
    this.applicationId = Number(this.route.snapshot.paramMap.get('id'));
    const pageFromUrl = Number(this.route.snapshot.queryParamMap.get('returnPage'));
    this.returnPage = Number.isInteger(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
    this.returnStatus = this.route.snapshot.queryParamMap.get('returnStatus') ?? '';
    this.pendingAction = this.route.snapshot.queryParamMap.get('action') ?? '';
    if (!Number.isInteger(this.applicationId) || this.applicationId <= 0) {
      void this.alert.error('收款詳情載入失敗', '報名 ID 不正確。').then(() => this.goBack());
      return;
    }
    this.loadDetail(true);
  }

  get registrationStatusClass(): string { return this.getStatusClass(this.detail.registrationStatus); }
  get paymentStatusClass(): string { return PaymentStatus.getClass(this.detail.paymentStatus); }
  get depositStatusClass(): string { return DepositStatus.getClass(this.detail.depositStatus ?? DepositStatus.pending); }
  get showDepositPendingReason(): boolean { return this.detail.depositStatus === DepositStatus.pending; }

  get paymentSummaryRows(): SummaryRow[] {
    return [
      { label: '付款狀態', value: this.detail.paymentStatus, type: 'status' },
      { label: '付款金額', value: this.detail.feeTotal, type: 'amount' },
      { label: '付款方式', value: this.getInfoValue(this.detail.paymentInfo, '付款方式') },
      { label: '付款編號', value: this.detail.paymentNo || this.getInfoValue(this.detail.paymentInfo, '付款交易編號') },
      { label: '金流平台', value: this.getInfoValue(this.detail.paymentInfo, '金流平台') },
    ];
  }

  get registrationSummaryRows(): InfoRow[] {
    return [
      { label: '報名編號', value: this.detail.registrationNo },
      { label: '報名狀態', value: this.detail.registrationStatus, type: 'status', statusClass: this.registrationStatusClass },
      { label: '活動名稱', value: this.detail.activityName },
      { label: '報名日期', value: this.registrationDate },
      { label: '攤主姓名', value: this.getInfoValue(this.detail.vendor, '攤主姓名') },
      { label: '品牌名稱', value: this.detail.brand.name },
    ];
  }

  get registrationDate(): string { return this.detail.records[0]?.value ?? '-'; }

  get activityDateRange(): string {
    const dates = this.detail.activityDate.match(/\d{4}\/\d{2}\/\d{2}/g);
    return dates && dates.length >= 2 ? `${dates[0]} - ${dates[1]}` : this.detail.activityDate;
  }

  viewRegistrationDetail(): void {
    this.router.navigate(['/organizer/dash-board/register/detail', this.detail.id]);
  }

  viewActivityDetail(): void {
    this.router.navigate(['/organizer/dash-board/activity/detail', this.detail.eventId]);
  }

  goBack(): void {
    this.router.navigate(['/organizer/dash-board/collection'], {
      queryParams: { page: this.returnPage, status: this.returnStatus || null },
    });
  }

  /** 處理退款確認或付款重試，成功後重新取得最新交易狀態。 */
  async handleAction(action: DetailAction): Promise<void> {
    const isRetry = action.key === 'retry-refund';
    const refundNo = this.detail.refundNo;
    if (!refundNo) {
      await this.alert.error('無法執行退款', '找不到退款編號，請重新整理頁面後再試。');
      return;
    }

    const confirmed = await this.alert.confirmHtml({
      html: this.getRefundConfirmHtml(isRetry),
      confirmButtonText: isRetry ? '確認重試' : '確認同意',
      cancelButtonText: '取消',
      popupClass: 'registration-action-swal collection-refund-swal',
      allowOutsideClick: false,
    });
    if (!confirmed) return;

    try {
      const response = await firstValueFrom(
        isRetry
          ? this.organizerApi.retryOrganizerRefundPayment(refundNo)
          : this.organizerApi.reviewOrganizerRefund(refundNo),
      );
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('退款執行失敗', response.message || '請稍後再試。');
        await this.loadDetail(false);
        return;
      }
      await this.loadDetail(false);
      await this.alert.successHtml({
        html: this.getRefundSuccessHtml(),
        confirmButtonText: '我知道了',
        popupClass: 'registration-result-swal collection-refund-swal',
        showCloseButton: true,
      });
    } catch (error: unknown) {
      await this.loadDetail(false);
      await this.alert.error(
        '退款金流執行失敗',
        `${this.getApiErrorMessage(error)}。系統已保留失敗狀態，可稍後使用「重試退款」。`,
      );
    }
  }

  /** 載入付款詳情；必要時在資料就緒後接續執行網址指定的待辦操作。 */
  private loadDetail(runPendingAction: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.organizerApi.getOrganizerPaymentDetail(this.applicationId).subscribe({
        next: (response) => {
          if (!isApiSuccessStatus(response.statusCode) || !response.data) {
            void this.alert.error('收款詳情載入失敗', response.message || '請稍後再試。');
            resolve();
            return;
          }
          this.detail = this.toCollectionDetail(response.data);
          const requestedAction = this.pendingAction;
          this.pendingAction = '';
          if (requestedAction) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { action: null },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
          if (runPendingAction && requestedAction === 'refund-confirm') {
            void this.handleAction({ key: 'approve-refund', label: '同意退款', variant: 'primary' });
          } else if (runPendingAction && requestedAction === 'retry-refund') {
            void this.handleAction({ key: 'retry-refund', label: '重試退款', variant: 'primary' });
          }
          resolve();
        },
        error: () => {
          void this.alert.error('收款詳情載入失敗', '目前無法取得收款資料，請稍後再試。');
          resolve();
        },
      });
    });
  }

  /** 將付款、設備、用電與退款資料組合成畫面詳情模型。 */
  private toCollectionDetail(data: OrganizerPaymentDetailResponse): CollectionDetail {
    const feeRows = data.feeDetails.map((row) => this.toFeeRow(row));
    const refundRows = data.refundDetails?.map((row) => this.toFeeRow(row));
    const rentalRows = data.rentalEquipments.map((row) => this.toEquipmentRow(row, true));
    const extraElectricityRows = data.extraPower.map((row) => this.toPowerRow(row, true));
    const paymentStatus = data.application.paymentStatus || '-';
    const refundStatus = data.refund?.refundStatus || '';

    return {
      id: data.application.applicationId,
      eventId: data.event.eventId,
      activityName: data.event.eventTitle || '-',
      activityImage: data.event.eventCoverImageUrl || 'assets/images/market/cards/market-card-01.png',
      activityStatus: data.event.eventStatus || '-',
      activityDate: [data.event.eventDate, data.event.eventTime].filter(Boolean).join(' '),
      activityLocation: data.event.locationName || '-',
      activityAddress: data.event.address || '-',
      registrationStatus: data.application.applicationStatus || '-',
      paymentStatus,
      registrationNo: data.application.applicationNo || '-',
      paymentNo: data.application.paymentNo || undefined,
      refundNo: data.refund?.refundTradeNo || undefined,
      records: data.statusRecords
        .filter((record) => record.createdAt)
        .map((record) => ({
          label: record.label,
          value: this.formatDateTime(record.createdAt),
          highlight: record.value?.includes('失敗') ?? false,
        })),
      vendor: [
        { label: '攤主姓名', value: data.vendor.vendorName || '-' },
        { label: '聯絡電話', value: data.vendor.phone || '-' },
        { label: '電子郵件', value: data.vendor.email || '-' },
        { label: '聯絡地址', value: data.vendor.address || '-' },
      ],
      brand: {
        name: data.brand.brandName || '-',
        type: data.brand.category || '-',
        image: data.brand.avatarImageUrl || 'assets/images/user/brand/default-logo.png',
        description: data.brand.introduction || '-',
      },
      paymentInfo: [
        { label: '付款方式', value: paymentMethodLabel(data.payment.paymentMethod) },
        { label: '金流平台', value: paymentMethodLabel(data.payment.paymentPlatform) },
        { label: '付款交易編號', value: data.payment.paymentTradeNo || '-' },
      ],
      refundInfo: data.refund ? [
        { label: '退款狀態', value: data.refund.refundStatus || '-' },
        { label: '退款方式', value: paymentMethodLabel(data.refund.refundMethod, '原付款方式退回') },
        { label: '金流平台', value: paymentMethodLabel(data.refund.paymentPlatform) },
        { label: '退款編號', value: data.refund.refundTradeNo || '-' },
      ] : undefined,
      feeRows,
      refundRows,
      equipmentRows: data.basicEquipments.map((row) => this.toEquipmentRow(row, false)),
      rentalRows,
      electricityRows: data.basicPower.map((row) => this.toPowerRow(row, false)),
      extraElectricityRows,
      feeTotal: this.getTotal(data.feeDetails),
      refundTotal: data.refundDetails ? this.getTotal(data.refundDetails) : undefined,
      rentalTotal: this.sumSubtotal(data.rentalEquipments),
      electricityTotal: this.sumSubtotal(data.extraPower),
      actions: paymentStatus === PaymentStatus.refundRequested || refundStatus === PaymentStatus.refundRequested
        ? [{ key: 'approve-refund', label: '同意退款', variant: 'primary' }]
        : paymentStatus === PaymentStatus.refundFailed || refundStatus === PaymentStatus.refundFailed
          ? [{ key: 'retry-refund', label: '重試退款', variant: 'primary' }]
          : undefined,
    };
  }

  private toFeeRow(row: OrganizerPaymentFeeDetail): FeeRow {
    return { item: row.item || '-', content: row.content || '-', amount: this.formatMoney(row.amount) };
  }

  private toEquipmentRow(row: OrganizerPaymentEquipment, paid: boolean): EquipmentRow {
    return {
      name: row.equipmentName || '-',
      spec: row.specification || '-',
      quantity: this.displayValue(row.quantity),
      unit: row.unit || '-',
      price: paid ? this.formatMoney(row.unitPrice) : undefined,
      subtotal: paid ? this.formatMoney(row.subtotal) : undefined,
    };
  }

  private toPowerRow(row: OrganizerPaymentPower, paid: boolean): ElectricityRow {
    return {
      spec: row.powerSpecification || '-',
      power: row.wattage == null ? '-' : `${row.wattage}W`,
      price: paid ? this.formatMoney(row.unitPrice) : undefined,
      subtotal: paid ? this.formatMoney(row.subtotal) : undefined,
    };
  }

  private getTotal(rows: OrganizerPaymentFeeDetail[]): string {
    return this.formatMoney(rows.at(-1)?.amount ?? 0);
  }

  private sumSubtotal(rows: Array<OrganizerPaymentEquipment | OrganizerPaymentPower>): string {
    const total = rows.reduce((sum, row) => sum + (Number(row.subtotal) || 0), 0);
    return this.formatMoney(total);
  }

  private formatMoney(value: number | string | null | undefined): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? `$${amount.toLocaleString('zh-TW')}` : '-';
  }

  private displayValue(value: number | string | null | undefined): string {
    return value == null || value === '' ? '-' : String(value);
  }

  private formatDateTime(value: string | null): string {
    return value ? value.replace('T', ' ').replaceAll('-', '/').slice(0, 16) : '-';
  }

  private getStatusClass(status: string): string {
    return PaymentStatus.classMap[status] ?? ApplicationStatus.getClass(status);
  }

  private getInfoValue(rows: InfoRow[] | undefined, label: string): string {
    return rows?.find((row) => row.label === label)?.value || '-';
  }

  private getApiErrorMessage(error: unknown): string {
    const apiError = error as { error?: { message?: string; messageDetails?: string }; message?: string };
    return apiError.error?.messageDetails || apiError.error?.message || apiError.message || '請稍後再試';
  }

  private getRefundConfirmHtml(isRetry: boolean): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon warning"><i class="bi bi-exclamation-lg"></i></div>
        <h3>${isRetry ? '重試退款金流' : '確認同意退款'}</h3>
        <p class="registration-swal-main">${isRetry ? '確認重新執行此筆退款嗎？' : '確認同意此筆退款申請嗎？'}</p>
        <p class="registration-swal-sub">確認後系統會立即送出藍新退款交易，請勿重複操作。</p>
      </div>`;
  }

  private getRefundSuccessHtml(): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon success"><i class="bi bi-check-lg"></i></div>
        <h3>退款金流已完成</h3>
        <p class="registration-swal-main">藍新退款交易已成功送出並完成。</p>
        <p class="registration-swal-sub">收款狀態與退款紀錄已更新。</p>
      </div>`;
  }

  private emptyDetail(): CollectionDetail {
    return {
      id: 0, eventId: 0, activityName: '-', activityImage: '', activityStatus: '-', activityDate: '-',
      activityLocation: '-', activityAddress: '-', registrationStatus: '-', paymentStatus: '-',
      registrationNo: '-', records: [], vendor: [], brand: { name: '-', type: '-', image: '', description: '-' },
      paymentInfo: [], feeRows: [], equipmentRows: [], rentalRows: [], electricityRows: [],
      extraElectricityRows: [], feeTotal: '$0', rentalTotal: '$0', electricityTotal: '$0',
    };
  }
}
