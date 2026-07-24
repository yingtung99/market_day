import type { Page, Route } from '@playwright/test';
import type {
  VendorApplicationApiDetail,
  VendorApplicationApiStatusStep,
} from '../../src/app/models/interface/vendor/VendorApplicationApiDetail';
import type { VendorMarketDetail } from '../../src/app/models/interface/vendor/VendorMarketDetail';
import type {
  VendorMarketSearchItem,
  VendorMarketSearchResponse,
} from '../../src/app/models/interface/vendor/VendorMarketSearch';
import type { VendorStallMap } from '../../src/app/models/interface/vendor/VendorStallMap';
import { createUnsignedJwt } from '../auth-test-helpers';
import { vendorTestData } from './vendor-test-data';

export const VENDOR_EVENT_ID = vendorTestData.ids.eventId;
export const VENDOR_APPLICATION_ID = vendorTestData.ids.applicationId;
export const VENDOR_APPLICATION_NO = vendorTestData.ids.applicationNo;

export const vendorUser = vendorTestData.user;

export function apiResult<T>(
  data: T,
  options: { statusCode?: number; message?: string; messageDetails?: string | null } = {},
) {
  return {
    statusCode: options.statusCode ?? 200,
    message: options.message ?? 'ok',
    messageDetails: options.messageDetails ?? null,
    data,
  };
}

export async function fulfillApi<T>(
  route: Route,
  data: T,
  options: {
    statusCode?: number;
    message?: string;
    messageDetails?: string | null;
    httpStatus?: number;
  } = {},
): Promise<void> {
  await route.fulfill({
    status: options.httpStatus ?? 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(apiResult(data, options)),
  });
}

export async function installVendorShellStubs(
  page: Page,
  options: { needsProfile?: boolean; missingProfile?: boolean } = {},
): Promise<void> {
  const token = createUnsignedJwt({
    sub: 'vendor-e2e',
    role: 'VENDOR',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  await page.addInitScript(({ sessionToken, user }) => {
    localStorage.setItem('MarketDayToken_vendor', sessionToken);
    localStorage.setItem('MarketDayUser_vendor', JSON.stringify(user));
  }, { sessionToken: token, user: vendorUser });

  await page.route('**/api/auth/me', (route) => fulfillApi(route, { user: vendorUser }));
  await page.route('**/api/vendor/dashboard/init', (route) => fulfillApi(route, {
    needsProfile: options.needsProfile ?? false,
    guideMessage: options.needsProfile ? '請先完成攤位資料' : null,
    name: vendorUser.name,
    pendingReviewCount: 0,
    pendingPaymentCount: 0,
    pendingStallSelectionCount: 0,
    pendingRefundCount: 0,
    notifications: [],
  }));
  await page.route('**/api/addresses/cities', (route) => fulfillApi(route, ['臺北市', '臺中市']));
  await page.route('**/api/addresses/districts?*', (route) => fulfillApi(route, ['中正區', '西屯區']));

  if (options.missingProfile ?? true) {
    await page.route('**/api/vendor/stall/load', (route) => fulfillApi(route, null, {
      statusCode: 404,
      message: '找不到攤位資料',
    }));
  }
}

export async function installVendorPublicStubs(page: Page): Promise<void> {
  await page.route('**/api/addresses/cities', (route) =>
    fulfillApi(route, ['臺北市', '臺中市']),
  );
  await page.route('**/api/addresses/districts?*', (route) =>
    fulfillApi(route, ['中正區', '西屯區']),
  );
}

export function createMarketDetail(
  overrides: Partial<VendorMarketDetail> = {},
): VendorMarketDetail {
  const market = vendorTestData.market;
  const profile = vendorTestData.profile;

  return {
    eventId: VENDOR_EVENT_ID,
    eventTitle: market.title,
    summary: market.summary,
    description: market.description,
    locationName: market.locationName,
    city: market.city,
    district: market.district,
    address: market.address,
    notice: market.notice,
    startAt: market.startAt,
    endAt: market.endAt,
    registrationStartAt: market.registrationStartAt,
    registrationEndAt: market.registrationEndAt,
    maxBooths: market.maxBooths,
    baseFee: vendorTestData.fees.registrationFee,
    depositAmount: vendorTestData.fees.depositAmount,
    coverImageUrl: market.coverImageUrl,
    mapImageUrl: null,
    categories: [{
      id: profile.categoryId,
      name: profile.categoryName,
      slug: profile.categorySlug,
    }],
    categoryName: profile.categoryName,
    organizerName: market.organizerName,
    companyName: market.companyName,
    serviceDays: market.serviceDays,
    serviceStartTime: market.serviceStartTime,
    serviceEndTime: market.serviceEndTime,
    contactName: market.contactName,
    contactPhone: market.contactPhone,
    contactEmail: market.contactEmail,
    stallWidth: market.stallWidth,
    stallLength: market.stallLength,
    stallHeight: market.stallHeight,
    registrationStatus: market.registrationStatus,
    dailyAvailability: market.dailyAvailability.map((item) => ({ ...item })),
    equipments: [
      {
        eventEquipmentId: 11,
        equipmentGroupKey: 'table',
        name: '展示桌',
        description: '180 × 60 公分',
        rentalFee: 200,
        pricingUnit: 'EVENT',
        unit: '張',
        chargeType: 'PAID',
        itemType: 'EQUIPMENT',
        stockQuantity: 10,
        perStallRentalLimit: 2,
        wattageLimit: null,
      },
      {
        eventEquipmentId: 21,
        equipmentGroupKey: 'power-110',
        name: '110V 額外用電',
        description: null,
        rentalFee: 200,
        pricingUnit: 'EVENT',
        unit: '組',
        chargeType: 'PAID',
        itemType: 'POWER',
        stockQuantity: null,
        perStallRentalLimit: 1,
        wattageLimit: 1000,
      },
    ],
    trafficInfos: [{ id: 1, trafficTitle: '捷運', trafficDetails: '步行約 5 分鐘' }],
    ...overrides,
  };
}

export function createMarketSearchItem(
  detail = createMarketDetail(),
  overrides: Partial<VendorMarketSearchItem> = {},
): VendorMarketSearchItem {
  return {
    eventId: detail.eventId,
    eventTitle: detail.eventTitle,
    summary: detail.summary,
    locationName: detail.locationName,
    city: detail.city,
    district: detail.district,
    address: detail.address,
    maxBooths: detail.maxBooths,
    startAt: detail.startAt,
    endAt: detail.endAt,
    registrationStartAt: detail.registrationStartAt,
    registrationEndAt: detail.registrationEndAt,
    baseFee: detail.baseFee,
    trafficTitle: detail.trafficInfos[0]?.trafficTitle ?? null,
    trafficDetail: detail.trafficInfos[0]?.trafficDetails ?? null,
    categories: detail.categories,
    categoryName: detail.categoryName,
    organizerName: detail.organizerName,
    imageUrl: detail.coverImageUrl,
    registrationStatus: detail.registrationStatus,
    ...overrides,
  };
}

export function createMarketSearchResponse(
  items: VendorMarketSearchItem[],
  options: { page?: number; pageSize?: number; totalItems?: number } = {},
): VendorMarketSearchResponse {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 6;
  const totalItems = options.totalItems ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    markets: {
      items,
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

export async function stubMarketDetail(
  page: Page,
  detail = createMarketDetail(),
): Promise<void> {
  await page.route(`**/api/vendor/markets/${detail.eventId}`, (route) => fulfillApi(route, detail));
}

export function createApplicationDetail(
  applicationStatus = '待付款',
  options: { selected?: boolean; paymentStatus?: string | null } = {},
): VendorApplicationApiDetail {
  const selected = options.selected ?? ['報名完成', '保證金已退還'].includes(applicationStatus);
  const paid = !['待審核', '待付款', '審核未通過', '已取消'].includes(applicationStatus);
  const refundRequested = ['退款申請中', '退款處理中', '已退款'].includes(
    applicationStatus,
  );
  const refunded = applicationStatus === '已退款';
  const market = vendorTestData.market;
  const profile = vendorTestData.profile;
  const application = vendorTestData.application;
  const payment = vendorTestData.payment;
  const refund = vendorTestData.refund;
  const availableBooth = vendorTestData.booth.available;
  const status: VendorApplicationApiStatusStep[] = [{
    key: 'APPLIED',
    label: '報名送出',
    value: '已送出',
    createdAt: application.createdAt,
  }];

  if (!['待審核', '已取消'].includes(applicationStatus)) {
    status.push({
      key: 'REVIEWED',
      label: '審核結果',
      value: applicationStatus === '審核未通過' ? '未通過' : '已通過',
      createdAt: '2026-07-12T12:00:00',
    });
  }
  if (paid) {
    status.push({
      key: 'PAID',
      label: '付款狀態',
      value: '已付款',
      createdAt: payment.paidAt,
    });
  }
  if (selected) {
    status.push({
      key: 'BOOTH_SELECTED',
      label: '選位狀態',
      value: '已完成選位',
      createdAt: '2026-07-21T10:00:00',
    });
  }
  if (refundRequested) {
    status.push({
      key: 'REFUND_REQUESTED',
      label: '退款申請',
      value: '已申請',
      createdAt: refund.requestedAt,
    });
  }
  if (['退款處理中', '已退款'].includes(applicationStatus)) {
    status.push({
      key: 'REFUND_PROCESSING',
      label: '退款處理',
      value: '處理中',
      createdAt: refund.processingAt,
    });
  }
  if (refunded) {
    status.push({
      key: 'REFUNDED',
      label: '退款完成',
      value: '已退款',
      createdAt: refund.refundedAt,
    });
  }

  return {
    application: {
      applicationId: VENDOR_APPLICATION_ID,
      applicationNo: VENDOR_APPLICATION_NO,
      applicationStatus,
    },
    event: {
      eventId: VENDOR_EVENT_ID,
      eventCoverImageUrl: market.coverImageUrl,
      eventTitle: market.title,
      eventStatus: '活動準備中',
      statusNote: '報名中',
      eventTime: '2026/08/01 - 2026/08/02',
      eventStartAt: market.startAt,
      eventEndAt: market.endAt,
      locationName: `${market.city}${market.district} ${market.locationName}`,
      address: market.fullAddress,
    },
    vendor: {
      vendorOwnerName: vendorTestData.contact.ownerName,
      vendorPhone: vendorTestData.contact.phone,
      vendorEmail: vendorTestData.contact.email,
      address: vendorTestData.contact.fullAddress,
    },
    brand: {
      brandName: profile.brandName,
      categoryName: profile.categoryName,
      brandDescription: profile.description,
    },
    applicationdetail: {
      registrationPeriods: application.registrationPeriods,
      width: availableBooth.width,
      length: availableBooth.length,
      stallZone: selected ? availableBooth.zoneName : null,
      stallCategory: profile.categoryName,
      vehicleNo: application.vehicleNo,
      applicantNote: application.applicantNote,
      reviewNote: applicationStatus === '審核未通過' ? application.rejectedReason : null,
      reviewNoteDetail: applicationStatus === '審核未通過'
        ? application.rejectedReason
        : null,
    },
    stall: [{
      applyDate: application.applyDate,
      stallNo: selected ? availableBooth.stallNo : null,
      zoneName: selected ? availableBooth.zoneName : null,
      selectionStatus: selected ? '已選位' : '未選位',
    }],
    fee: {
      paymentStatus: options.paymentStatus ?? (paid ? '已付款' : '待付款'),
      paymentMethod: paid ? payment.paymentMethod : null,
      paymentNo: paid ? payment.paymentNo : null,
      providerTradeNo: paid ? payment.providerTradeNo : null,
      paidAt: paid ? payment.paidAt : null,
      paymentAmount: vendorTestData.fees.baseTotal,
    },
    refund: {
      refundStatus: refundRequested ? applicationStatus : null,
      refundStatusText: refundRequested ? applicationStatus : null,
      refundMethod: refundRequested ? refund.method : null,
      refundNo: refunded ? refund.refundNo : null,
      refundAmount: refundRequested ? refund.refundableAmount : null,
      refundedAt: refunded ? refund.refundedAt : null,
    },
    feedetail: [
      {
        item: '報名費',
        content: '1 天',
        amount: vendorTestData.fees.registrationFee,
      },
      {
        item: '保證金',
        content: '活動保證金',
        amount: vendorTestData.fees.depositAmount,
      },
      { item: '總計', content: null, amount: vendorTestData.fees.baseTotal },
    ],
    equipmentRentals: {
      freeEquipments: [],
      freeBasicPower: [],
      rentalEquipments: [],
      extraPower: [],
    },
    status,
  };
}

export function createApplicationStatusFixtures(): Record<string, VendorApplicationApiDetail> {
  const statuses = [
    ...vendorTestData.application.validStatuses,
    ...vendorTestData.application.reapplicableStatuses,
  ];

  return Object.fromEntries(
    statuses.map((status) => [status, createApplicationDetail(status)]),
  );
}

export function createDepositDetail(refunded: boolean): VendorApplicationApiDetail {
  const detail = createApplicationDetail(refunded ? '保證金已退還' : '報名完成', {
    selected: true,
  });
  const deposit = vendorTestData.deposit;

  detail.status.push({
    key: refunded ? 'DEPOSIT_REFUNDED' : 'DEPOSIT_WITHHELD',
    label: '保證金',
    value: refunded ? deposit.refundedStatus : deposit.withheldStatus,
    createdAt: refunded ? deposit.refundedAt : vendorTestData.market.endAt,
  });

  return detail;
}

export async function stubApplicationDetail(
  page: Page,
  detail: VendorApplicationApiDetail,
): Promise<void> {
  await page.route(
    `**/api/vendor/applications/${detail.application.applicationId}`,
    (route) => fulfillApi(route, detail),
  );
}

export function createStallMap(selected = false): VendorStallMap {
  const market = vendorTestData.market;
  const profile = vendorTestData.profile;
  const application = vendorTestData.application;
  const available = vendorTestData.booth.available;
  const occupied = vendorTestData.booth.occupied;

  return {
    application: {
      applicationNo: VENDOR_APPLICATION_NO,
      applicationStatus: selected ? '報名完成' : '待選位',
      vendorName: profile.brandName,
      currentApplyDate: application.applyDate,
      applyDates: application.applyDate,
      applyDateCount: 1,
      selectedStalls: selected
        ? [{
            selectedStallId: available.stallId,
            applyDate: application.applyDate,
            stallNo: available.stallNo,
            zoneName: available.zoneName,
            width: available.width,
            length: available.length,
          }]
        : [],
      alreadyselectdate: selected ? [application.applyDate] : [],
    },
    event: {
      eventTitle: market.title,
      startAt: market.startAt,
      endAt: market.endAt,
      address: market.fullAddress,
    },
    stalls: [
      {
        ...available,
        status: selected ? 'SELECTED' : 'AVAILABLE',
        selectedApplicationId: selected ? VENDOR_APPLICATION_ID : null,
      },
      {
        ...occupied,
        status: 'SELECTED',
        selectedApplicationId: vendorTestData.ids.occupiedApplicationId,
      },
    ],
  };
}
