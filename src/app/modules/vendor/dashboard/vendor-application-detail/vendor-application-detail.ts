import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  ApplicationDetail,
  ApplicationStatus,
  DetailRow,
} from '../../../../models/interface/vendor/VendorApplicationDetail';
import type { MarketCardItem } from '../../../../models/interface/shared/MarketCardItem';
import { AlertService } from '../../../../core/services/alert.service';
import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { MarketStatus } from '../../../../models/status/MarketStatus';
import { VendorStatus } from '../../../../models/status/VendorStatus';
import type { VendorApplicationApiDetail } from '../../../../models/interface/vendor/VendorApplicationApiDetail';
import { paymentMethodLabel } from '../../../../core/utils/payment-method.util';

@Component({
  selector: 'app-vendor-application-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './vendor-application-detail.html',
  styleUrl: './vendor-application-detail.scss',
})
export class VendorApplicationDetail implements OnInit {
  readonly vendorStatus = VendorStatus;
  /** 詳情 API 使用的報名 ID，由清單的「查看」連結帶入。 */
  currentApplicationId = 0;

  /** 報名編號供付款與選位路由繼續使用。 */
  currentApplicationNo = '';

  /** API 回傳前使用空資料模型，讓樣板可安全繫結。 */
  detail: ApplicationDetail = createEmptyApplicationDetail();
  market: MarketCardItem = createEmptyMarket();
  eventDateText = '';
  isLoading = true;
  isCancelling = false;
  isRequestingRefund = false;
  loadError = '';

  refundReason = '';
  refundMethod = '';
  marketWorkflowStatus = '';
  private marketWorkflowLoaded = false;

  /** 下列明細均由詳情 API 的 equipmentRentals、stall 與 feedetail 轉換。 */
  basicEquipment: Array<{ name: string; spec: string; quantity: number; unit: string }> = [];
  rentalEquipment: Array<{
    name: string;
    spec: string;
    quantity: number;
    price: string;
    subtotal: string;
  }> = [];
  basicPower: Array<{ specification: string; wattage: string; price: string; subtotal: string }> = [];
  extraPower: Array<{ voltage: string; wattage: string; price: string; subtotal: string }> = [];
  boothAssignments: Array<{
    date: string;
    number: string;
    zone: string;
    selectedAt: string;
  }> = [];
  feeBreakdown: Array<{ label: string; content: string; amount: string }> = [];
  equipmentSubtotal = formatCurrency(0);
  extraPowerSubtotal = formatCurrency(0);
  totalFee = formatCurrency(0);
  refundableAmount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private readonly vendorDashboardService: VendorDashboardService,
  ) {}

  /** 讀取路由中的 applicationId，並向 StallController 取得詳情。 */
  ngOnInit(): void {
    const routeApplicationId = Number(this.route.snapshot.paramMap.get('id'));
    const queryApplicationId = Number(this.route.snapshot.queryParamMap.get('applicationId'));
    const applicationId =
      Number.isInteger(routeApplicationId) && routeApplicationId > 0
        ? routeApplicationId
        : queryApplicationId;
    if (!Number.isInteger(applicationId) || applicationId < 1) {
      this.isLoading = false;
      this.loadError = '報名 ID 不正確，無法載入報名詳情。';
      return;
    }

    this.currentApplicationId = applicationId;
    this.loadApplicationDetail(applicationId);
  }

  get marketUnpublishPending(): boolean {
    return this.marketWorkflowLoaded
      ? this.marketWorkflowStatus === 'UNPUBLISH_REQUESTED'
      : Boolean(this.detail.marketUnpublishPending);
  }

  get marketUnpublished(): boolean {
    return this.marketWorkflowStatus === 'UNPUBLISHED';
  }

  /** 目前展示的報名狀態。 */
  get currentStatus(): ApplicationStatus {
    return this.detail.status;
  }

  /** 原因使用獨立區塊呈現；尚未完成的節點不顯示於狀態流程卡。 */
  get statusProgress() {
    return this.detail.progress.filter(
      (step) => !this.isReasonLabel(step.label) && step.value !== '尚未完成',
    );
  }

  /** 取消／退款原因統一顯示於狀態紀錄下方。 */
  get statusReason(): {
    label: '取消原因' | '退款原因';
    title: string;
    description: string | null;
  } | null {
    const cancellationReason = this.detail.progress.find(
      (step) => step.label === '取消原因',
    )?.value;

    if (cancellationReason) {
      return this.createStatusReason('取消原因', cancellationReason);
    }

    if (this.detail.sideCard.type !== 'refund') {
      return null;
    }

    const storedReason = this.detail.sideCard.rows.find((row) =>
      this.isReasonLabel(row.label),
    )?.value;
    const reason = this.refundReason.trim() || storedReason?.trim();

    return reason ? this.createStatusReason('退款原因', reason) : null;
  }

  /** 退款原因已移至狀態紀錄，退款資訊卡不再重複顯示。 */
  get sideCardRows(): DetailRow[] {
    return this.detail.sideCard.rows.filter((row) => !this.isReasonLabel(row.label));
  }

  private isReasonLabel(label: string): boolean {
    return ['取消原因', '退款原因', '退款申請原因'].includes(label);
  }

  private createStatusReason(
    label: '取消原因' | '退款原因',
    value: string,
  ): { label: '取消原因' | '退款原因'; title: string; description: string | null } {
    const [firstPart, ...remainingParts] = value.split(/[，,]/);
    const title = firstPart.trim().replace(/^因/, '') || value.trim();
    const description = remainingParts.join('，').trim();

    return {
      label,
      title,
      description: description || null,
    };
  }

  getHeaderActionIcon(action: string): string {
    const iconMap: Record<string, string> = {
      requestRefund: 'bi-arrow-counterclockwise',
      payment: 'bi-credit-card',
      pay: 'bi-credit-card',
      selectBooth: 'bi-geo-alt',
      booth: 'bi-geo-alt',
    };

    return iconMap[action] ?? 'bi-check-circle';
  }

  getStatusValueClass(statusText: string): string | null {
    const statusClassMap: Record<string, string> = {
      待審核: 'reviewing',
      待付款: 'payment',
      已付款: 'completed',
      報名完成: 'completed',
      待選位: 'booth',
      保證金已退還: 'deposit-refunded',
      退款申請中: 'refund-applying',
      退款處理中: 'refund-processing',
      已退款: 'refunded',
      已取消: 'history',
    };

    return statusClassMap[statusText.trim()] ?? null;
  }

  /** API 操作成功後先同步畫面狀態，接著重新載入後端詳情。 */
  setStatus(status: ApplicationStatus): void {
    const display = getApplicationStatusDisplay(status);
    this.detail = {
      ...this.detail,
      status,
      statusText: display.statusText,
      statusClass: display.statusClass,
    };
  }

  /** 調用攤主報名詳情 API，並統一處理業務失敗與網路錯誤。 */
  private loadApplicationDetail(applicationId: number): void {
    this.isLoading = true;
    this.loadError = '';
    this.vendorDashboardService.getVendorApplicationDetail(applicationId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!isApiSuccessStatus(response.statusCode)) {
          this.loadError = response.message;
          void this.alert.error('報名詳情載入失敗', response.message);
          return;
        }

        this.applyApiDetail(response.data);
        this.loadVendorStallMap(response.data);
      },
      error: () => {
        this.isLoading = false;
        this.loadError = '無法連線至伺服器，請稍後再試。';
        void this.alert.error('報名詳情載入失敗', this.loadError);
      },
    });
  }

  /** 將後端詳情結構轉成現有樣板所使用的顯示模型。 */
  private applyApiDetail(api: VendorApplicationApiDetail): void {
    const statusDisplay = mapApiApplicationStatus(api.application.applicationStatus);
    const image = api.event.eventCoverImageUrl ?? '';
    const selectedStalls = api.stall.filter((stall) => Boolean(stall.stallNo));
    const hasRefund = Boolean(api.refund.refundStatus);

    this.currentApplicationId = api.application.applicationId;
    this.currentApplicationNo = api.application.applicationNo;
    this.refundMethod = paymentMethodLabel(api.refund.refundMethod || api.fee.paymentMethod, '');
    this.marketWorkflowStatus = api.event.workflowStatus
      ?? (api.event.unpublished ? 'UNPUBLISHED' : api.event.unpublishRequested ? 'UNPUBLISH_REQUESTED' : '');
    this.marketWorkflowLoaded = Boolean(
      api.event.workflowStatus || api.event.unpublished || api.event.unpublishRequested,
    );
    this.eventDateText = api.event.eventTime;
    this.market = {
      id: String(api.event.eventId),
      title: api.event.eventTitle,
      time: '',
      start_date: api.event.eventStartAt?.slice(0, 10) ?? '',
      end_date: api.event.eventEndAt?.slice(0, 10) ?? '',
      description: '',
      location: api.event.locationName,
      address: api.event.address,
      city: '',
      area: '',
      image,
      status: api.event.eventStatus,
      statusClass: MarketStatus.getClass(api.event.eventStatus),
      tags: [],
      category: api.brand.categoryName ?? '',
      organizer: '',
      transportation: [],
    };

    const applicationRows: DetailRow[] = [
      {
        label: '報名場次',
        value: formatRegistrationPeriods(api.applicationdetail.registrationPeriods),
      },
      {
        label: '攤位尺寸',
        value: api.applicationdetail.width && api.applicationdetail.length
          ? `${api.applicationdetail.width} × ${api.applicationdetail.length} 公尺`
          : '-',
      },
      { label: '攤位分區', value: displayValue(api.applicationdetail.stallZone) },
      { label: '攤位類別', value: displayValue(api.applicationdetail.stallCategory) },
      { label: '車牌號碼', value: displayValue(api.applicationdetail.vehicleNo) },
      { label: '備註', value: displayValue(api.applicationdetail.applicantNote) },
    ];
    const paymentRows = createPaymentRows(api);
    const refundRows = createRefundRows(api);
    // 狀態紀錄固定呈現完整流程；尚未發生的步驟也保留位置，方便攤主掌握進度。
    const statusProgress = createStatusProgress(api.status);
    const boothSelected = selectedStalls.length > 0;
    const boothActionLabel = boothSelected
      ? '查看攤位地圖'
      : statusDisplay.status === 'booth'
        ? '選擇攤位'
        : undefined;

    this.detail = {
      status: statusDisplay.status,
      statusText: api.application.applicationStatus,
      statusClass: statusDisplay.statusClass,
      title: api.event.eventTitle,
      applicationNo: api.application.applicationNo,
      dateRange: api.event.eventTime,
      location: api.event.locationName,
      image,
      progress: statusProgress,
      applicationRows,
      paymentRows,
      paymentLines: [],
      paymentEmptyTitle: '尚未產生付款資訊',
      paymentEmptyText: '審核通過後將顯示付款明細。',
      booth: {
        selected: boothSelected,
        rows: [],
        actionLabel: boothActionLabel,
        emptyTitle: '尚未選擇攤位',
        emptyText: '完成付款後，即可進行攤位選擇。',
      },
      sideCard: hasRefund
        ? {
            type: 'refund',
            title: '退款資訊',
            icon: 'bi-bank',
            rows: refundRows,
          }
        : {
            type: 'booth',
            title: '攤位資訊',
            icon: 'bi-shop',
            rows: [],
          },
      actionButton: ['completed', 'booth'].includes(statusDisplay.status)
        ? { label: '申請退款', action: 'requestRefund' }
        : undefined,
    };

    // 設備、用電、攤位與費用表格直接使用 API 明細，不再保留固定金額。
    this.basicEquipment = api.equipmentRentals.freeEquipments.map((item) => ({
      name: item.equipmentName,
      spec: displayValue(item.specification),
      quantity: item.quantity,
      unit: displayValue(item.unit),
    }));
    this.rentalEquipment = api.equipmentRentals.rentalEquipments.map((item) => ({
      name: item.equipmentName,
      spec: displayValue(item.specification),
      quantity: item.quantity,
      price: formatEquipmentRentalFee(item),
      subtotal: formatCurrency(item.total ?? item.subtotal),
    }));
    this.basicPower = api.equipmentRentals.freeBasicPower.map((item) => ({
      specification: item.powerSpecification,
      wattage: item.wattage == null ? '-' : `${item.wattage}W`,
      price: '免費',
      subtotal: formatCurrency(item.subtotal),
    }));
    this.extraPower = api.equipmentRentals.extraPower.map((item) => ({
      voltage: item.powerSpecification,
      wattage: item.wattage == null ? '-' : `${item.wattage}W`,
      price: item.unitPrice == null
        ? '-'
        : `${formatCurrency(item.unitPrice)}${item.unit ? ` / ${item.unit}` : ''}`,
      subtotal: formatCurrency(item.total ?? item.subtotal),
    }));
    this.boothAssignments = selectedStalls.map((stall) => ({
      date: stall.applyDate,
      number: displayValue(stall.stallNo),
      zone: displayValue(stall.zoneName),
      selectedAt: '',
    }));
    this.feeBreakdown = api.feedetail
      .filter((item) => item.item !== '總計')
      .map((item) => ({
        label: item.item,
        content: displayValue(item.content),
        amount: formatCurrency(item.amount),
      }));
    this.equipmentSubtotal = formatCurrency(sumAmounts(
      api.equipmentRentals.rentalEquipments.map((item) => item.total ?? item.subtotal),
    ));
    this.extraPowerSubtotal = formatCurrency(sumAmounts(
      api.equipmentRentals.extraPower.map((item) => item.total ?? item.subtotal),
    ));
    this.totalFee = formatCurrency(
      api.feedetail.find((item) => item.item === '總計')?.amount ?? api.fee.paymentAmount,
    );
    const paidAmount = api.fee.paymentAmount
      ?? api.feedetail.find((item) => item.item === '總計')?.amount
      ?? 0;
    const depositAmount = api.feedetail
      .filter((item) => item.item.includes('保證金'))
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    this.refundableAmount = Math.max(0, paidAmount - depositAmount);
  }

  /** 以選位地圖 API 的已選攤位資料更新 booth-information 區塊。 */
  private loadVendorStallMap(api: VendorApplicationApiDetail): void {
    const canViewStallMap = ['booth', 'completed', 'depositRefunded'].includes(
      this.currentStatus,
    ) || api.stall.some((stall) => Boolean(stall.stallNo));

    if (!canViewStallMap || !this.currentApplicationNo) {
      return;
    }

    this.vendorDashboardService.getVendorStallMap(this.currentApplicationNo).subscribe({
      next: (response) => {
        if (!isApiSuccessStatus(response.statusCode)) {
          return;
        }

        this.boothAssignments = response.data.application.selectedStalls.map((stall) => ({
          date: stall.applyDate,
          number: displayValue(stall.stallNo),
          zone: displayValue(stall.zoneName),
          selectedAt: '',
        }));

        this.detail = {
          ...this.detail,
          booth: {
            ...this.detail.booth,
            selected: this.boothAssignments.length > 0,
          },
        };
      },
      // 詳情 API 已提供可顯示的攤位資料；地圖 API 失敗時保留原資料。
      error: () => undefined,
    });
  }

  /** 執行頁面主要操作。 */
  async handleAction(action: string): Promise<void> {
    if (action !== 'requestRefund' || this.isRequestingRefund) {
      return;
    }

    const reason = await this.requestRefundReason();

    if (!reason) {
      return;
    }

    const confirmed = await this.openRefundConfirm(reason);

    if (!confirmed) {
      return;
    }

    this.isRequestingRefund = true;
    try {
      const response = await firstValueFrom(
        this.vendorDashboardService.requestVendorRefund({
          applicationNo: this.currentApplicationNo,
          reason,
        }),
      );

      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('退款申請失敗', response.message || '請稍後再試。');
        return;
      }

      this.refundReason = reason;
      this.setStatus('refundApplying');
      this.detail = { ...this.detail, actionButton: undefined };
      await this.openRefundSuccess();
      this.loadApplicationDetail(this.currentApplicationId);
    } catch (error) {
      await this.alert.error('退款申請失敗', this.getApiErrorMessage(error));
    } finally {
      this.isRequestingRefund = false;
    }
  }

  /** 待審核、待付款狀態取消報名前的二次確認。 */
  async cancelRegistration(): Promise<void> {
    if (this.isCancelling) {
      return;
    }

    const confirmed = await this.alert.confirmNotice({
      title: '確認取消報名？',
      description: '取消報名後，將失去本次活動報名資格。請確認是否要取消報名。',
      noticeItems: [
        '取消報名後將無法恢復。',
        '若要再次參加活動，需重新報名。',
        '請確認後再送出申請。',
      ],
      confirmButtonText: '確認取消報名',
      cancelButtonText: '取消',
    });

    if (!confirmed) {
      return;
    }

    this.isCancelling = true;

    try {
      const response = await firstValueFrom(
        this.vendorDashboardService.cancelVendorApplication(this.currentApplicationId),
      );

      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('取消報名失敗', response.message || '請稍後再試。');
        return;
      }

      this.setStatus('cancelled');
      await this.alert.success(
        '取消報名成功',
        '本次活動報名已取消，您可於「我的報名紀錄」中查看紀錄。',
        '確認',
      );
    } catch (error) {
      await this.alert.error('取消報名失敗', this.getApiErrorMessage(error));
    } finally {
      this.isCancelling = false;
    }
  }

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message ?? error.message ?? '無法連線至伺服器，請稍後再試。';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return '無法連線至伺服器，請稍後再試。';
  }

  /** 進入獨立付款頁，並以報名編號載入對應的付款資料。 */
  payNow(): void {
    this.router.navigate([
      '/vendor/dash-board/application-record/detail',
      this.currentApplicationNo,
      'payment',
    ], { queryParams: { applicationId: this.currentApplicationId } });
  }

  openBoothPage(): void {
    const viewOnly = this.detail.booth.selected || this.detail.booth.actionLabel === '查看攤位地圖';

    this.router.navigate([
      '/vendor/dash-board/application-record/detail',
      this.currentApplicationNo,
      'booth',
    ], {
      queryParams: viewOnly
        ? {
            applicationId: this.currentApplicationId,
            mode: 'view',
            dates: this.boothAssignments.map((booth) => booth.date).join(','),
            selectedAt: this.boothAssignments.map((booth) => booth.selectedAt).join(','),
          }
        : { applicationId: this.currentApplicationId },
    });
  }

  /** 先要求填寫退款原因，未填寫不可進入確認步驟。 */
  private requestRefundReason(): Promise<string | null> {
    return this.alert.requiredReason({
      title: '填寫退款原因',
      description: '請說明本次申請退款的原因，送出前仍可於下一步再次確認。',
      fieldLabel: '退款原因',
      placeholder: '請輸入退款原因',
      confirmButtonText: '下一步',
      cancelButtonText: '取消',
      maxLength: 255,
      summaryItems: [
        {
          label: '退款金額',
          value: formatCurrency(this.refundableAmount),
          note: '（保證金不退還）',
          highlight: true,
        },
        {
          label: '退款方式',
          value: displayValue(this.refundMethod),
        },
      ],
    });
  }

  /** 顯示第二次確認，確認原因與退款方式後才送出申請。 */
  private openRefundConfirm(reason: string): Promise<boolean> {
    return this.alert.confirmReason({
      title: '確認申請退款？',
      description: '申請退款後，主辦單位將進行審核與處理；送出申請後將無法撤回。',
      subjectLabel: '退款方式',
      subject: displayValue(this.refundMethod),
      summaryItems: [
        {
          label: '退款金額',
          value: formatCurrency(this.refundableAmount),
          note: '（保證金不退還）',
          highlight: true,
        },
      ],
      reasonLabel: '退款原因',
      reason,
      noticeItems: [
        '保證金不退還。',
        '退款完成時間依您的發卡銀行或付款平台作業時間為準。',
        '退款審核結果與退款完成後，將於「通知中心」中通知您。',
      ],
      allowOutsideClick: true,
      confirmButtonText: '確認申請退款',
      cancelButtonText: '返回修改',
    });
  }

  /** 顯示退款申請送出成功視窗。 */
  private openRefundSuccess(): Promise<unknown> {
    return this.alert.success(
      '退款申請已送出！',
      '主辦單位將進行審核與處理，退款進度可於「我的報名紀錄」中查看。',
      '確認',
    );
  }

}

/** 將 API 中文狀態對應到現有詳情頁狀態與 CSS class。 */
function mapApiApplicationStatus(statusText: string): {
  status: ApplicationStatus;
  statusClass: string;
} {
  const statusMap: Record<string, { status: ApplicationStatus; statusClass: string }> = {
    待審核: { status: 'reviewing', statusClass: 'reviewing' },
    待付款: { status: 'payment', statusClass: 'payment' },
    待選位: { status: 'booth', statusClass: 'booth' },
    報名完成: { status: 'completed', statusClass: 'completed' },
    保證金已退還: { status: 'depositRefunded', statusClass: 'deposit-refunded' },
    退款申請中: { status: 'refundApplying', statusClass: 'refund-applying' },
    退款處理中: { status: 'refundProcessing', statusClass: 'refund-processing' },
    已退款: { status: 'refunded', statusClass: 'refunded' },
    已取消: { status: 'cancelled', statusClass: 'history' },
    審核未通過: { status: 'cancelled', statusClass: 'history' },
  };

  return statusMap[statusText] ?? statusMap['待審核'];
}

/** 本地操作暫時更新狀態時使用的顯示文字。 */
function getApplicationStatusDisplay(status: ApplicationStatus): {
  statusText: string;
  statusClass: string;
} {
  const displayMap: Record<ApplicationStatus, { statusText: string; statusClass: string }> = {
    reviewing: { statusText: '待審核', statusClass: 'reviewing' },
    payment: { statusText: '待付款', statusClass: 'payment' },
    completed: { statusText: '報名完成', statusClass: 'completed' },
    depositRefunded: { statusText: '保證金已退還', statusClass: 'deposit-refunded' },
    cancelled: { statusText: '已取消', statusClass: 'history' },
    refunded: { statusText: '已退款', statusClass: 'refunded' },
    refundApplying: { statusText: '退款申請中', statusClass: 'refund-applying' },
    refundProcessing: { statusText: '退款處理中', statusClass: 'refund-processing' },
    refundSuccess: { statusText: '退款申請', statusClass: 'refund-applying' },
    booth: { statusText: '待選位', statusClass: 'booth' },
  };
  return displayMap[status];
}

/** 依後端付款資料建立畫面欄位，空值不顯示。 */
function createPaymentRows(api: VendorApplicationApiDetail): DetailRow[] {
  return [
    api.fee.paymentStatus
      ? { label: '付款狀態', value: api.fee.paymentStatus, highlight: true }
      : null,
    api.fee.paymentMethod
      ? { label: '付款方式', value: paymentMethodLabel(api.fee.paymentMethod) }
      : null,
    api.fee.paymentNo ? { label: '付款編號', value: api.fee.paymentNo } : null,
    api.fee.providerTradeNo
      ? { label: '交易編號', value: api.fee.providerTradeNo }
      : null,
    api.fee.paidAt ? { label: '付款時間', value: api.fee.paidAt } : null,
    api.fee.paymentAmount != null
      ? { label: '付款金額', value: formatCurrency(api.fee.paymentAmount), highlight: true }
      : null,
  ].filter((row): row is DetailRow => row !== null);
}

/** 依後端退款資料建立右側退款資訊卡。 */
function createRefundRows(api: VendorApplicationApiDetail): DetailRow[] {
  return [
    api.refund.refundStatusText
      ? { label: '退款狀態', value: api.refund.refundStatusText, highlight: true }
      : null,
    api.refund.refundMethod
      ? { label: '退款方式', value: paymentMethodLabel(api.refund.refundMethod) }
      : null,
    api.refund.refundNo ? { label: '退款編號', value: api.refund.refundNo } : null,
    api.refund.refundAmount != null
      ? { label: '退款金額', value: formatCurrency(api.refund.refundAmount), highlight: true }
      : null,
    api.refund.refundedAt ? { label: '退款時間', value: api.refund.refundedAt } : null,
  ].filter((row): row is DetailRow => row !== null);
}

const STATUS_PROGRESS_DEFINITIONS: ReadonlyArray<{
  label: string;
  keys: readonly string[];
  labels: readonly string[];
}> = [
  { label: '報名日期', keys: ['APPLIED', 'REGISTERED'], labels: ['報名日期', '報名時間'] },
  { label: '審核時間', keys: ['REVIEWED', 'APPROVED', 'REJECTED'], labels: ['審核時間'] },
  { label: '取消時間', keys: ['CANCELLED', 'CANCELED'], labels: ['取消時間', '已取消時間'] },
  { label: '付款時間', keys: ['PAID', 'PAYMENT_COMPLETED'], labels: ['付款時間'] },
  {
    label: '退款申請時間',
    keys: ['REFUND_REQUESTED'],
    labels: ['退款申請時間'],
  },
  {
    label: '退款審核時間',
    keys: ['REFUND_REVIEWED', 'REFUND_APPROVED', 'REFUND_REJECTED'],
    labels: ['退款審核時間'],
  },
  {
    label: '已退款時間',
    keys: ['REFUNDED', 'REFUND_COMPLETED'],
    labels: ['已退款時間', '退款時間'],
  },
  {
    label: '選位時間',
    keys: ['BOOTH_SELECTED', 'STALL_SELECTED', 'SELECTED'],
    labels: ['選位時間', '攤位選擇時間'],
  },
  {
    label: '保證金退還時間',
    keys: ['DEPOSIT_RETURNED', 'DEPOSIT_REFUNDED'],
    labels: ['保證金退還時間', '保證金退還', '保證金完成時間'],
  },
];

/** 將後端可能缺項或名稱略異的紀錄，整理成畫面固定的九個時間節點。 */
function createStatusProgress(
  steps: VendorApplicationApiDetail['status'],
): DetailRow[] {
  const timeline = STATUS_PROGRESS_DEFINITIONS.map((definition) => {
    const step = steps.find((candidate) => {
      const normalizedKey = candidate.key.trim().toUpperCase();
      const normalizedLabel = candidate.label.trim();
      return definition.keys.includes(normalizedKey) || definition.labels.includes(normalizedLabel);
    });

    return {
      label: definition.label,
      value: formatDateTime(step?.createdAt),
    };
  });
  const reasons = steps
    .filter((step) => ['取消原因', '退款原因', '退款申請原因'].includes(step.label.trim()))
    .filter((step) => Boolean(step.value?.trim()))
    .map((step) => ({ label: step.label.trim(), value: step.value!.trim() }));

  return [...timeline, ...reasons];
}

/** 日期時間只做文字格式正規化，避免 ISO 時區轉換改變後端所代表的本地時間。 */
function formatDateTime(value: string | null | undefined): string {
  /** 如果沒有時間則表示尚未完成 */
  if (!value?.trim()) {
    return '尚未完成';
  }

  const match = value.trim().match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{2})/,
  );
  if (!match) {
    return value.trim();
  }

  const [, year, month, day, hour, minute] = match;
  return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
}

/** 將一個或多個報名場次統一顯示為 yyyy/MM/dd HH:mm - HH:mm。 */
function formatRegistrationPeriods(value: string | null): string {
  if (!value?.trim()) {
    return '—';
  }

  return value
    .trim()
    .replace(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})\s*[-~–—至]\s*(\d{1,2}):(\d{2})/g,
      (_, year, month, day, startHour, startMinute, endHour, endMinute) =>
        `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')} `
        + `${String(startHour).padStart(2, '0')}:${startMinute} - `
        + `${String(endHour).padStart(2, '0')}:${endMinute}`,
    )
    // API 目前也可能以「場次一 - 場次二」回傳；只替換兩個完整日期之間的連字號。
    .replace(/(\d{2}:\d{2})\s*-\s*(?=\d{4}\/\d{2}\/\d{2}\s)/g, '$1、 ')
    .replace(/\s*[,，;；、]\s*/g, '、 ');
}

function createEmptyApplicationDetail(): ApplicationDetail {
  return {
    status: 'reviewing',
    statusText: '',
    statusClass: 'reviewing',
    title: '',
    applicationNo: '',
    dateRange: '',
    location: '',
    image: '',
    progress: [],
    applicationRows: [],
    paymentRows: [],
    paymentLines: [],
    booth: { selected: false, rows: [] },
    sideCard: { type: 'booth', title: '攤位資訊', icon: 'bi-shop', rows: [] },
  };
}

function createEmptyMarket(): MarketCardItem {
  return {
    title: '',
    time: '',
    start_date: '',
    end_date: '',
    description: '',
    location: '',
    address: '',
    city: '',
    area: '',
    image: '',
    status: '',
    statusClass: '',
    tags: [],
    category: '',
    organizer: '',
    transportation: [],
  };
}

function displayValue(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value).trim();
  return text || '-';
}

/** 詳情 API 的 unitPrice 來源為資料庫 rental_fee；rentalFee 僅保留舊格式相容。 */
function formatEquipmentRentalFee(
  item: VendorApplicationApiDetail['equipmentRentals']['rentalEquipments'][number],
): string {
  const price = item.unitPrice ?? item.rentalFee;
  if (price == null) {
    return '-';
  }

  const pricingUnitLabels: Record<string, string> = {
    EVENT: '場',
    DAY: '天',
    UNIT: '份',
  };
  const unit = item.unit?.trim()
    || pricingUnitLabels[item.pricingUnit?.trim().toUpperCase() ?? '']
    || '';

  return `${formatCurrency(price)}${unit ? ` / ${unit}` : ''}`;
}

function formatCurrency(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `NT$${Number.isFinite(amount) ? amount.toLocaleString('zh-TW') : '0'}`;
}

function sumAmounts(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
}
