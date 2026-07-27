import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../../../../models/interface/shared/MenuItem';
import { UserMenuItem } from '../../../../models/interface/shared/UserMenuItem';

@Component({
  selector: 'app-dashboard-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.scss',
})
export class DashboardSidebar {
  constructor(private readonly router: Router) {}

  /** Logo 圖片路徑 */
  @Input() logoPath = '';
  @Input() collapsedLogoPath = '/assets/images/logo/logo-market-day-little.png';

  /** Logo 點擊後導向的首頁路徑 */
  @Input() homePath = '/';

  /** 側邊欄選單 */
  @Input() menuItems: MenuItem[] = [];

  /** 使用者功能選單 */
  @Input() userMenuItems: UserMenuItem[] = [];

  /** 是否尚未完成主辦方資料。 */
  @Input() organizerProfileRequired = false;

  /** 是否尚未完成主辦方首次設定。 */
  @Input() organizerSetupRequired = false;

  /** 是否只缺少藍新帳戶驗證。 */
  @Input() organizerNewebPayRequired = false;

  /** 是否尚未完成攤位資料。 */
  @Input() vendorProfileRequired = false;

  /** 使用者頭像文字 */
  @Input() userInitial = '';

  /** 使用者名稱 */
  @Input() userName = '';

  /** 使用者 Email */
  @Input() userEmail = '';
  @Input() isCollapsed = false;

  @Output() collapseToggle = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();
  @Output() accountSettingsRequested = new EventEmitter<void>();
  @Output() organizerProfileRequested = new EventEmitter<void>();
  @Output() lockedMenuItemRequested = new EventEmitter<MenuItem>();
  @Output() menuItemSelected = new EventEmitter<void>();

  /** 使用者選單是否展開 */
  isUserMenuOpen = false;

  /** 切換使用者選單 */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  toggleCollapse(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = false;
    this.collapseToggle.emit();
  }

  /** 登出 */
  logout(): void {
    this.isUserMenuOpen = false;
    this.logoutRequested.emit();
  }

  openAccountSettings(): void {
    this.isUserMenuOpen = false;
    this.accountSettingsRequested.emit();
  }

  openOrganizerProfile(): void {
    this.isUserMenuOpen = false;
    this.organizerProfileRequested.emit();
  }

  isMenuItemLocked(item: MenuItem): boolean {
    return (this.organizerSetupRequired && item.requiresOrganizerSetup === true)
      || (this.vendorProfileRequired && item.requiresVendorProfile === true);
  }

  lockedMenuItemTitle(item: MenuItem): string {
    if (item.requiresVendorProfile) {
      return '請先完成攤位資料設定，才能使用此功能';
    }
    return this.organizerNewebPayRequired
      ? '請先完成藍新收款帳戶綁定與 NT$1 驗證，才能使用此功能'
      : '請先完成主辦方資料設定，才能使用此功能';
  }

  isMenuItemActive(item: MenuItem): boolean {
    const currentPath = this.router.url.split(/[?#]/, 1)[0];
    return item.activePathPrefixes?.some(
      (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`),
    ) ?? false;
  }

  requestLockedMenuItem(item: MenuItem): void {
    this.lockedMenuItemRequested.emit(item);
  }

  selectMenuItem(): void {
    this.isUserMenuOpen = false;
    this.menuItemSelected.emit();
  }

  /** 點擊頁面其他區域時關閉使用者選單 */
  @HostListener('document:click')
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }
}
