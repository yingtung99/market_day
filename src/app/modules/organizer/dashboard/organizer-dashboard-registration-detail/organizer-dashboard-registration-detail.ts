import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { OrganizerApplicationDetailResponse } from '../../../../models/interface/organizer/OrganizerApplicationSearch';
import {
  OrganizerRegistrationDetail,
  OrganizerRegistrationDetailAction,
  OrganizerRegistrationRejectReasonForm,
  OrganizerRegistrationStatusRecordItem,
} from '../../../../models/interface/organizer/OrganizerRegistrationDetail';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { AlertService } from '../../../../core/services/alert.service';
import { paymentMethodLabel } from '../../../../core/utils/payment-method.util';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import {
  DEFAULT_MARKET_MAP_DATA,
  MarketMap,
} from '../../../shared/market-map/market-map';
import { MarketMapData } from '../../../../models/interface/shared/MarketMap';

interface DetailSummaryRow {
  label: string;
  value: string;
  type?: 'status' | 'amount';
}

@Component({
  selector: 'app-organizer-dashboard-registration-detail',
  imports: [RouterLink, MarketMap],
  templateUrl: './organizer-dashboard-registration-detail.html',
  styleUrl: './organizer-dashboard-registration-detail.scss',
})
/** 報名詳情頁，提供審核、退款資訊、保證金退還與攤位地圖檢視功能。 */
export class OrganizerDashboardRegistrationDetail implements OnInit {
  @ViewChild('boothMapModal') private boothMapModal?: MarketMap;

  readonly ApplicationStatus = ApplicationStatus;
  readonly rejectReasonOptions = [
    '品牌資料填寫不完整',
    '申請資料填寫不完整',
    '品牌類型不符合該市集',
    '商品內容不符合規範',
    '其他原因',
  ];

  returnPage = 1;
  returnStatus = '';
  detail: OrganizerRegistrationDetail = this.createEmptyDetail();
  boothMapData: MarketMapData = DEFAULT_MARKET_MAP_DATA;
  boothMapDates: string[] = [];
  boothMapSelectedDate = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly alert: AlertService,
    private readonly organizerApi: OrganizerApiService,
    private readonly appRef: ApplicationRef,
    private readonly environmentInjector: EnvironmentInjector,
  ) {}

  /** 驗證網址中的報名 ID，並載入主辦方可查看的報名詳情。 */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const returnPage = Number(this.route.snapshot.queryParamMap.get('returnPage'));
    this.returnStatus = this.route.snapshot.queryParamMap.get('returnStatus') ?? '';

    if (Number.isInteger(returnPage) && returnPage > 0) {
      this.returnPage = returnPage;
    }

    if (!Number.isInteger(id) || id <= 0) {
      void this.alert.error('報名詳情載入失敗', '報名 ID 不正確。').then(() => this.goBack());
      return;
    }

    void this.loadDetail(id);
  }

  get statusClass(): string {
    return ApplicationStatus.getClass(this.detail.status);
  }

  get registrationPeriods(): string[] {
    return this.detail.registration.period
      .split(/[\r\n、]+/)
      .map((period) => period.replaceAll('、', '').trim())
      .filter(Boolean);
  }

  get equipmentSummaryRows(): DetailSummaryRow[] {
    return [
      { label: '基本設備', value: this.summarizeEquipment(this.detail.freeEquipmentRows) },
      { label: '租借設備', value: this.summarizeEquipment(this.detail.rentalEquipmentRows) },
      { label: '基本用電', value: this.summarizePower(this.detail.basicPowerRows) },
      { label: '額外用電', value: this.summarizePower(this.detail.extraPowerRows) },
    ];
  }

  get paymentSummaryRows(): DetailSummaryRow[] {
    const rows: DetailSummaryRow[] = [
      { label: '付款狀態', value: this.detail.payment.status, type: 'status' },
      { label: '付款金額', value: this.detail.payment.amount, type: 'amount' },
      { label: '付款方式', value: this.detail.payment.method },
      { label: '付款編號', value: this.detail.payment.transactionNo },
    ];

    return rows;
  }

  get pageActions(): OrganizerRegistrationDetailAction[] {
    switch (this.detail.status) {
      case ApplicationStatus.pendingReview:
        return [
          { key: 'reject', label: '審核未通過', icon: 'bi-x-lg', variant: 'outline' },
          { key: 'approve', label: '審核通過', icon: 'bi-check-lg', variant: 'primary' },
        ];
      case ApplicationStatus.completed:
        const canReturnDeposit = this.isActivityOngoing(
          this.detail.activity.startAt,
          this.detail.activity.endAt,
        );
        return [
          {
            key: 'returnDeposit',
            label: '退還保證金',
            variant: 'primary',
            disabled: !canReturnDeposit,
            hint: canReturnDeposit ? undefined : '活動進行期間才可退還保證金',
          },
        ];
      case ApplicationStatus.pendingSelection:
        return [
          { key: 'viewBoothMap', label: '查看攤位地圖', icon: 'bi-map', variant: 'primary' },
        ];
      case ApplicationStatus.refundPending:
        return [
          { key: 'goPaymentManagement', label: '前往確認退款', icon: 'bi-cash-coin', variant: 'primary' },
        ];
      case ApplicationStatus.refunding:
      case ApplicationStatus.refunded:
        return [
          { key: 'viewRefundInfo', label: '查看退款資訊', icon: 'bi-eye', variant: 'primary' },
        ];
      case ApplicationStatus.depositReturned:
        return [
          { key: 'viewDepositInfo', label: '查看保證金資訊', icon: 'bi-eye', variant: 'primary' },
        ];
      default:
        return [];
    }
  }

  get statusRecords(): OrganizerRegistrationStatusRecordItem[] {
    const times = this.detail.times;

    switch (this.detail.status) {
      case ApplicationStatus.reviewRejected:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
        ]);
      case ApplicationStatus.cancelled:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
          { label: '退款申請時間', value: times.refundRequestedAt },
          { label: '退款審核時間', value: times.refundReviewedAt },
          { label: '退款完成時間', value: times.refundedAt },
          { label: '已取消時間', value: times.cancelledAt },
        ]);
      case ApplicationStatus.pendingReview:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
        ]);
      case ApplicationStatus.pendingPayment:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
        ]);
      case ApplicationStatus.pendingSelection:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
        ]);
      case ApplicationStatus.refundPending:
      case ApplicationStatus.refunding:
      case ApplicationStatus.refunded:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
          { label: '退款申請時間', value: times.refundRequestedAt },
          { label: '退款審核時間', value: times.refundReviewedAt },
          { label: '退款完成時間', value: times.refundedAt },
        ]);
      case ApplicationStatus.completed:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
          { label: '攤位完成時間', value: times.selectedAt },
        ]);
      case ApplicationStatus.depositReturned:
        return this.presentStatusRecords([
          { label: '報名時間', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
          { label: '攤位時間', value: times.selectedAt },
          { label: '最終確認時間', value: times.finalConfirmedAt },
          { label: '保證金退還時間', value: times.depositReturnedAt },
        ]);
      default:
        return this.presentStatusRecords([
          { label: '報名日期', value: times.registeredAt },
          { label: '審核時間', value: times.reviewedAt },
          { label: '付款時間', value: times.paidAt },
          { label: '攤位完成時間', value: times.selectedAt },
          { label: '最終確認時間', value: times.finalConfirmedAt },
          { label: '保證金退還', value: times.depositReturnedAt },
        ]);
    }
  }

  async handlePageAction(action: OrganizerRegistrationDetailAction): Promise<void> {
    if (action.disabled) {
      return;
    }

    switch (action.key) {
      case 'approve':
        await this.approveRegistration();
        return;
      case 'reject':
        await this.rejectRegistration();
        return;
      case 'returnDeposit':
        await this.returnDeposit();
        return;
      case 'goPaymentManagement':
        this.router.navigate(['/organizer/dash-board/collection/detail', this.detail.id]);
        return;
      case 'viewRefundInfo':
        this.router.navigate(['/organizer/dash-board/collection/detail', this.detail.id]);
        return;
      case 'viewDepositInfo':
        this.router.navigate(['/organizer/dash-board/collection/detail', this.detail.id]);
        return;
      case 'viewActivity':
        this.router.navigate(['/organizer/dash-board/activity/detail', this.detail.activity.eventId]);
        return;
      case 'viewBrand':
        const brandId = this.detail.brand.id;
        if (brandId == null || !Number.isInteger(brandId) || brandId <= 0) {
          await this.alert.error('品牌詳情載入失敗', '品牌 ID 不正確，請重新整理後再試。');
          return;
        }
        this.openInNewTab(
          '/user/brand-detail',
          { brand: String(brandId) },
        );
        return;
      case 'viewBoothMap':
        await this.openBoothMap();
        return;
    }
  }

  async onBoothMapDateSelected(date: string): Promise<void> {
    await this.loadBoothMapData(date);
  }

  private async openBoothMap(): Promise<void> {
    const applyDate = this.detail.boothAssignments[0]?.date?.replaceAll('/', '-') || '';

    if (!window.matchMedia('(max-width: 992px)').matches) {
      await this.router.navigate(
        ['/organizer/dash-board/stall/detail', this.detail.activity.eventId, 'map'],
        {
          queryParams: {
            applyDate: applyDate || null,
            returnTo: 'registration',
            applicationId: this.detail.id,
            registrationReturnPage: this.returnPage,
            registrationReturnStatus: this.returnStatus || null,
          },
        },
      );
      return;
    }

    const loaded = await this.loadBoothMapData(applyDate);
    if (loaded) {
      window.setTimeout(() => this.boothMapModal?.openFullscreenMap(), 0);
    }
  }

  private async loadBoothMapData(applyDate: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.getOrganizerStallMap(this.detail.activity.eventId, {
          applyDate: applyDate || undefined,
        }),
      );
      if (!isApiSuccessStatus(response.statusCode) || !response.data?.event) {
        await this.alert.error('攤位地圖載入失敗', response.message || '請稍後再試。');
        return false;
      }

      const data = response.data;
      const apiStalls = new Map(
        (data.stalls ?? []).flatMap((zone) =>
          zone.stalls.map((stall) => [stall.stallNo, { stall, zone: zone.zoneName }] as const),
        ),
      );
      this.boothMapData = {
        ...DEFAULT_MARKET_MAP_DATA,
        name: data.event.eventTitle,
        booths: DEFAULT_MARKET_MAP_DATA.booths.map((booth) => {
          const api = apiStalls.get(booth.code);
          if (!api) return booth;
          const vendor = api.stall.selectedVendor;
          const selected = api.stall.status === '已選擇' || api.stall.status === '系統分配';
          return {
            ...booth,
            zone: api.zone,
            status: selected ? 'selected' as const : 'available' as const,
            size: api.stall.length && api.stall.width
              ? `${api.stall.length}m × ${api.stall.width}m`
              : booth.size,
            brand: vendor?.name
              ? {
                  id: String(api.stall.selectedApplicationId ?? api.stall.stallId),
                  name: vendor.name,
                  category: vendor.category?.name || '-',
                  summary: '',
                  logo: '',
                }
              : undefined,
          };
        }),
      };
      this.boothMapDates = this.detail.boothAssignments
        .map((assignment) => assignment.date.replaceAll('/', '-'))
        .filter((date, index, dates) => Boolean(date) && dates.indexOf(date) === index);
      this.boothMapSelectedDate = data.event.currentApplyDate || applyDate;
      return true;
    } catch {
      await this.alert.error('攤位地圖載入失敗', '目前無法取得攤位地圖，請稍後再試。');
      return false;
    }
  }

  private openInNewTab(path: string, queryParams?: Record<string, string>): void {
    const url = this.router.serializeUrl(this.router.createUrlTree([path], { queryParams }));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private summarizeEquipment(rows: OrganizerRegistrationDetail['freeEquipmentRows']): string {
    if (!rows.length) {
      return '-';
    }

    return rows
      .map((row) => {
        const name = row.cells[0].replace(/（.*?）/g, '');
        const quantity = row.cells[2];

        if (row.cells[4]) {
          return `${name} × ${quantity}　${row.cells[3]}`;
        }

        return `${name} × ${quantity}${row.cells[3] ?? ''}`;
      })
      .join('、');
  }

  private summarizePower(rows: OrganizerRegistrationDetail['basicPowerRows']): string {
    if (!rows.length) {
      return '-';
    }

    return rows.map((row) => row.cells[0]).join('、');
  }

  private isActivityOngoing(startAt: string | null, endAt: string | null): boolean {
    if (!startAt || !endAt) return false;

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

    const now = Date.now();
    return now >= start.getTime() && now <= end.getTime();
  }

  goBack(): void {
    this.router.navigate(['/organizer/dash-board/register'], {
      queryParams: {
        page: this.returnPage,
        status: this.returnStatus || null,
      },
    });
  }

  private presentStatusRecords(
    records: Array<{ label: string; value?: string }>,
  ): OrganizerRegistrationStatusRecordItem[] {
    return records.filter((record): record is OrganizerRegistrationStatusRecordItem => Boolean(record.value));
  }

  /** 重新取得報名最新狀態；狀態操作完成後也共用此方法刷新畫面。 */
  private async loadDetail(applicationId: number, showError = true): Promise<void> {
    try {
      const response = await firstValueFrom(this.organizerApi.getOrganizerApplicationDetail(applicationId));
      if (!isApiSuccessStatus(response.statusCode) || !response.data?.application) {
        if (showError) await this.alert.error('報名詳情載入失敗', response.message || '請稍後再試。');
        return;
      }
      this.detail = this.toRegistrationDetail(response.data);
    } catch {
      if (showError) await this.alert.error('報名詳情載入失敗', '目前無法取得報名資料，請稍後再試。');
    }
  }

  /** 將分區式 API response 整理為頁面使用的單一詳情模型。 */
  private toRegistrationDetail(raw: OrganizerApplicationDetailResponse): OrganizerRegistrationDetail {
    const categoryName = raw.brand.category?.name || '-';
    const statusTime = (key: string): string | undefined =>
      raw.status.find((item) => item.key === key && item.createdAt)?.createdAt ?? undefined;
    const freeEquipmentRows = raw.equipmentRentals.freeEquipments.map((row) => ({
      cells: [
        this.textValue(row['equipmentName']),
        this.textValue(row['specification']),
        this.textValue(row['quantity']),
        this.textValue(row['unit'], '個'),
      ],
    }));
    const rentalEquipmentRows = raw.equipmentRentals.rentalEquipments.map((row) => ({
      cells: [
        this.textValue(row['equipmentName']),
        this.textValue(row['specification']),
        this.textValue(row['quantity']),
        this.textValue(row['unit'], '個'),
        this.moneyValue(row['total'] ?? row['subtotal']),
      ],
    }));
    const basicPowerRows = raw.equipmentRentals.freeBasicPower.map((row) => ({
      cells: [this.textValue(row['powerSpecification']), this.wattValue(row['wattage'])],
    }));
    const extraPowerRows = raw.equipmentRentals.extraPower.map((row) => ({
      cells: [
        this.textValue(row['powerSpecification']),
        this.wattValue(row['wattage']),
        this.moneyValue(row['unitPrice']),
        this.moneyValue(row['total'] ?? row['subtotal']),
      ],
    }));
    // 後端依序回傳：報名費、設備租借費、額外電費、保證金、總計。
    // 使用固定欄位順序，避免顯示名稱調整時讓金額對應失效。
    const applicationFee = raw.feedetail[0]?.amount;
    const extraPowerFee = raw.feedetail[2]?.amount;
    const depositAmount = raw.feedetail[3]?.amount;
    const totalAmount = raw.feedetail[4]?.amount;
    const registrationPeriods = (raw.applicationdetail.registrationPeriods || '-')
      .replace(/(?<=\d{2}:\d{2}) - (?=\d{4}[/-]\d{2}[/-]\d{2})/g, '\n');
    const reason = raw.application.applicationStatus === ApplicationStatus.reviewRejected
      && raw.applicationdetail.reviewNote
      ? {
          title: '審核未通過原因',
          subtitle: raw.applicationdetail.reviewNote,
          description: raw.applicationdetail.reviewNoteDetail || '-',
        }
      : undefined;
    const refund = raw.refund?.refundStatus
      ? {
          reason: raw.refund.refundStatusText || '退款處理',
          description: '退款進度與金額請至收款詳情查看。',
          requestedAt: statusTime('REFUND_REQUESTED'),
          confirmedAt: statusTime('REFUND_REVIEW'),
          refundedAt: raw.refund.refundedAt || statusTime('REFUNDED'),
        }
      : undefined;

    return {
      id: raw.application.applicationId,
      status: raw.application.applicationStatus,
      registrationNo: raw.application.applicationNo || '-',
      activity: {
        eventId: raw.event.eventId,
        name: raw.event.eventTitle || '-',
        image: raw.event.eventCoverImageUrl || 'assets/images/shared/no-image-placeholder.svg',
        date: raw.event.eventTime || '-',
        startAt: raw.event.eventStartAt,
        endAt: raw.event.eventEndAt,
        status: raw.event.eventStatus || '-',
        location: raw.event.locationName || '-',
        address: raw.event.address || '-',
      },
      vendor: {
        name: raw.vendor.vendorOwnerName || '-',
        phone: raw.vendor.vendorPhone || '-',
        email: raw.vendor.vendorEmail || '-',
        address: raw.vendor.address || '-',
      },
      brand: {
        id: raw.brand.brandId,
        name: raw.brand.brandName || '-',
        type: categoryName,
        image: raw.brand.avatarImageUrl || 'assets/images/shared/no-image-placeholder.svg',
        description: raw.brand.brandDescription || '-',
      },
      registration: {
        period: registrationPeriods,
        boothSpec: this.boothSize(raw.applicationdetail.length, raw.applicationdetail.width),
        boothZone: raw.applicationdetail.stallZone || '-',
        boothCategories: categoryName,
        vehiclePlate: raw.applicationdetail.vehicleNo || '-',
        note: raw.applicationdetail.applicantNote || '-',
        rentalEquipment: this.summarizeEquipment([...freeEquipmentRows, ...rentalEquipmentRows]),
      },
      fee: {
        boothFee: this.moneyValue(applicationFee),
        electricityFee: this.moneyValue(extraPowerFee),
        deposit: this.moneyValue(depositAmount),
        total: this.moneyValue(totalAmount),
      },
      payment: {
        status: raw.fee.paymentStatus || '-',
        method: paymentMethodLabel(raw.fee.paymentMethod),
        transactionNo: raw.fee.paymentNo || raw.fee.providerTradeNo || '-',
        amount: this.moneyValue(raw.fee.paymentAmount),
        deadline: '-',
      },
      boothAssignments: raw.stall.map((stall) => ({
        date: stall.applyDate,
        boothNo: stall.stallNo || '-',
        zone: stall.zoneName || '-',
        status: stall.selectionStatus,
      })),
      feeRows: raw.feedetail.map((row) => ({
        label: row.item,
        content: row.content || undefined,
        value: this.moneyValue(row.amount),
      })),
      freeEquipmentRows,
      rentalEquipmentRows,
      basicPowerRows,
      extraPowerRows,
      rentalEquipmentSubtotal: this.sumMoney(raw.equipmentRentals.rentalEquipments),
      extraPowerSubtotal: this.sumMoney(raw.equipmentRentals.extraPower),
      refund,
      depositReturn: statusTime('DEPOSIT_RETURNED')
        ? { amount: this.moneyValue(depositAmount), method: '現金退還', returnedAt: statusTime('DEPOSIT_RETURNED') }
        : undefined,
      times: {
        registeredAt: statusTime('APPLIED') || '-',
        reviewedAt: statusTime('REVIEW'),
        paidAt: statusTime('PAYMENT') || raw.fee.paidAt || undefined,
        selectedAt: statusTime('STALL_SELECTED'),
        finalConfirmedAt: statusTime('COMPLETED'),
        depositReturnedAt: statusTime('DEPOSIT_RETURNED'),
        refundRequestedAt: statusTime('REFUND_REQUESTED'),
        refundReviewedAt: statusTime('REFUND_REVIEW'),
        refundedAt: statusTime('REFUNDED') || raw.refund?.refundedAt || undefined,
        cancelledAt: statusTime('CANCELLED'),
      },
      reason,
    };
  }

  private textValue(value: unknown, fallback = '-'): string {
    return value === null || value === undefined || value === '' ? fallback : String(value);
  }

  private wattValue(value: unknown): string {
    const text = this.textValue(value);
    return text === '-' || /w$/i.test(text) ? text : `${text}W`;
  }

  private moneyValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    const amount = Number(value);
    return Number.isFinite(amount) ? `$${amount.toLocaleString('zh-TW')}` : String(value);
  }

  private boothSize(length: number | null, width: number | null): string {
    return length && width ? `長 ${length} 公尺 × 寬 ${width} 公尺` : '-';
  }

  private sumMoney(rows: Array<Record<string, unknown>>): string {
    const total = rows.reduce((sum, row) => sum + Number(row['total'] ?? row['subtotal'] ?? 0), 0);
    return total > 0 ? this.moneyValue(total) : '-';
  }

  /** 送出審核通過並重新載入資料，避免保留操作前的狀態。 */
  private async approveRegistration(): Promise<void> {
    const confirmed = await this.alert.confirmHtml({
      html: this.getApproveConfirmHtml(),
      confirmButtonText: '確認通過',
      cancelButtonText: '取消',
      popupClass: 'registration-action-swal',
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await firstValueFrom(this.organizerApi.approveOrganizerApplication(this.detail.id));
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('審核送出失敗', response.message || '請稍後再試。');
        return;
      }
      await this.loadDetail(this.detail.id, false);
    } catch {
      await this.alert.error('審核送出失敗', '目前無法送出審核結果，請稍後再試。');
      return;
    }

    await this.alert.successHtml({
      html: this.getApproveSuccessHtml(),
      confirmButtonText: '知道了',
      popupClass: 'registration-result-swal',
      showCloseButton: true,
    });
  }

  /** 收集未通過原因後送出審核結果，成功時刷新後端最新狀態。 */
  private async rejectRegistration(): Promise<void> {
    const form = await this.openRejectReasonForm();

    if (!form) {
      return;
    }

    const confirmed = await this.alert.confirmHtml({
      html: this.getRejectConfirmHtml(form),
      confirmButtonText: '確認送出',
      cancelButtonText: '取消',
      popupClass: 'registration-action-swal registration-reject-confirm-swal',
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await firstValueFrom(this.organizerApi.rejectOrganizerApplication(this.detail.id, {
        reviewNote: form.reason,
        reviewNoteDetail: form.description,
      }));
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('審核送出失敗', response.message || '請稍後再試。');
        return;
      }
      await this.loadDetail(this.detail.id, false);
    } catch {
      await this.alert.error('審核送出失敗', '目前無法送出審核結果，請稍後再試。');
      return;
    }

    await this.alert.successHtml({
      html: this.getRejectSuccessHtml(form),
      confirmButtonText: '知道了',
      popupClass: 'registration-result-swal registration-reject-result-swal',
      showCloseButton: true,
    });
  }

  /** 確認保證金退還，實際狀態與時間以 API response 為準。 */
  private async returnDeposit(): Promise<void> {
    const confirmed = await this.alert.confirmHtml({
      html: this.getDepositReturnConfirmHtml(),
      confirmButtonText: '確認退還',
      cancelButtonText: '取消',
      popupClass: 'registration-action-swal registration-deposit-swal',
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await firstValueFrom(this.organizerApi.refundOrganizerDeposit(this.detail.id));
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error('保證金退還失敗', response.message || '請稍後再試。');
        return;
      }
      await this.loadDetail(this.detail.id, false);
    } catch {
      await this.alert.error('保證金退還失敗', '目前無法退還保證金，請稍後再試。');
      return;
    }

    await this.alert.successHtml({
      html: this.getDepositReturnSuccessHtml(),
      confirmButtonText: '知道了',
      popupClass: 'registration-result-swal',
      showCloseButton: true,
    });
  }

  private async openRejectReasonForm(): Promise<OrganizerRegistrationRejectReasonForm | null> {
    let selectedReason = '';
    let dropdownRef: ComponentRef<Dropdown> | null = null;

    const result = await this.alert.custom<OrganizerRegistrationRejectReasonForm>({
      html: this.getRejectReasonFormHtml(),
      showCancelButton: true,
      confirmButtonText: '送出結果',
      cancelButtonText: '取消',
      reverseButtons: true,
      allowOutsideClick: true,
      customClass: {
        popup: 'registration-action-swal registration-reject-form-swal require-supplement-swal',
      },
      didOpen: () => {
        const host = document.getElementById('rejectReasonDropdownHost');

        if (!host) {
          return;
        }

        dropdownRef = createComponent(Dropdown, {
          environmentInjector: this.environmentInjector,
        });
        dropdownRef.instance.placeholder = '請選擇未通過原因';
        dropdownRef.instance.options = this.rejectReasonOptions;
        dropdownRef.instance.optionSelected.subscribe((value) => {
          selectedReason = value;
          dropdownRef!.instance.invalid = false;
          dropdownRef!.changeDetectorRef.detectChanges();
          const error = document.querySelector<HTMLElement>('.registration-swal-field-error');
          if (error) {
            error.textContent = '';
          }
        });
        this.appRef.attachView(dropdownRef.hostView);
        host.appendChild(dropdownRef.location.nativeElement);

        const descriptionInput = document.getElementById('rejectDescription') as HTMLTextAreaElement | null;
        const descriptionCounter = document.getElementById('rejectDescriptionCount');
        descriptionInput?.addEventListener('input', () => {
          if (descriptionCounter) {
            descriptionCounter.textContent = `${descriptionInput.value.length}/300`;
          }
          descriptionInput.classList.remove('is-invalid');
          const error = document.querySelector<HTMLElement>('.registration-swal-field-error');
          if (error) {
            error.textContent = '';
          }
        });
      },
      willClose: () => {
        if (dropdownRef) {
          this.appRef.detachView(dropdownRef.hostView);
          dropdownRef.destroy();
          dropdownRef = null;
        }
      },
      preConfirm: () => {
        const descriptionInput = document.getElementById('rejectDescription') as HTMLTextAreaElement | null;
        const description = descriptionInput?.value.trim() ?? '';
        const error = document.querySelector<HTMLElement>('.registration-swal-field-error');

        if (!selectedReason) {
          if (dropdownRef) {
            dropdownRef.instance.invalid = true;
            dropdownRef.changeDetectorRef.detectChanges();
          }

          if (error) {
            error.textContent = '請選擇未通過原因';
          }

          return false;
        }

        if (!description) {
          descriptionInput?.classList.add('is-invalid');
          descriptionInput?.focus();
          if (error) {
            error.textContent = '請填寫原因說明';
          }

          return false;
        }

        if (error) {
          error.textContent = '';
        }

        descriptionInput?.classList.remove('is-invalid');

        if (dropdownRef) {
          dropdownRef.instance.invalid = false;
          dropdownRef.changeDetectorRef.detectChanges();
        }

        return {
          reason: selectedReason,
          description,
        };
      },
    });

    return result.isConfirmed && result.value ? result.value : null;
  }

  private getApproveConfirmHtml(): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon warning">
          <i class="bi bi-exclamation-lg"></i>
        </div>
        <h3>確認審核通過</h3>
        <p class="registration-swal-main">確認通過此筆報名申請嗎？</p>
        <p class="registration-swal-sub">通過後系統將通知攤主進行付款。</p>
      </div>
    `;
  }

  private getApproveSuccessHtml(): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon success">
          <i class="bi bi-check-lg"></i>
        </div>
        <h3>送出審核成功</h3>
        <p class="registration-swal-main">此筆報名已成功通過審核。</p>
        <p class="registration-swal-sub">系統已通知攤主，請等待攤主完成付款。</p>
      </div>
    `;
  }

  private getRejectReasonFormHtml(): string {
    return `
      <div class="registration-swal-content registration-reject-form">
        <div class="registration-swal-icon warning document">
          <i class="bi bi-file-earmark-text"></i>
        </div>
        <h3>填寫未通過原因</h3>
        <p class="registration-swal-sub">請選擇未通過原因，送出後系統將通知攤主審核結果。</p>

        <label class="registration-swal-field">
          <span>未通過原因 <b>*</b></span>
          <div id="rejectReasonDropdownHost" class="registration-swal-dropdown-host"></div>
        </label>

        <label class="registration-swal-field required-reason-field">
          <span>原因說明 <b>*</b></span>
          <span class="required-reason-control">
            <textarea id="rejectDescription" class="supplement-swal-textarea" maxlength="300" placeholder="請輸入原因說明"></textarea>
            <em class="supplement-swal-counter" id="rejectDescriptionCount">0/300</em>
          </span>
        </label>

        <p class="registration-swal-field-error" aria-live="polite"></p>
      </div>
    `;
  }

  private getRejectConfirmHtml(form: OrganizerRegistrationRejectReasonForm): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon warning">
          <i class="bi bi-exclamation-lg"></i>
        </div>
        <h3>確認審核未通過</h3>
        <p class="registration-swal-main">確定要將此筆報名設為未通過嗎？</p>
        <p class="registration-swal-sub">送出後系統將通知攤主審核結果。</p>

        <div class="registration-swal-summary">
          <div>
            <span>未通過原因</span>
            <strong>${form.reason}</strong>
          </div>
          <div>
            <span>原因說明</span>
            <strong>${form.description || this.getRejectDefaultDescription(form.reason)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  private getRejectSuccessHtml(form: OrganizerRegistrationRejectReasonForm): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon error">
          <i class="bi bi-x-lg"></i>
        </div>
        <h3>審核未通過</h3>
        <p class="registration-swal-main">此筆報名未通過審核。</p>
        <p class="registration-swal-sub">系統已通知攤主審核結果。</p>

        <div class="registration-swal-summary">
          <div>
            <span>未通過原因</span>
            <strong>${form.reason}</strong>
          </div>
          <div>
            <span>原因說明</span>
            <strong>${form.description || this.getRejectDefaultDescription(form.reason)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  private getDepositReturnConfirmHtml(): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon warning">
          <i class="bi bi-exclamation-lg"></i>
        </div>
        <h3>保證金退還確認</h3>
        <p class="registration-swal-main">請確認攤主已完成活動參與，且符合保證金退還條件。</p>
        <p class="registration-swal-sub">確認後系統將記錄本次保證金退還時間，此操作無法復原。</p>

        <div class="registration-swal-summary deposit">
          <div>
            <span>保證金金額</span>
            <strong class="amount">$1,000</strong>
          </div>
          <div>
            <span>退還方式</span>
            <strong>現場退還</strong>
          </div>
        </div>
      </div>
    `;
  }

  private getDepositReturnSuccessHtml(): string {
    return `
      <div class="registration-swal-content">
        <div class="registration-swal-icon success">
          <i class="bi bi-check-lg"></i>
        </div>
        <h3>保證金已退還</h3>
        <p class="registration-swal-main">此筆報名已記錄保證金退還。</p>
        <p class="registration-swal-sub">狀態已更新為保證金已退還。</p>
      </div>
    `;
  }

  private getRejectDefaultDescription(reason: string): string {
    const descriptionMap: Record<string, string> = {
      品牌資料填寫不完整: '請補充品牌介紹與商品照片後重新提交報名。',
      申請資料填寫不完整: '請補齊聯絡資料、攤位需求或報名內容後重新提交報名。',
      品牌類型不符合該市集: '您申請的品牌類型與本活動開放類別不符，請重新選擇符合的品牌類型後再提交報名。',
      商品內容不符合規範: '商品內容與活動規範不符，請調整商品內容後再提交報名。',
      其他原因: '請依主辦方補充說明調整資料後，再重新提交報名。',
    };

    return descriptionMap[reason] ?? '請依主辦方補充說明調整資料後，再重新提交報名。';
  }

  private createEmptyDetail(): OrganizerRegistrationDetail {
    return {
      id: 0,
      status: '',
      registrationNo: '-',
      activity: {
        eventId: 0,
        name: '-',
        image: 'assets/images/shared/no-image-placeholder.svg',
        date: '-',
        startAt: null,
        endAt: null,
        status: '-',
        location: '-',
        address: '-',
      },
      vendor: {
        name: '-',
        phone: '-',
        email: '-',
        address: '-',
      },
      brand: {
        id: null,
        name: '-',
        type: '-',
        image: 'assets/images/shared/no-image-placeholder.svg',
        description: '-',
      },
      registration: {
        period: '-',
        boothSpec: '-',
        boothZone: '-',
        boothCategories: '-',
        vehiclePlate: '-',
        note: '-',
        rentalEquipment: '-',
      },
      fee: {
        boothFee: '-',
        electricityFee: '-',
        deposit: '-',
        total: '-',
      },
      payment: {
        status: '-',
        method: '-',
        transactionNo: '-',
        amount: '-',
        deadline: '-',
      },
      boothAssignments: [],
      feeRows: [],
      freeEquipmentRows: [],
      rentalEquipmentRows: [],
      basicPowerRows: [],
      extraPowerRows: [],
      rentalEquipmentSubtotal: '-',
      extraPowerSubtotal: '-',
      times: {
        registeredAt: '-',
      },
    };
  }
}

