export interface AdminDashboardNotice {
  id: number;
  type: string;
  targetType: string;
  targetId: number;
  title: string;
  content: string;
  isRead: boolean;
  time: string;
}

export interface AdminDashboardOverview {
  pendingReview: number;
  mapBuilding: number;
  pendingUnpublish: number;
  systemWarning: number;
  totalOrganizer: number;
  totalVender: number;
  totalActivity: number;
  active: number;
  notices: AdminDashboardNotice[];
}
