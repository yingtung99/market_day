import { Component, HostListener } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { OrganizerAccessService } from '../../../../core/services/organizer-access.service';
import { OrganizerProfileDialogService } from '../../../../core/services/organizer-profile-dialog.service';
import { VendorAccessService } from '../../../../core/Vendor/dashboardApi/vendor-access.service';
import { AuthPortalRole } from '../../../../models/interface/shared/Auth';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { MenuItem } from '../../../../models/interface/shared/MenuItem';
import { UserMenuItem } from '../../../../models/interface/shared/UserMenuItem';
import { OrganizerAccountSettings } from '../../../organizer/dashboard/organizer-account-settings/organizer-account-settings';
import { OrganizerProfileModal } from '../../../organizer/dashboard/modals/organizer-profile-modal/organizer-profile-modal';
import { VendorAccountSettings } from '../../../vendor/dashboard/vendor-account-settings/vendor-account-settings';
import { DashboardSidebar } from '../dashboard-sidebar/dashboard-sidebar';

@Component({
  selector: 'app-dashboard-layout',
  imports: [DashboardSidebar, RouterOutlet, VendorAccountSettings, OrganizerAccountSettings, OrganizerProfileModal],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss',
})
export class DashboardLayout {
  logoPath = '';
  homePath = '/';
  isSidebarCollapsed = false;
  isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 992;
  isMobileSidebarOpen = false;

  menuItems: MenuItem[] = [];
  userMenuItems: UserMenuItem[] = [];

  userName = '使用者';
  userEmail = '';
  userInitial = '使';
  role: AuthPortalRole = 'vendor';
  isLoggingOut = false;
  isAccountSettingsOpen = false;
  isOrganizerProfileOpen = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly alert: AlertService,
    private readonly organizerProfileDialog: OrganizerProfileDialogService,
    private readonly organizerAccess: OrganizerAccessService,
    private readonly vendorAccess: VendorAccessService,
  ) {
    const routeRole = this.route.snapshot.data['role'];
    if (this.authService.isPortalRole(routeRole)) {
      this.role = routeRole;
    }

    this.loadUserInfo();
    void this.loadCurrentUser();
    this.setupDashboardByRole();
    this.organizerProfileDialog.openRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.openOrganizerProfile());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMobileSidebar());

    if (this.role === 'organizer') {
      void this.organizerAccess.initialize(true);
    } else if (this.role === 'vendor') {
      void this.vendorAccess.initialize(true);
    }
  }

  get organizerProfileRequired(): boolean {
    return this.role === 'organizer' && this.organizerAccess.needsProfile() !== false;
  }

  get dashboardTitle(): string {
    if (this.role === 'admin') return '管理員後台';
    if (this.role === 'organizer') return '主辦方後台';
    return '攤主後台';
  }

  get vendorProfileRequired(): boolean {
    return this.role === 'vendor' && this.vendorAccess.needsProfile() !== false;
  }

  toggleSidebar(): void {
    if (this.isMobileViewport) {
      this.toggleMobileSidebar();
      return;
    }
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    this.isMobileViewport = window.innerWidth <= 992;
    if (!this.isMobileViewport) {
      this.closeMobileSidebar();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMobileSidebar();
  }

  async logout(): Promise<void> {
    this.closeMobileSidebar();
    if (this.isLoggingOut) {
      return;
    }

    const confirmed = await this.alert.confirm(
      '是否登出',
      '登出後將返回登入畫面。',
      '確認登出',
      '取消',
    );
    if (!confirmed) {
      return;
    }

    this.isLoggingOut = true;

    try {
      const response = await firstValueFrom(this.authService.logout(this.role));
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.warning(
          '登出狀態提醒',
          response.message || '系統已清除本機登入資訊，請重新登入。',
          '知道了'
        );
      }
    } catch {
      await this.alert.warning(
        '登出狀態提醒',
        '目前無法連線到登出 API，系統已先清除本機登入資訊。',
        '知道了'
      );
    } finally {
      this.authService.clearSession(this.role);
      this.isLoggingOut = false;
      await this.router.navigateByUrl(this.authService.getLoginPath(this.role));
    }
  }

  openAccountSettings(): void {
    this.closeMobileSidebar();
    if (this.role === 'admin') {
      return;
    }

    this.isAccountSettingsOpen = true;
  }

  closeAccountSettings(): void {
    this.isAccountSettingsOpen = false;
  }

  openOrganizerProfile(): void {
    this.closeMobileSidebar();
    if (this.role !== 'organizer') {
      return;
    }

    this.isOrganizerProfileOpen = true;
  }

  closeOrganizerProfile(): void {
    this.isOrganizerProfileOpen = false;
  }

  async handleLockedMenuItem(item: MenuItem): Promise<void> {
    if (item.requiresVendorProfile) {
      const openStallProfile = await this.alert.confirm(
        '請先完成攤位資料',
        `完成「我的攤位」資料並儲存後，才能使用「${item.label}」。`,
        '立即設定',
        '稍後再說',
      );

      if (openStallProfile) {
        await this.router.navigate(['/vendor/dash-board/myStall']);
      }
      return;
    }

    const openProfile = await this.alert.confirm(
      '請先完成主辦方資料',
      `完成主辦方資料並儲存後，才能使用「${item.label}」。`,
      '立即設定',
      '稍後再說',
    );

    if (openProfile) {
      this.openOrganizerProfile();
    }
  }

  async saveOrganizerProfile(): Promise<void> {
    await this.organizerAccess.refresh();
    await this.alert.success('主辦方資料已儲存', '資料已更新。');
  }

  /** 取得使用者資訊 */
  private loadUserInfo(): void {
    const user = this.authService.getUser(this.role);
    if (!user) {
      return;
    }

    this.applyUserInfo(user);
  }

  /** 進入後台時以 API 的最新帳號資料更新側邊欄與本機快取。 */
  private async loadCurrentUser(): Promise<void> {
    if (!(await this.authService.validateSession(this.role))) {
      return;
    }

    const user = this.authService.getUser(this.role);
    if (user) {
      this.applyUserInfo(user);
    }
  }

  private applyUserInfo(user: { name?: string; email?: string }): void {
    const name = user.name?.trim() || '使用者';
    this.userName = name;
    this.userEmail = user.email || '';
    this.userInitial = name.charAt(0) || '使';
  }

  private setupDashboardByRole(): void {
    if (this.role === 'vendor') {
      this.setupVendorDashboard();
      return;
    }

    if (this.role === 'organizer') {
      this.setupOrganizerDashboard();
      return;
    }

    this.setupAdminDashboard();
  }

  private setupVendorDashboard(): void {
    this.logoPath = '/assets/images/logo/logo-market-day-vendor.png';
    this.homePath = '/vendor/dash-board/home';

    this.menuItems = [
      { label: '攤主專區', icon: 'bi-arrow-left-circle', path: '/vendor/home' },
      { label: '首頁', icon: 'bi-house-door', path: '/vendor/dash-board/home' },
      { label: '通知中心', icon: 'bi-bell', path: '/vendor/dash-board/notification' },
      { label: '我的攤位', icon: 'bi-shop', path: '/vendor/dash-board/myStall' },
      {
        label: '我的報名紀錄',
        icon: 'bi-clipboard-check',
        path: '/vendor/dash-board/application-record',
        requiresVendorProfile: true,
      },
    ];

    this.userMenuItems = [
      { label: '帳號設定', icon: 'bi-person', action: 'account-settings' },
      { label: '登出', icon: 'bi-box-arrow-right', action: 'logout' },
    ];
  }

  private setupOrganizerDashboard(): void {
    this.logoPath = '/assets/images/logo/logo-market-day-organizer.png';
    this.homePath = '/organizer/dash-board/home';

    this.menuItems = [
      { label: '主辦方專區', icon: 'bi-arrow-left-circle', path: '/organizer/home' },
      { label: '首頁', icon: 'bi-house-door', path: '/organizer/dash-board/home' },
      { label: '通知中心', icon: 'bi-bell', path: '/organizer/dash-board/notification' },
      { label: '活動管理', icon: 'bi-calendar-event', path: '/organizer/dash-board/activity', requiresOrganizerProfile: true },
      { label: '報名管理', icon: 'bi-clipboard-check', path: '/organizer/dash-board/register', requiresOrganizerProfile: true },
      { label: '收款管理', icon: 'bi-cash-coin', path: '/organizer/dash-board/collection', requiresOrganizerProfile: true },
      { label: '攤位管理', icon: 'bi-shop', path: '/organizer/dash-board/stall', requiresOrganizerProfile: true },
      { label: '設備管理', icon: 'bi-box-seam', path: '/organizer/dash-board/equipment', requiresOrganizerProfile: true },
      { label: '帳務管理', icon: 'bi-receipt', path: '/organizer/dash-board/account', requiresOrganizerProfile: true },
    ];

    this.userMenuItems = [
      { label: '主辦方資料', icon: 'bi-person', action: 'organizer-profile' },
      { label: '帳號設定', icon: 'bi-gear', action: 'account-settings' },
      { label: '登出', icon: 'bi-box-arrow-right', action: 'logout' },
    ];
  }

  private setupAdminDashboard(): void {
    this.logoPath = '/assets/images/logo/logo-market-day-administrator.png';
    this.homePath = '/admin/dash-board/home';

    this.menuItems = [
      { label: '首頁', icon: 'bi-house-door', path: '/admin/dash-board/home' },
      { label: '通知中心', icon: 'bi-bell', path: '/admin/dash-board/notification' },
      { label: '活動管理', icon: 'bi-calendar-event', path: '/admin/dash-board/activity' },
      { label: '使用者管理', icon: 'bi-people', path: '/admin/dash-board/users', activePathPrefixes: ['/admin/dash-board/user/detail'] },
      { label: '操作紀錄', icon: 'bi-clock-history', path: '/admin/dash-board/logs' },
    ];

    this.userMenuItems = [
      { label: '登出', icon: 'bi-box-arrow-right', action: 'logout' },
    ];
  }
}
