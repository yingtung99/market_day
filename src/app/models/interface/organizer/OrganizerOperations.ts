export interface OrganizerPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface OrganizerOperationSearchParams {
  eventTitle?: string;
  status?: string;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  page?: number;
  pageSize?: number;
}

export interface OrganizerStallEventSummary {
  eventId: number;
  eventTitle: string;
  coverImageUrl: string | null;
  eventDate: string;
  address: string;
  totalStallCount: number;
  availableStallCount: number;
  selectedStallCount: number;
  status: string;
  statusNote: string | null;
}

export interface OrganizerStallSearchResponse {
  totalCount: number;
  events: OrganizerPage<OrganizerStallEventSummary>;
}

export interface OrganizerStallVendor {
  brandId: number;
  name: string | null;
  category: { id: number; name: string; slug: string } | null;
  ownerName: string | null;
  selectedAt: string | null;
}

export interface OrganizerStallMapItem {
  stallId: number;
  stallNo: string;
  zoneId: number;
  width: number | null;
  length: number | null;
  status: string;
  selectedApplicationId: number | null;
  selectedVendor?: OrganizerStallVendor | null;
}

export interface OrganizerStallZone {
  zoneName: string;
  zoneId: number;
  stalls: OrganizerStallMapItem[];
}

export interface OrganizerStallMapResponse {
  event: {
    eventId: number;
    eventTitle: string;
    locationName: string | null;
    eventStatus: string;
    statusNote: string | null;
    totalStallCount: number;
    selectedStallCount: number;
    availableStallCount: number;
    startAt: string;
    endAt: string;
    currentApplyDate: string;
    address: string;
    mapImageUrl: string | null;
  };
  stalls: OrganizerStallZone[];
}

export interface OrganizerStallDetailResponse {
  stall: {
    stallId: number;
    stallNo: string;
    zoneId: number;
    zoneName: string;
    width: number | null;
    length: number | null;
    status: string;
    applyDate: string;
    selectedAt: string | null;
  };
  application: { id: number } | null;
  vendor: {
    brandName: string | null;
    category: { id: number; name: string; slug: string } | null;
    vendorOwnerName: string | null;
    vendorPhone: string | null;
    vendorEmail: string | null;
  } | null;
}

export interface OrganizerEquipmentSummary {
  eventId: number;
  eventTitle: string;
  coverImageUrl: string | null;
  eventDate: string;
  status: string;
  statusNote: string | null;
  registeredStallCount: number;
  freeEquipmentRentalCount: number;
  paidEquipmentRentalCount: number;
  freePowerRentalCount: number;
  paidExtraPowerRentalCount: number;
  vehicleRegistrationCount: number;
}

export interface OrganizerEquipmentSearchResponse {
  totalCount: number;
  events: OrganizerPage<OrganizerEquipmentSummary>;
}

export interface OrganizerPagedSection<T> extends OrganizerPage<T> {
  totalCount: number;
}

export interface OrganizerEquipmentDetailResponse {
  event: Record<string, unknown>;
  equipmentOverview: Record<string, number>;
  eventEquipments: Record<string, unknown>[];
  basicPowers: Record<string, unknown>[];
  extraPowers: Record<string, unknown>[];
  equipmentRentalStatistics: Record<string, unknown>[];
  extraPowerApplicationStatistics: Record<string, unknown>[];
  vehicleRegistrationStatistics: Record<string, number>;
  equipmentRentalManagement: OrganizerPagedSection<Record<string, unknown>>;
  extraPowerManagement: OrganizerPagedSection<Record<string, unknown>>;
  vehicleManagement: OrganizerPagedSection<Record<string, unknown>>;
}

export interface OrganizerAccountingSummary {
  eventId: number;
  eventTitle: string;
  coverImageUrl: string | null;
  publishStatus: string;
  publishStatusText: string;
  statusNote: string | null;
  eventDate: string;
  paidStallCount: number;
  totalStallCount: number;
  paidStallText: string;
  grossRevenue: number;
  refundAmount: number;
  returnedDepositAmount: number;
  unreturnedDepositAmount: number;
  netRevenue: number;
}

export interface OrganizerAccountingSearchResponse {
  totalCount: number;
  accounts: OrganizerPage<OrganizerAccountingSummary>;
}

export interface OrganizerAccountingDetailResponse {
  event: Record<string, unknown>;
  summary: Record<string, number>;
  statistics: {
    payment: Record<string, number>;
    refund: Record<string, number>;
    deposit: Record<string, number>;
  };
  payments: OrganizerPagedSection<Record<string, unknown>>;
}
