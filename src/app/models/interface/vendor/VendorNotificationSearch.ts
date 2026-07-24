import { VendorDashboardNotification } from './VendorDashboardInit';

export interface VendorNotificationPage {
  items: VendorDashboardNotification[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface VendorNotificationSearchResult {
  unreadCount: number;
  notifications: VendorNotificationPage;
}

