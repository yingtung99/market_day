import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';

import { MarketCardItem } from '../../../../models/interface/shared/MarketCardItem';
import { VendorSignupForm } from './vendor-signup-form';

describe('VendorSignupForm', () => {
  let component: VendorSignupForm;
  let fixture: ComponentFixture<VendorSignupForm>;
  let router: Router;

  const market: MarketCardItem = {
    id: '1',
    title: '新動市集｜貓貓森林市',
    time: '10:00－18:00',
    start_date: '2026/05/30',
    end_date: '2026/05/31',
    description: '測試市集',
    location: '宜蘭車站前航空園區森林廣場',
    address: '宜蘭縣宜蘭市光復路 1 號',
    city: '宜蘭縣',
    area: '宜蘭市',
    image: 'market.png',
    status: '報名中',
    statusClass: 'open',
    tags: ['文創手作', '寵物生活', '植物選物', '生活選物'],
    category: '生活市集',
    organizer: '小集日',
    transportation: [],
    price: 650,
    maxBooths: 150,
    depositAmount: 1000,
    stallWidth: 3,
    stallLength: 3,
    stallHeight: null,
    registrationStartAt: '2026-04-15T12:00:00',
    registrationEndAt: '2026-05-08T23:59:00',
    slots: [
      { date: '05/30', remaining: 120, total: 150 },
      { date: '05/31', remaining: 85, total: 150 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorSignupForm],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorSignupForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    component.market = market;
    component.selectedDates = {
      '05/30': true,
      '05/31': true,
    };
    component.equipment = [
      {
        id: 'table',
        name: '桌子',
        detail: '',
        price: 100,
        pricingUnit: 'EVENT',
        selected: true,
        quantity: 1,
        maxQuantity: 3,
      },
      {
        id: 'chair',
        name: '椅子',
        detail: '',
        price: 50,
        pricingUnit: 'EVENT',
        selected: true,
        quantity: 2,
        maxQuantity: 6,
      },
      {
        id: 'extension',
        name: '延長線',
        detail: '',
        price: 50,
        pricingUnit: 'EVENT',
        selected: false,
        quantity: 0,
        maxQuantity: 2,
      },
    ];
    fixture.detectChanges();
  });

  it('should create and render bound market data', () => {
    const textContent: string = fixture.nativeElement.textContent;

    expect(component).toBeTruthy();
    expect(textContent).toContain(market.title);
    expect(textContent).toContain(market.location);
    expect(textContent).toContain('報名摘要');
  });

  it('should calculate the fee summary from selected data', () => {
    expect(component.selectedDays).toBe(2);
    expect(component.boothSubtotal).toBe(1300);
    expect(component.equipmentSubtotal).toBe(200);
    expect(component.powerSubtotal).toBe(600);
    expect(component.totalFee).toBe(3100);
    expect(component.boothSpec).toBe('3 × 3 公尺');
    expect(component.boothDeposit).toBe(1000);
    expect(component.capacityForSlot(market.slots![0])).toBe(150);
  });

  it('should build selectable dates when market slots are missing', () => {
    component.market = {
      ...market,
      slots: undefined,
    };

    expect(component.slots.map((slot) => slot.date)).toEqual(['05/30', '05/31']);
  });

  it('should display the registration period returned by the API', () => {
    expect(component.registrationPeriod).toBe('2026/04/15 12:00 - 2026/05/08 23:59');

    component.market = {
      ...market,
      registrationEndAt: undefined,
    };

    expect(component.registrationPeriod).toBe('-');
  });

  it('should update equipment quantity and selection together', () => {
    const extension = component.equipment.find((item) => item.id === 'extension')!;

    component.changeEquipmentQuantity(extension, 1);

    expect(extension.quantity).toBe(1);
    expect(extension.selected).toBeTrue();
    expect(component.equipmentSubtotal).toBe(250);
  });

  it('should reject an invalid vehicle number and normalize valid input', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.equipment = [];
    component.requiresExtraPower = false;
    component.formData.vehicleNumber = 'ABC1234';

    component.goToConfirm();

    expect(component.showVehicleNumberError).toBeTrue();
    expect(navigateSpy).not.toHaveBeenCalled();

    component.normalizeVehicleNumber(' abc–1234 ');
    expect(component.formData.vehicleNumber).toBe('ABC-1234');
    expect(component.showVehicleNumberError).toBeFalse();
  });

  it('should check the vehicle number format when the value changes', () => {
    component.validationAttempted = false;

    component.normalizeVehicleNumber('ABC1234');

    expect(component.showVehicleNumberError).toBeTrue();

    component.normalizeVehicleNumber('1234-ab');
    expect(component.formData.vehicleNumber).toBe('1234-AB');
    expect(component.showVehicleNumberError).toBeFalse();
  });

  it('should accept supported Taiwan vehicle number formats', () => {
    component.validationAttempted = true;
    const validVehicleNumbers = [
      'ABC-1234',
      'ABC-123',
      'A1A-123',
      'AB-1234',
      'AB-12345',
      '1234-AB',
    ];

    for (const vehicleNumber of validVehicleNumbers) {
      component.formData.vehicleNumber = vehicleNumber;
      expect(component.showVehicleNumberError)
        .withContext(`${vehicleNumber} should be accepted`)
        .toBeFalse();
    }
  });

  it('should reject malformed vehicle numbers', () => {
    component.validationAttempted = true;
    const invalidVehicleNumbers = [
      'ABC1234',
      '123-456',
      '12-ABC',
      'ABCD-1234',
      'ABC-12345',
    ];

    for (const vehicleNumber of invalidVehicleNumbers) {
      component.formData.vehicleNumber = vehicleNumber;
      expect(component.showVehicleNumberError)
        .withContext(`${vehicleNumber} should be rejected`)
        .toBeTrue();
    }
  });

  it('should normalize full-width characters before validation and submission', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.equipment = [];
    component.requiresExtraPower = false;
    component.formData.vehicleNumber = ' ａｂｃ－１２３４ ';

    component.goToConfirm();

    expect(component.formData.vehicleNumber).toBe('ABC-1234');
    expect(component.showVehicleNumberError).toBeFalse();
    expect(navigateSpy).toHaveBeenCalled();
  });

  it('should limit daily rental units to the number of selected dates', () => {
    expect(component.rentalUnits('DAY')).toBe(2);

    component.toggleDate(market.slots![1]);

    expect(component.selectedDays).toBe(1);
    expect(component.rentalUnits('DAY')).toBe(1);
    expect(component.rentalUnits(null)).toBe(1);
    expect(component.rentalUnits('EVENT')).toBe(1);
    expect(component.rentalUnits('UNIT')).toBe(1);
  });

  it('should navigate to confirmation with the complete signup payload', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.formData.vehicleNumber = 'ABC-1234';
    component.equipment[0].eventEquipmentId = 1;
    component.equipment[1].eventEquipmentId = 2;
    component.powerOptions[0].eventEquipmentId = 3;
    component.powerOptions[1].eventEquipmentId = 4;

    component.goToConfirm();

    expect(navigateSpy).toHaveBeenCalled();
    const navigationExtras = navigateSpy.calls.mostRecent().args[1];
    expect(navigationExtras?.state?.['signup'].selectedSlots.length).toBe(2);
    expect(navigationExtras?.state?.['signup'].totalFee).toBe(3100);
    expect(navigationExtras?.state?.['signup'].applicationRequest).toEqual({
      eventId: 1,
      applyDates: ['2026-05-30', '2026-05-31'],
      vehicleNo: 'ABC-1234',
      applicantNote: null,
      equipmentRentals: [
        { eventEquipmentId: 1, quantity: 1, rentalUnits: 1 },
        { eventEquipmentId: 2, quantity: 2, rentalUnits: 1 },
        { eventEquipmentId: 3, quantity: 1, rentalUnits: 1 },
        { eventEquipmentId: 4, quantity: 1, rentalUnits: 1 },
      ],
    });
  });
});
