import { Component, HostListener, OnInit } from '@angular/core';
import { AdminDashboardNotification } from '../admin-dashboard-notification/admin-dashboard-notification';
import { DashboardHomeTodoCard } from '../../../shared/dashboard/dashboard-home-todo-card/dashboard-home-todo-card';
import { DashboardNotification } from '../../../shared/dashboard/dashboard-notification/dashboard-notification';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationApiService } from '../../../../core/services/notification-api.service';
import { AdminDashboardOverview } from '../../../../models/interface/admin/AdminDashboardOverview';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';

/**
 * 管理員首頁待處理事項資料格式
 */
interface TodoItem {
  icon: string;
  count: number;
  unit: string;
  label: string;
  path: string;
  queryParams?: Record<string, string>;
  iconColor?: string;
}

/**
 * 管理員首頁平台概況資料格式
 */
interface StatItem {
  icon: string;
  value: number;
  unit: string;
  label: string;
  iconColor?: string;
}

@Component({
  selector: 'app-admin-dashboard-home',
  imports: [DashboardHomeTodoCard, DashboardNotification],
  templateUrl: './admin-dashboard-home.html',
  styleUrl: './admin-dashboard-home.scss',
})
export class AdminDashboardHome extends AdminDashboardNotification implements OnInit {
  /**
   * 首頁最新通知顯示筆數
   *
   * 小畫面：顯示 3 筆
   * 大畫面：顯示 4 筆
   */
  homeNotificationMaxItems = 4;

  constructor(
    adminApiService: AdminApiService,
    alert: AlertService,
    notificationApiService: NotificationApiService,
  ) {
    super(adminApiService, alert, notificationApiService);
  }

  /**
   * 元件初始化時，先依照目前畫面高度決定最新通知顯示筆數，並讀取後台概況資料
   */
  override ngOnInit(): void {
    this.updateHomeNotificationMaxItems();
    this.loadDashboardOverview();
  }

  /**
   * 監聽瀏覽器視窗大小變化
   *
   * 當使用者調整視窗高度時，重新計算最新通知顯示筆數
   */
  @HostListener('window:resize')
  onResize(): void {
    this.updateHomeNotificationMaxItems();
  }

  /**
   * 依照視窗高度更新首頁最新通知顯示筆數
   *
   * 最少顯示 2 筆
   * 最多顯示 6 筆
   */
  private updateHomeNotificationMaxItems(): void {
    const height = window.innerHeight;

    const usedHeight = 455;
    const notificationItemHeight = 76;

    const availableHeight = height - usedHeight;
    const count = Math.floor(availableHeight / notificationItemHeight);

    this.homeNotificationMaxItems = Math.min(6, Math.max(4, count));
  }

  /**
   * 待處理事項卡片資料
   */
  todoItems: TodoItem[] = [];

  /**
   * 平台概況卡片資料
   */
  platformStats: StatItem[] = [];

  /**
   * 串接 API："/api/admin/dashboard/overview"，取得後台概況資料並更新待處理事項與平台概況卡片
   */
  private loadDashboardOverview(): void {
    this.adminApiService.getDashboardOverview().subscribe({
      next: async (res) => {
        if (!isApiSuccessStatus(res.statusCode)) {
          await this.alert.error('讀取失敗', res.message);
          return;
        }

        this.applyOverview(res.data);
      },
      error: async (error) => {
        await this.alert.error('讀取失敗', error.error?.message || '請稍後再試。');
      },
    });
  }

  /**
   * 將 API 回傳的後台概況資料轉換成待處理事項與平台概況卡片資料
   */
  private applyOverview(data: AdminDashboardOverview): void {
    this.todoItems = [
      {
        icon: 'bi-calendar-event',
        count: data.pendingReview,
        unit: '筆',
        label: '活動審核',
        path: '/admin/dash-board/activity',
        queryParams: { status: ActivityStatus.pendingReview },
        iconColor: 'orange',
      },
      {
        icon: 'bi-map',
        count: data.mapBuilding,
        unit: '筆',
        label: '活動地圖建置',
        path: '/admin/dash-board/activity',
        queryParams: { status: ActivityStatus.mapBuilding },
        iconColor: 'orange',
      },
      {
        icon: 'bi-arrow-down',
        count: data.pendingUnpublish,
        unit: '筆',
        label: '活動下架申請',
        path: '/admin/dash-board/activity',
        queryParams: { status: ActivityStatus.unpublishRequested },
        iconColor: 'orange',
      },
      {
        icon: 'bi-exclamation-triangle',
        count: data.systemWarning,
        unit: '筆',
        label: '異常提醒',
        path: '/admin/dash-board/notification',
        iconColor: 'red',
      },
    ];

    this.platformStats = [
      { icon: 'bi-people', value: data.totalOrganizer, unit: '位', label: '主辦方總數', iconColor: 'teal' },
      { icon: 'bi-shop', value: data.totalVender, unit: '位', label: '攤主總數', iconColor: 'blue' },
      { icon: 'bi-calendar-check', value: data.totalActivity, unit: '場', label: '活動總數', iconColor: 'purple' },
      { icon: 'bi-flag', value: data.active, unit: '場', label: '進行中活動', iconColor: 'green' },
    ];

    this.notifications = this.mapNotices(data.notices);
  }
}
