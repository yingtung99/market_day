export interface OrganizerTaskSummary {
  pendingReviewCount: number;
  pendingRefundConfirmationCount: number;
  pendingStallSelectionCount: number;
  pendingPublishCount: number;
}

export interface OrganizerApplicationCategory {
  id: number;
  name: string;
  slug: string;
}

export interface OrganizerApplicationSummary {
  applicationId: number;
  eventTitle: string;
  eventCoverImageUrl: string | null;
  eventTime: string;
  vendorName: string;
  category: OrganizerApplicationCategory | null;
  vendorOwnerName: string;
  appliedAt: string;
  applicationStatus: string;
}

export interface OrganizerApplicationSearchResponse {
  taskSummary: OrganizerTaskSummary;
  totalCount: number;
  applications: {
    items: OrganizerApplicationSummary[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

export interface OrganizerApplicationReviewRequest {
  reviewNote: string;
  reviewNoteDetail: string;
}

export interface OrganizerApplicationReviewResponse {
  applicationId?: number;
  applicationStatus?: string;
  reviewStatus?: string;
  reviewedAt?: string;
  [key: string]: unknown;
}

export interface OrganizerApplicationStatusItem {
  key: string;
  label: string;
  value: string | null;
  createdAt: string | null;
}

export interface OrganizerApplicationDetailResponse {
  application: {
    applicationId: number;
    applicationNo: string | null;
    applicationStatus: string;
  };
  event: {
    eventId: number;
    eventCoverImageUrl: string | null;
    eventTitle: string;
    workflowStatus: string | null;
    unpublishRequested: boolean;
    unpublished: boolean;
    eventStatus: string;
    statusNote: string | null;
    eventTime: string;
    eventStartAt: string | null;
    eventEndAt: string | null;
    locationName: string | null;
    address: string | null;
  };
  vendor: {
    vendorOwnerName: string | null;
    vendorPhone: string | null;
    vendorEmail: string | null;
    address: string | null;
  };
  brand: {
    brandId: number | null;
    brandName: string | null;
    avatarImageUrl: string | null;
    category: OrganizerApplicationCategory | null;
    brandDescription: string | null;
  };
  applicationdetail: {
    registrationPeriods: string | null;
    width: number | null;
    length: number | null;
    stallZone: string | null;
    vehicleNo: string | null;
    applicantNote: string | null;
    reviewNote: string | null;
    reviewNoteDetail: string | null;
  };
  stall: Array<{
    applyDate: string;
    stallNo: string | null;
    zoneName: string | null;
    selectionStatus: string;
  }>;
  fee: {
    paymentStatus: string | null;
    paymentMethod: string | null;
    paymentNo: string | null;
    providerTradeNo: string | null;
    paidAt: string | null;
    paymentAmount: number | null;
  };
  refund: {
    refundStatus: string | null;
    refundStatusText: string | null;
    refundMethod: string | null;
    refundNo: string | null;
    refundAmount: number | null;
    refundedAt: string | null;
  } | null;
  feedetail: Array<{
    item: string;
    content: string | null;
    amount: number | null;
  }>;
  equipmentRentals: {
    freeEquipments: Array<Record<string, unknown>>;
    freeBasicPower: Array<Record<string, unknown>>;
    rentalEquipments: Array<Record<string, unknown>>;
    extraPower: Array<Record<string, unknown>>;
  };
  status: OrganizerApplicationStatusItem[];
}

export interface OrganizerDepositRefundResponse {
  applicationId: number;
  applicationNo: string | null;
  eventId: number;
  userId: number;
  depositAmount: number;
  depositStatus: string;
  refundMethod: string;
}
