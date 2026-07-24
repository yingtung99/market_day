import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { VendorDashboardService } from '../../../../core/Vendor/dashboardApi/vendor-dashboard.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import {
  VendorDashboardInit,
  VendorDashboardNotification,
} from '../../../../models/interface/vendor/VendorDashboardInit';
import { DashboardHomeTodoCard } from '../../../shared/dashboard/dashboard-home-todo-card/dashboard-home-todo-card';
import {
  DashboardNotification,
  NotificationItem,
} from '../../../shared/dashboard/dashboard-notification/dashboard-notification';
import { LoadingSpinner } from '../../../shared/loading-spinner/loading-spinner';
import { NotificationApiService } from '../../../../core/services/notification-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationTypeDisplay } from '../../../../models/type/NotificationTypeDisplay';

interface VendorHomeCard {
  icon: string;
  count: number;
  unit: string;
  label: string;
  path?: string;
  iconColor?: string;
}

@Component({
  selector: 'app-vendor-dashboard-home',
  imports: [RouterLink, DashboardHomeTodoCard, DashboardNotification, LoadingSpinner],
  templateUrl: './vendor-dashboard-home.html',
  styleUrl: './vendor-dashboard-home.scss',
})
export class VendorDashboardHome implements OnInit {
  hasRecords: boolean | null = null;
  loadError = '';
  guideMessage = '';
  todoItems: VendorHomeCard[] = [];
  notifications: NotificationItem[] = [];

  readonly homeNotificationMaxItems = 6;
  private dashboardVendorName = '';

  constructor(
    private readonly authService: AuthService,
    private readonly vendorDashboardService: VendorDashboardService,
    private readonly notificationApi: NotificationApiService,
    private readonly alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.hasRecords = null;
    this.loadError = '';

    this.vendorDashboardService.getVendorFirstLogin().subscribe({
      next: (response) => {
        const dashboard = response.data;
        if (!isApiSuccessStatus(response.statusCode) || !dashboard) {
          this.loadError = response.message || '首頁資料載入失敗，請稍後再試。';
          return;
        }

        this.hasRecords = !dashboard.needsProfile;
        this.guideMessage = dashboard.guideMessage ?? '';
        this.dashboardVendorName = dashboard.name?.trim() ?? '';

        if (dashboard.needsProfile) {
          return;
        }

        this.hasRecords = null;
        this.vendorDashboardService.searchVendorApplications({ page: 1, pageSize: 1 }).subscribe({
          next: (applicationResponse) => {
            if (!isApiSuccessStatus(applicationResponse.statusCode)) {
              this.loadError = applicationResponse.message || '報名紀錄數量載入失敗，請稍後再試。';
              return;
            }

            this.hasRecords = true;
            this.setDashboardContent(dashboard, applicationResponse.data.totalCount);
          },
          error: () => {
            this.loadError = '報名紀錄數量載入失敗，請重新整理後再試。';
          },
        });
      },
      error: () => {
        this.loadError = '首頁資料載入失敗，請重新整理後再試。';
      },
    });
  }

  private setDashboardContent(dashboard: VendorDashboardInit, applicationCount: number): void {
    this.todoItems = [
      {
        icon: 'bi-clipboard-check',
        count: dashboard.pendingReviewCount,
        unit: '筆',
        label: '待審核報名',
        path: '/vendor/dash-board/application-record',
        iconColor: 'orange',
      },
      {
        icon: 'bi-wallet2',
        count: dashboard.pendingPaymentCount,
        unit: '筆',
        label: '待付款報名',
        path: '/vendor/dash-board/application-record',
        iconColor: 'orange',
      },
      {
        icon: 'bi-shop',
        count: dashboard.pendingStallSelectionCount,
        unit: '筆',
        label: '待選擇攤位',
        path: '/vendor/dash-board/application-record',
        iconColor: 'blue',
      },
      {
        icon: 'bi-journal-check',
        count: applicationCount,
        unit: '筆',
        label: '我的報名紀錄',
        path: '/vendor/dash-board/application-record',
        iconColor: 'purple',
      },
    ];
    this.notifications = (dashboard.notifications ?? []).map((item) =>
      this.toNotificationItem(item),
    );
  }

  get vendorName(): string {
    return this.dashboardVendorName
      || this.authService.getUser('vendor')?.name?.trim()
      || '攤主';
  }

  onMarkRead(item: NotificationItem): void {
    if (item.id == null) return;

    this.notificationApi.markAsRead(item.id, { skipLoading: true }).subscribe({
      next: async (response) => {
        if (!isApiSuccessStatus(response.statusCode)) {
          item.unread = true;
          await this.alert.error('標記已讀失敗', response.message || '請稍後再試。');
        }
      },
      error: async (error) => {
        item.unread = true;
        await this.alert.error('標記已讀失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  private toNotificationItem(item: VendorDashboardNotification): NotificationItem {
    const type = this.normalizeType(item.type);
    const display = NotificationTypeDisplay.getDisplay(type);
    return {
      id: item.id,
      status: display.status,
      title: item.content?.trim() || item.title,
      date: this.formatDateTime(item.createdAt),
      icon: display.icon,
      iconClass: display.iconClass,
      unread: !item.isRead,
      type,
    };
  }

  private normalizeType(type: string): string {
    if (!type.includes('_')) return type;
    return type
      .toLowerCase()
      .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  }

  private formatDateTime(value: string): string {
    return value ? value.replace('T', ' ').slice(0, 16).replaceAll('-', '/') : '';
  }
}
