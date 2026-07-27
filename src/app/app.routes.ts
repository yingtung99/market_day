import { Routes } from '@angular/router';
import { UserLayout } from './modules/user/frontend/user-layout/user-layout';
import { UserHome } from './modules/user/frontend/user-home/user-home';
import { UserActivityList } from './modules/user/frontend/activity/user-activity-list/user-activity-list';
import { UserActivityDetail } from './modules/user/frontend/activity/user-activity-detail/user-activity-detail';
import { UserBrandDetail } from './modules/user/frontend/brand/user-brand-detail/user-brand-detail';
import { Auth } from './modules/auth/auth/auth';
import { UserAboutUs } from './modules/user/frontend/user-about-us/user-about-us';
import { OrganizerDashboardHome } from './modules/organizer/dashboard/organizer-dashboard-home/organizer-dashboard-home';
import { OrganizerDashboardNotification } from './modules/organizer/dashboard/organizer-dashboard-notification/organizer-dashboard-notification';
import { OrganizerDashboardSetupGuide } from './modules/organizer/dashboard/organizer-dashboard-setup-guide/organizer-dashboard-setup-guide';
import { OrganizerNewebPaySetup } from './modules/organizer/dashboard/organizer-newebpay-setup/organizer-newebpay-setup';
import { OrganizerDashboardEventDetail } from './modules/organizer/dashboard/organizer-dashboard-event-detail/organizer-dashboard-event-detail';
import { OrganizerDashboardRegistrationManagement } from './modules/organizer/dashboard/organizer-dashboard-registration-management/organizer-dashboard-registration-management';
import { OrganizerDashboardRegistrationDetail } from './modules/organizer/dashboard/organizer-dashboard-registration-detail/organizer-dashboard-registration-detail';
import { OrganizerDashboardEventManagement } from './modules/organizer/dashboard/organizer-dashboard-event-management/organizer-dashboard-event-management';
import { OrganizerDashboardCollectionManagement } from './modules/organizer/dashboard/organizer-dashboard-collection-management/organizer-dashboard-collection-management';
import { OrganizerDashboardCollectionDetail } from './modules/organizer/dashboard/organizer-dashboard-collection-detail/organizer-dashboard-collection-detail';
import { OrganizerDashboardEquipmentManagement } from './modules/organizer/dashboard/organizer-dashboard-equipment-management/organizer-dashboard-equipment-management';
import { OrganizerDashboardEquipmentDetail } from './modules/organizer/dashboard/organizer-dashboard-equipment-detail/organizer-dashboard-equipment-detail';
import { OrganizerDashboardAccountManagement } from './modules/organizer/dashboard/organizer-dashboard-account-management/organizer-dashboard-account-management';
import { OrganizerDashboardAccountDetail } from './modules/organizer/dashboard/organizer-dashboard-account-detail/organizer-dashboard-account-detail';
import { OrganizerDashboardStallManagement } from './modules/organizer/dashboard/organizer-dashboard-stall-management/organizer-dashboard-stall-management';
import { OrganizerDashboardStallDetail } from './modules/organizer/dashboard/organizer-dashboard-stall-detail/organizer-dashboard-stall-detail';
import { OrganizerDashboardStallMap } from './modules/organizer/dashboard/organizer-dashboard-stall-map/organizer-dashboard-stall-map';
import { OrganizerAccountSettings } from './modules/organizer/dashboard/organizer-account-settings/organizer-account-settings';
import { OrganizerHome } from './modules/organizer/frontend/organizer-home/organizer-home';
import { OrganizerAbout } from './modules/organizer/frontend/organizer-about/organizer-about';
import { UserBrandSearch } from './modules/user/frontend/brand/user-brand-search/user-brand-search';
//--- admin ---
import { AdminLogin } from './modules/admin/admin-login/admin-login';
import { AdminDashboardHome } from './modules/admin/dashboard/admin-dashboard-home/admin-dashboard-home';
import { AdminDashboardNotification } from './modules/admin/dashboard/admin-dashboard-notification/admin-dashboard-notification';
import { AdminDashboardMarketManagement } from './modules/admin/dashboard/admin-dashboard-market-management/admin-dashboard-market-management';
import { AdminDashboardMarketDetail } from './modules/admin/dashboard/admin-dashboard-market-detail/admin-dashboard-market-detail';
import { AdminDashboardUserManagement } from './modules/admin/dashboard/admin-dashboard-user-management/admin-dashboard-user-management';
import { AdminDashboardUserDetailOrganizer } from './modules/admin/dashboard/admin-dashboard-user-detail-organizer/admin-dashboard-user-detail-organizer';
import { AdminDashboardUserDetailVender } from './modules/admin/dashboard/admin-dashboard-user-detail-vender/admin-dashboard-user-detail-vender';
import { AdminDashboardLogs } from './modules/admin/dashboard/admin-dashboard-logs/admin-dashboard-logs';
//--- vendor ----
import { VendorHome } from './modules/vendor/frontend/vendor-home/vendor-home';
import { VendorDashboardHome } from './modules/vendor/dashboard/vendor-dashboard-home/vendor-dashboard-home';
import { VendorDashboardNotification } from './modules/vendor/dashboard/vendor-dashboard-notification/vendor-dashboard-notification';
import { VendorAbout } from './modules/vendor/frontend/vendor-about/vendor-about';
import { VendorMarketSignupList } from './modules/vendor/frontend/vendor-market-signup-list/vendor-market-signup-list';
import { VendorMarketSignupDetail } from './modules/vendor/frontend/vendor-market-signup-detail/vendor-market-signup-detail';
import { VendorSignupForm } from './modules/vendor/frontend/vendor-signup-form/vendor-signup-form';
import { VendorSignupConfirmPage } from './modules/vendor/frontend/vendor-signup-confirm-page/vendor-signup-confirm-page';
import { VendorSignupCompletePage } from './modules/vendor/frontend/vendor-signup-complete-page/vendor-signup-complete-page';
import { VendorAccountSettings } from './modules/vendor/dashboard/vendor-account-settings/vendor-account-settings';
import { VendorDashboardStall } from './modules/vendor/dashboard/vendor-dashboard-stall/vendor-dashboard-stall';
import { VendorApplicationRecord } from './modules/vendor/dashboard/vendor-application-record/vendor-application-record';
import { VendorApplicationDetail } from './modules/vendor/dashboard/vendor-application-detail/vendor-application-detail';
import { VendorPaymentPage } from './modules/vendor/dashboard/vendor-payment-page/vendor-payment-page';
import { VendorBoothSelection } from './modules/vendor/dashboard/vendor-booth-selection/vendor-booth-selection';

//登入驗證，先寫假的session
import { authGuard } from './guards/auth-guard';
import { organizerProfileGuard } from './guards/organizer-profile-guard';
import { organizerSetupGuard } from './guards/organizer-setup-guard';

/** 頁面設定檔 */
import { AUTH_ROUTE_DATA } from './models/config/auth-route-data';
import { DashboardLayout } from './modules/shared/dashboard/dashboard-layout/dashboard-layout';

export const routes: Routes = [
  /** 預設導向 */
  {
    path: '',
    redirectTo: 'user/home',
    pathMatch: 'full',
  },

  /** 一般使用者前台 */
  {
    path: 'user',
    component: UserLayout,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: UserHome,
      },
      {
        path: 'activity-list',
        component: UserActivityList,
      },
      {
        path: 'activity-list/history',
        component: UserActivityList,
      },
      {
        path: 'activity-detail',
        component: UserActivityDetail,
      },
      {
        path: 'brands',
        component: UserBrandSearch,
      },
      {
        path: 'brand-detail',
        component: UserBrandDetail,
      },
      {
        path: 'about',
        component: UserAboutUs,
      },
    ],
  },

  /** 攤主專區登入 / 註冊 / 驗證 */
  {
    path: 'vendor',
    children: [
      { path: 'home', component: VendorHome },
      { path: 'about', component: VendorAbout },
      { path: 'sign-up', component: VendorMarketSignupList },
      { path: 'sign-up-detail/:id', component: VendorMarketSignupDetail },
      { path: 'sign-up-detail', component: VendorMarketSignupDetail },
      { path: 'sign-up-form', component: VendorSignupForm },
      { path: 'sign-up-confirm', component: VendorSignupConfirmPage },
      { path: 'sign-up-complete', component: VendorSignupCompletePage },
      { path: 'login', component: Auth, data: AUTH_ROUTE_DATA.vendorLogin },
      { path: 'register', component: Auth, data: AUTH_ROUTE_DATA.vendorRegister },
      { path: 'forgot-password', component: Auth, data: AUTH_ROUTE_DATA.vendorForgotPassword },
      { path: 'verify-email', component: Auth, data: AUTH_ROUTE_DATA.vendorVerifyEmail },
      { path: 'reset-password', component: Auth, data: AUTH_ROUTE_DATA.vendorResetPassword },
    ],
  },
  /** 主辦方專區登入 / 註冊 / 驗證 */
  {
    path: 'organizer',
    children: [
      { path: 'home', component: OrganizerHome },
      { path: 'about', component: OrganizerAbout },
      { path: 'login', component: Auth, data: AUTH_ROUTE_DATA.organizerLogin },
      { path: 'register', component: Auth, data: AUTH_ROUTE_DATA.organizerRegister },
      { path: 'forgot-password', component: Auth, data: AUTH_ROUTE_DATA.organizerForgotPassword },
      { path: 'verify-email', component: Auth, data: AUTH_ROUTE_DATA.organizerVerifyEmail },
      { path: 'reset-password', component: Auth, data: AUTH_ROUTE_DATA.organizerResetPassword },
    ],
  },

  /** 系統管理員登入 */
  {
    path: 'admin/login',
    component: AdminLogin,
  },

  /** 攤主後台 */
  {
    path: 'vendor/dash-board',
    canActivate: [authGuard],
    component: DashboardLayout,
    data: { role: 'vendor' },
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: VendorDashboardHome,
      },
      {
        path: 'notification',
        component: VendorDashboardNotification,
      },
      {
        path: 'myStall',
        component: VendorDashboardStall,
      },
      {
        path: 'application-record',
        component: VendorApplicationRecord,
      },
      {
        path: 'application-record/detail/:applicationNo/payment',
        component: VendorPaymentPage,
      },
      {
        path: 'application-record/detail/:applicationNo/booth',
        component: VendorBoothSelection,
      },
      {
        // 報名詳情後端端點以資料庫 applicationId 查詢。
        path: 'application-record/detail/:id',
        component: VendorApplicationDetail,
      },
      {
        path: 'application-record/detail',
        component: VendorApplicationDetail,
      },
      {
        path: 'account-settings',
        component: VendorAccountSettings,
      },
      // {
      //   path: 'password-settings',
      //   component: VendorPasswordSettings,
      // },
    ],
  },

  /** 主辦方後台 */
  {
    path: 'organizer/dash-board',
    canActivate: [authGuard],
    component: DashboardLayout,
    data: { role: 'organizer' },
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: OrganizerDashboardHome,
      },
      {
        path: 'setup-guide',
        component: OrganizerDashboardSetupGuide,
      },
      {
        path: 'newebpay',
        component: OrganizerNewebPaySetup,
        canActivate: [organizerProfileGuard],
      },
      {
        path: 'notification',
        component: OrganizerDashboardNotification,
      },
      {
        path: 'activity',
        component: OrganizerDashboardEventManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'register',
        component: OrganizerDashboardRegistrationManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'register/detail',
        component: OrganizerDashboardRegistrationDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'register/detail/:id',
        component: OrganizerDashboardRegistrationDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'collection',
        component: OrganizerDashboardCollectionManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'collection/detail/:id',
        component: OrganizerDashboardCollectionDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'equipment',
        component: OrganizerDashboardEquipmentManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'stall',
        component: OrganizerDashboardStallManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'stall/detail/:id',
        component: OrganizerDashboardStallDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'stall/detail/:id/map',
        component: OrganizerDashboardStallMap,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'equipment/detail/:id',
        component: OrganizerDashboardEquipmentDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'account',
        component: OrganizerDashboardAccountManagement,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'account/detail/:id',
        component: OrganizerDashboardAccountDetail,
        canActivate: [organizerSetupGuard],
      },
      {
        path: 'activity/detail',
        component: OrganizerDashboardEventDetail,
        canActivate: [organizerSetupGuard],
        canDeactivate: [(component: OrganizerDashboardEventDetail) => component.canDeactivate()],
      },
      {
        path: 'activity/detail/:id',
        component: OrganizerDashboardEventDetail,
        canActivate: [organizerSetupGuard],
        canDeactivate: [(component: OrganizerDashboardEventDetail) => component.canDeactivate()],
      },
      {
        path: 'account-settings',
        component: OrganizerAccountSettings,
      },
    ],
  },

  /** 系統管理員後台 */
  {
    path: 'admin/dash-board',
    canActivate: [authGuard],
    component: DashboardLayout,
    data: { role: 'admin' },
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: AdminDashboardHome,
      },
      {
        path: 'notification',
        component: AdminDashboardNotification,
      },
      {
        path: 'activity',
        component: AdminDashboardMarketManagement,
      },
      {
        path: 'activity/detail/:id',
        component: AdminDashboardMarketDetail,
      },
      {
        path: 'users',
        component: AdminDashboardUserManagement,
      },
      {
        path: 'user/detail/organizer/:id',
        component: AdminDashboardUserDetailOrganizer,
      },
      {
        path: 'user/detail/organizer',
        component: AdminDashboardUserDetailOrganizer,
      },
      {
        path: 'user/detail/vender/:id',
        component: AdminDashboardUserDetailVender,
      },
      {
        path: 'user/detail/vender',
        component: AdminDashboardUserDetailVender,
      },
      {
        path: 'logs',
        component: AdminDashboardLogs,
      },
    ],
  },
];
