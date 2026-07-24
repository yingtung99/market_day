import { DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { VendorService } from '../../../../core/Vendor/vendorApi/vendor.service';
import { MarketCardItem } from '../../../../models/interface/shared/MarketCardItem';
import { MarketSlot } from '../../../../models/interface/shared/MarketSlot';
import { VendorApplicationSubmitRequest } from '../../../../models/interface/vendor/VendorApplicationSubmit';
import {
  VendorMarketDetail,
  VendorMarketEquipment,
} from '../../../../models/interface/vendor/VendorMarketDetail';
import { UserFooter } from '../../../user/frontend/shared/user-footer/user-footer';
import { VendorHeader } from '../vendor-header/vendor-header';

interface RentalEquipment {
  id: string;
  eventEquipmentId?: number;
  name: string;
  detail: string;
  price: number;
  pricingUnit?: string | null;
  selected: boolean;
  quantity: number;
  maxQuantity: number;
}

interface PowerOption {
  id: string;
  eventEquipmentId?: number;
  label: string;
  price: number;
  pricingUnit?: string | null;
  selected: boolean;
}

@Component({
  selector: 'app-vendor-signup-form',
  imports: [DecimalPipe, FormsModule, RouterLink, UserFooter, VendorHeader],
  templateUrl: './vendor-signup-form.html',
  styleUrl: './vendor-signup-form.scss',
})
export class VendorSignupForm implements OnInit {
  /** 從市集詳細頁透過 Router state 帶入的市集資料。 */
  market: MarketCardItem | null = null;

  /** 詳細頁已整理好的場次，避免 market 本身沒有 slots 時跨頁遺失。 */
  private routedSlots: MarketSlot[] = [];
  private marketDetail: VendorMarketDetail | null = null;
  private readonly shouldLoadMarketDetail: boolean;

  /** 報名日期採複選，key 為場次日期。 */
  selectedDates: Record<string, boolean> = {};

  /** 設備租借資料集中管理，數量與勾選狀態會同步更新右側摘要。 */
  equipment: RentalEquipment[] = [];
  
  // equipment: RentalEquipment[] = [
  //   {
  //     id: 'table',
  //     name: '桌子',
  //     detail: '180 × 60 公分',
  //     price: 100,
  //     pricingUnit: 'EVENT',
  //     selected: true,
  //     quantity: 1,
  //     maxQuantity: 3,
  //   },
  //   {
  //     id: 'chair',
  //     name: '椅子',
  //     detail: '一般塑膠椅',
  //     price: 50,
  //     pricingUnit: 'EVENT',
  //     selected: true,
  //     quantity: 2,
  //     maxQuantity: 6,
  //   },
  //   {
  //     id: 'extension',
  //     name: '延長線',
  //     detail: '5 公尺',
  //     price: 50,
  //     pricingUnit: 'EVENT',
  //     selected: false,
  //     quantity: 0,
  //     maxQuantity: 2,
  //   },
  //   {
  //     id: 'fan',
  //     name: '電風扇',
  //     detail: '',
  //     price: 100,
  //     pricingUnit: 'EVENT',
  //     selected: false,
  //     quantity: 0,
  //     maxQuantity: 2,
  //   },
  //   {
  //     id: 'light',
  //     name: '照明燈',
  //     detail: 'LED 投光燈 100W',
  //     price: 200,
  //     pricingUnit: 'EVENT',
  //     selected: false,
  //     quantity: 0,
  //     maxQuantity: 2,
  //   },
  // ];

  /** 額外用電選項與費用由資料綁定產生。 */
  powerOptions: PowerOption[] = [
    {
      id: 'power110',
      label: '110V / 1000W',
      price: 200,
      pricingUnit: 'EVENT',
      selected: true,
    },
    {
      id: 'power220',
      label: '220V / 2000W',
      price: 400,
      pricingUnit: 'EVENT',
      selected: true,
    },
  ];

  requiresExtraPower = true;
  validationAttempted = false;
  applicationError = '';

  /** 車輛與備註欄位使用雙向綁定，之後可直接轉為 API payload。 */
  formData = {
    hasVehicle: true,
    vehicleNumber: '',
    note: '',
  };

  readonly noteMaxLength = 200;

  constructor(
    private readonly router: Router,
    private readonly vendorService: VendorService,
  ) {
    const navigation = this.router.currentNavigation();
    this.market = navigation?.extras.state?.['market'] || history.state?.['market'] || null;
    this.marketDetail = navigation?.extras.state?.['detail'] || history.state?.['detail'] || null;
    this.shouldLoadMarketDetail = !this.marketDetail && Boolean(this.market?.id);
    const stateSlots = navigation?.extras.state?.['slots'] ?? history.state?.['slots'];
    this.routedSlots = Array.isArray(stateSlots) ? stateSlots : [];

    const signupState = navigation?.extras.state?.['signup'] ?? history.state?.['signup'];
    const restoredSlots = Array.isArray(signupState?.selectedSlots)
      ? (signupState.selectedSlots as MarketSlot[])
      : [];

    this.initializeSelectedDates(restoredSlots);
  }

  ngOnInit(): void {
    if (this.marketDetail) {
      this.applyMarketEquipments(this.marketDetail.equipments);
      return;
    }

    if (!this.shouldLoadMarketDetail || !this.market?.id) return;

    this.vendorService.getMarketDetail(this.market.id).subscribe({
      next: (response) => {
        if (response.data) {
          this.marketDetail = response.data;
          this.applyMarketEquipments(response.data.equipments);
        }
      },
    });
  }

  get slots(): MarketSlot[] {
    if (this.market?.slots?.length) {
      return this.market.slots;
    }

    if (this.routedSlots.length) {
      return this.routedSlots;
    }

    return this.buildFallbackSlots();
  }

  get selectedSlots(): MarketSlot[] {
    return this.slots.filter((slot) => this.selectedDates[slot.date]);
  }

  get selectedDays(): number {
    return this.selectedSlots.length;
  }

  get selectedSlot(): MarketSlot | null {
    return this.selectedSlots[0] ?? null;
  }

  get selectedSlotDate(): string {
    return this.selectedSlot?.date ?? this.market?.start_date ?? '-';
  }

  get boothFeePerDay(): number {
    return this.marketDetail?.baseFee ?? this.market?.price ?? 0;
  }

  get boothSpec(): string {
    const dimensions = [
      this.marketDetail?.stallWidth ?? this.market?.stallWidth,
      this.marketDetail?.stallLength ?? this.market?.stallLength,
      this.marketDetail?.stallHeight ?? this.market?.stallHeight,
    ].filter((value): value is number => typeof value === 'number' && value > 0);

    return dimensions.length
      ? `${dimensions.map((value) => this.formatDimension(value)).join(' × ')} 公尺`
      : '-';
  }

  get boothDeposit(): number {
    return this.marketDetail?.depositAmount ?? this.market?.depositAmount ?? 0;
  }

  get capacityPerDate(): number {
    return this.marketDetail?.maxBooths ?? this.market?.maxBooths ?? 0;
  }

  capacityForSlot(slot: MarketSlot): number {
    return slot.total ?? this.capacityPerDate;
  }

  get boothSubtotal(): number {
    return this.boothFeePerDay * this.selectedDays;
  }

  get selectedEquipment(): RentalEquipment[] {
    return this.equipment.filter((item) => item.selected && item.quantity > 0);
  }

  get equipmentSubtotal(): number {
    return this.selectedEquipment.reduce(
      (total, item) =>
        total + item.price * item.quantity * this.rentalUnits(item.pricingUnit),
      0,
    );
  }

  get selectedPowerOptions(): PowerOption[] {
    return this.requiresExtraPower ? this.powerOptions.filter((option) => option.selected) : [];
  }

  get powerSubtotal(): number {
    return this.selectedPowerOptions.reduce(
      (total, option) => total + option.price * this.rentalUnits(option.pricingUnit),
      0,
    );
  }

  get totalFee(): number {
    return this.boothSubtotal + this.equipmentSubtotal + this.powerSubtotal + this.boothDeposit;
  }

  get showDateError(): boolean {
    return this.validationAttempted && !this.selectedDays;
  }

  get showPowerError(): boolean {
    return this.validationAttempted && this.requiresExtraPower && !this.selectedPowerOptions.length;
  }

  get showVehicleNumberError(): boolean {
    return (
      this.validationAttempted &&
      this.formData.hasVehicle &&
      !this.isValidVehicleNumber(this.formData.vehicleNumber)
    );
  }

  get vehicleNumberErrorMessage(): string {
    return this.formData.vehicleNumber.trim()
      ? '車牌格式不正確，請依行照輸入，例如 ABC-1234、A1A-123 或 1234-AB。'
      : '有車輛進場時，請填寫車牌號碼。';
  }

  get registrationPeriod(): string {
    if (!this.market) {
      return '-';
    }

    const registrationStart = this.formatApiDateTime(this.market.registrationStartAt);
    const registrationEnd = this.formatApiDateTime(this.market.registrationEndAt);
    if (!registrationStart || !registrationEnd) {
      return '-';
    }

    return `${registrationStart} - ${registrationEnd}`;
  }

  get signupStatusText(): string {
    return this.market?.status === '進行中' ? '報名中' : this.market?.status || '報名中';
  }

  get categoryOptions(): string[] {
    return this.market?.tags?.length
      ? this.market.tags
      : ['文創手作', '寵物生活', '植物選物', '生活選物'];
  }

  /** 切換日期時至少保留畫面狀態，送出前再統一驗證。 */
  toggleDate(slot: MarketSlot): void {
    this.selectedDates[slot.date] = !this.selectedDates[slot.date];
  }

  /** 切換設備後同步調整數量，避免勾選設備卻維持 0。 */
  toggleEquipment(item: RentalEquipment): void {
    item.selected = !item.selected;
    item.quantity = item.selected ? Math.max(1, item.quantity) : 0;
  }

  changeEquipmentQuantity(item: RentalEquipment, delta: number): void {
    const nextQuantity = Math.min(item.maxQuantity, Math.max(0, item.quantity + delta));

    item.quantity = nextQuantity;
    item.selected = nextQuantity > 0;
  }

  normalizeVehicleNumber(value: string): void {
    this.formData.vehicleNumber = this.formatVehicleNumber(value);
  }

  equipmentLineSubtotal(item: RentalEquipment): number {
    return item.price * item.quantity * this.rentalUnits(item.pricingUnit);
  }

  powerLineSubtotal(option: PowerOption): number {
    return option.price * this.rentalUnits(option.pricingUnit);
  }

  rentalUnits(pricingUnit?: string | null): number {
    return this.isDailyRental(pricingUnit) ? this.selectedDays : 1;
  }

  isDailyRental(pricingUnit?: string | null): boolean {
    const normalizedUnit = pricingUnit?.toUpperCase();
    return normalizedUnit !== 'EVENT' && normalizedUnit !== 'UNIT';
  }

  formatSlotDate(date: string): string {
    const parsed = this.parseDate(date);
    if (!parsed) {
      return date;
    }

    return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}（${this.weekday(parsed)}）`;
  }

  formatEventDate(date: string): string {
    const parsed = this.parseDate(date);
    return parsed ? this.formatFullDate(parsed) : date;
  }

  backToDetail(): void {
    this.router.navigate(['/vendor/sign-up-detail'], {
      state: { market: this.market },
    });
  }

  /** 驗證必填資料後，帶著完整報名 payload 前往確認頁。 */
  goToConfirm(): void {
    if (this.formData.hasVehicle) {
      this.formData.vehicleNumber = this.formatVehicleNumber(this.formData.vehicleNumber);
    }

    this.validationAttempted = true;
    this.applicationError = '';

    if (this.showDateError || this.showPowerError || this.showVehicleNumberError) {
      this.scrollToFirstError();
      return;
    }

    const applicationRequest = this.buildApplicationRequest();
    if (!applicationRequest) return;

    this.router.navigate(['/vendor/sign-up-confirm'], {
      state: {
        market: this.market,
        signup: {
          slot: this.selectedSlot,
          slotDate: this.selectedSlotDate,
          selectedSlots: this.selectedSlots,
          categories: this.categoryOptions,
          equipment: this.selectedEquipment,
          powerOptions: this.selectedPowerOptions,
          formData: {
            powerUsage: this.selectedPowerOptions.map((option) => option.label).join('、') || '無',
            vehicleNumber: this.formData.hasVehicle ? this.formData.vehicleNumber.trim() : '無',
            note: this.formData.note,
            rentPower: this.requiresExtraPower,
            hasVehicle: this.formData.hasVehicle,
          },
          boothSpec: this.boothSpec,
          boothFee: this.boothSubtotal,
          boothDeposit: this.boothDeposit,
          equipmentFee: this.equipmentSubtotal,
          powerRentalFee: this.powerSubtotal,
          totalFee: this.totalFee,
          applicationRequest,
        },
      },
    });
  }

  rentalUnitLabel(pricingUnit?: string | null): string {
    const unitLabels: Record<string, string> = {
      EVENT: '場',
      DAY: '天',
      UNIT: '份',
    };
    return unitLabels[pricingUnit?.toUpperCase() ?? ''] ?? '天';
  }

  private buildApplicationRequest(): VendorApplicationSubmitRequest | null {
    const eventId = Number(this.market?.id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      this.applicationError = '找不到活動編號，請返回市集詳細頁後重新報名。';
      return null;
    }

    const selectedRentals = [...this.selectedEquipment, ...this.selectedPowerOptions];
    if (selectedRentals.some((item) => item.eventEquipmentId == null)) {
      this.applicationError = '活動設備資料尚未載入完成，請稍後再試。';
      return null;
    }

    return {
      eventId,
      applyDates: this.selectedSlots.map((slot) => this.toApiDate(slot.date)),
      vehicleNo: this.formData.hasVehicle ? this.formData.vehicleNumber.trim() : null,
      applicantNote: this.formData.note.trim() || null,
      equipmentRentals: selectedRentals.map((item) => ({
        eventEquipmentId: item.eventEquipmentId!,
        quantity: 'quantity' in item ? item.quantity : 1,
        rentalUnits: this.rentalUnits(item.pricingUnit),
      })),
    };
  }

  private applyMarketEquipments(equipments: VendorMarketEquipment[]): void {
    this.equipment = equipments
      .filter((item) => item.itemType === 'EQUIPMENT' && item.chargeType === 'PAID')
      .map((item) => ({
        id: String(item.eventEquipmentId),
        eventEquipmentId: item.eventEquipmentId,
        name: item.name,
        detail: item.description ?? '',
        price: item.rentalFee,
        pricingUnit: item.pricingUnit,
        selected: false,
        quantity: 0,
        maxQuantity: item.perStallRentalLimit ?? item.stockQuantity ?? 99,
      }));

    this.powerOptions = equipments
      .filter((item) => item.itemType === 'POWER' && item.chargeType === 'PAID')
      .map((item) => ({
        id: String(item.eventEquipmentId),
        eventEquipmentId: item.eventEquipmentId,
        label: this.powerOptionLabel(item),
        price: item.rentalFee,
        pricingUnit: item.pricingUnit,
        selected: false,
      }));

    if (!this.powerOptions.length) {
      this.requiresExtraPower = false;
    }
  }

  private powerOptionLabel(item: VendorMarketEquipment): string {
    const wattage = item.wattageLimit ? `${item.wattageLimit}W` : '';
    return [item.name, wattage].filter(Boolean).join(' / ');
  }

  private isValidVehicleNumber(value: string): boolean {
    const normalizedValue = this.formatVehicleNumber(value);
    const vehicleNumberPatterns = [
      /^[A-Z]{3}-\d{2,4}$/,
      /^(?=[A-Z0-9]{3}-\d{3}$)(?=[^-]*[A-Z])[A-Z0-9]{3}-\d{3}$/,
      /^[A-Z]{2}-\d{2,5}$/,
      /^\d{4}-[A-Z]{2}$/,
    ];

    return vehicleNumberPatterns.some((pattern) => pattern.test(normalizedValue));
  }

  private formatVehicleNumber(value: string): string {
    return value
      .normalize('NFKC')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[‐‑‒–—―]/g, '-');
  }

  private toApiDate(value: string): string {
    const date = this.parseDate(value);
    if (!date) return value.replaceAll('/', '-');

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstError = document.querySelector<HTMLElement>('[data-validation-error="true"]');
      if (!firstError) return;

      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget = firstError.matches('input, button, select, textarea')
        ? firstError
        : firstError.querySelector<HTMLElement>('input, button, select, textarea');
      focusTarget?.focus({ preventScroll: true });
    });
  }

  private initializeSelectedDates(restoredSlots: MarketSlot[]): void {
    const restoredDates = new Set(restoredSlots.map((slot) => slot.date));

    this.slots.forEach((slot) => {
      if (restoredDates.size) {
        this.selectedDates[slot.date] = restoredDates.has(slot.date);
        return;
      }

      this.selectedDates[slot.date] = true;
    });
  }

  private buildFallbackSlots(): MarketSlot[] {
    if (!this.market) return [];

    const start = this.parseDate(this.market.start_date);
    const end = this.parseDate(this.market.end_date);
    if (!start || !end || end < start) return [];

    const slots: MarketSlot[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      slots.push({
        date: `${String(cursor.getMonth() + 1).padStart(2, '0')}/${String(cursor.getDate()).padStart(2, '0')}`,
        remaining: this.capacityPerDate,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return slots;
  }

  private parseDate(value: string): Date | null {
    const parts = value.match(/\d+/g)?.map(Number) ?? [];
    let year: number;
    let month: number;
    let day: number;

    if (parts.length >= 3) {
      [year, month, day] = parts;
    } else if (parts.length === 2) {
      const marketYear = this.market?.start_date.match(/\d{4}/)?.[0];
      year = Number(marketYear) || new Date().getFullYear();
      [month, day] = parts;
    } else {
      return null;
    }

    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatFullDate(date: Date): string {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatApiDateTime(value?: string): string | null {
    const parts = value?.trim().match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/,
    );
    if (!parts) {
      return null;
    }

    const [, year, month, day, hour, minute] = parts;
    if (hour == null || minute == null) {
      return null;
    }

    return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
  }

  private formatDimension(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  private weekday(date: Date): string {
    return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  }
}
