/** 單一通知事件類型對應的圖示與狀態文字 */
export interface NotificationTypeDisplayInfo {
  icon: string;
  iconClass: string;
  status: string;
}

/** 通知事件類型（對應後端 NotificationType，攤主、主辦方、管理員共用）與圖示、狀態文字的對照表 */
export class NotificationTypeDisplay {
  /** 後端 NotificationType 的 API 值對應到畫面用的圖示與狀態文字 */
  static readonly apiTypeMap: Record<string, NotificationTypeDisplayInfo> = {
    /**主辦方撤回活動審核申請 */
    eventReviewWithdrawn: {
      icon: 'bi bi-arrow-counterclockwise',
      iconClass: 'blue',
      status: '已撤回',
    },
    /**主辦方送出活動下架申請 */
    eventUnpublishRequestSubmitted: {
      icon: 'bi bi-arrow-down-circle',
      iconClass: 'orange',
      status: '下架申請',
    },
    /**主辦方資格申請已送出 */
    organizerRegistrationSubmitted: { icon: 'bi bi-person-badge', iconClass: 'orange', status: '新註冊' },
    /**主辦方資料已重新送出審核 */
    organizerProfileResubmitted: { icon: 'bi bi-person-badge', iconClass: 'blue', status: '資料更新' },
    /**活動已送出審核 */
    eventSubmitted: { icon: 'bi bi-calendar-check', iconClass: 'orange', status: '新活動' },
    /**活動已重新送出審核 */
    eventResubmitted: { icon: 'bi bi-calendar-check', iconClass: 'blue', status: '資料更新' },
    /**活動審核通過，進入地圖建置 */
    eventApproved: { icon: 'bi bi-flag', iconClass: 'green', status: '審核通過' },
    /**活動審核未通過，需補件 */
    eventRevisionRequired: { icon: 'bi bi-exclamation-triangle', iconClass: 'red', status: '需補件' },
    /**活動攤位地圖建置完成 */
    eventMapCompleted: { icon: 'bi bi-map', iconClass: 'green', status: '地圖完成' },
    /**攤位申請已送出 */
    applicationSubmitted: { icon: 'bi bi-shop-window', iconClass: 'orange', status: '新註冊' },
    /**攤位申請已重新送出 */
    applicationResubmitted: { icon: 'bi bi-shop-window', iconClass: 'blue', status: '資料更新' },
    /**攤位申請已通過 */
    applicationApproved: { icon: 'bi bi-shop-window', iconClass: 'green', status: '審核通過' },
    /**攤位申請已拒絕 */
    applicationRejected: { icon: 'bi bi-shop-window', iconClass: 'red', status: '已拒絕' },
    /**攤位申請已取消 */
    applicationCancelled: { icon: 'bi bi-shop-window', iconClass: 'red', status: '已取消' },
    /**付款成功 */
    paymentPaid: { icon: 'bi bi-wallet2', iconClass: 'green', status: '付款成功' },
    /**付款失敗 */
    paymentFailed: { icon: 'bi bi-wallet2', iconClass: 'red', status: '付款失敗' },
    /**付款逾期 */
    paymentExpired: { icon: 'bi bi-wallet2', iconClass: 'red', status: '付款逾期' },
    /**可開放選擇攤位 */
    stallSelectionAvailable: { icon: 'bi bi-grid-3x3-gap', iconClass: 'blue', status: '可選攤位' },
    /**攤位選擇已完成 */
    stallSelectionCompleted: { icon: 'bi bi-grid-3x3-gap', iconClass: 'green', status: '選位完成' },
    /**報名流程已完成 */
    applicationCompleted: { icon: 'bi bi-check-circle', iconClass: 'green', status: '報名完成' },
    /**活動內容已更新 */
    eventUpdated: { icon: 'bi bi-pencil-square', iconClass: 'blue', status: '活動更新' },
    /**活動已下架 */
    eventUnpublished: { icon: 'bi bi-arrow-down', iconClass: 'red', status: '已下架' },
    /**活動已取消 */
    eventCancelled: { icon: 'bi bi-x-circle', iconClass: 'red', status: '已取消' },
    /**活動已結束 */
    eventEnded: { icon: 'bi bi-calendar-x', iconClass: 'blue', status: '已結束' },
    /**活動下架申請退回，需補件 */
    eventUnpublishRequestRevisionRequired: { icon: 'bi bi-arrow-down', iconClass: 'red', status: '需補件' },
    /**退款已申請 */
    refundRequested: { icon: 'bi bi-cash-coin', iconClass: 'orange', status: '退款申請' },
    /**退款處理中 */
    refunding: { icon: 'bi bi-cash-coin', iconClass: 'blue', status: '退款處理中' },
    /**退款失敗 */
    refundFailed: { icon: 'bi bi-cash-coin', iconClass: 'red', status: '退款失敗' },
    /**退款已完成 */
    refunded: { icon: 'bi bi-cash-coin', iconClass: 'green', status: '退款完成' },
    /**保證金已由主辦方登記退還 */
    depositReturned: { icon: 'bi bi-cash-stack', iconClass: 'green', status: '保證金已退還' },
    /**系統公告 */
    systemAnnouncement: { icon: 'bi bi-megaphone', iconClass: 'purple', status: '系統公告' },
    /**系統例外事件通知 */
    systemException: { icon: 'bi bi-exclamation-triangle', iconClass: 'red', status: '異常提醒' },
    /**登入異常 */
    loginAnomaly: { icon: 'bi bi-shield-exclamation', iconClass: 'red', status: '登入異常' },
    /**密碼重設完成 */
    passwordResetCompleted: { icon: 'bi bi-shield-check', iconClass: 'blue', status: '密碼已重設' },
  };

  /** 找不到對應類型時使用的預設圖示與狀態文字 */
  static readonly defaultDisplay: NotificationTypeDisplayInfo = {
    icon: 'bi bi-bell',
    iconClass: 'blue',
    status: '系統通知',
  };

  /** 依通知事件類型（notice.type）取得畫面用的圖示與狀態文字 */
  static getDisplay(type: string): NotificationTypeDisplayInfo {
    return NotificationTypeDisplay.apiTypeMap[type] ?? NotificationTypeDisplay.defaultDisplay;
  }

  /** 圖示顏色 -> 狀態標籤樣式 class 對應 */
  static readonly statusClassMap: Record<string, string> = {
    orange: 'pending',
    green: 'success',
    red: 'cancel',
    blue: 'info',
    purple: 'info',
  };

  /** 依圖示顏色換算狀態標籤樣式 class */
  static getStatusClass(iconClass: string): string {
    return NotificationTypeDisplay.statusClassMap[iconClass] ?? 'info';
  }
}

/** 通知分類（對應後端 NotificationCategory，攤主、主辦方、管理員共用） */
export class NotificationCategory {
  /**異常事件 */
  static readonly exception = '異常';
  /**系統通知 */
  static readonly system = '系統';
  /**活動管理 */
  static readonly eventManagement = '活動管理';
  /**主辦方管理 */
  static readonly organizerManagement = '主辦方管理';
  /**活動異動 */
  static readonly eventChange = '活動異動';
  /**攤位分配 */
  static readonly stallAssignment = '攤位分配';
  /**款項 */
  static readonly payment = '款項';
  /**報名 */
  static readonly registration = '報名';
  /**攤主申請審核 */
  static readonly applicationReview = '攤主申請';

  /** 後端 NotificationCategory 的 API 值（英文 key）對應到前端顯示用的中文標籤 */
  static readonly apiCategoryMap: Record<string, string> = {
    exception: NotificationCategory.exception,
    system: NotificationCategory.system,
    eventManagement: NotificationCategory.eventManagement,
    organizerManagement: NotificationCategory.organizerManagement,
    eventChange: NotificationCategory.eventChange,
    stallAssignment: NotificationCategory.stallAssignment,
    payment: NotificationCategory.payment,
    registration: NotificationCategory.registration,
    applicationReview: NotificationCategory.applicationReview,
  };

  /** 把後端回傳的 NotificationCategory API 值轉成畫面用的中文標籤 */
  static fromApiCategory(category: string): string {
    return NotificationCategory.apiCategoryMap[category] ?? category;
  }

  /** 把畫面上的中文分類標籤轉成要送給後端的 NotificationCategory API 值 */
  static toApiCategory(label: string): string | null {
    const entry = Object.entries(NotificationCategory.apiCategoryMap).find(([, value]) => value === label);
    return entry ? entry[0] : null;
  }
}
