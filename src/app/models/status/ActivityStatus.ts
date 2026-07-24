/** 主辦方後台活動流程狀態。 */
export class ActivityStatus {
  /** 活動管理篩選：全部狀態。 */
  static readonly all = '全部狀態';

  /** 活動建立與審核流程狀態。 */
  static readonly draft = '草稿';
  static readonly pendingReview = '待審核';
  static readonly revisionRequired = '補件中';
  static readonly mapBuilding = '地圖建置中';
  static readonly readyToPublish = '待發布';

  /** 活動公開後狀態。 */
  static readonly registrationOpen = '報名中';
  static readonly full = '已額滿';
  static readonly published = '已發布';
  static readonly brandsPublished = '品牌已公開';
  static readonly active = '進行中';
  static readonly finalConfirmation = '最終名單確認中';
  static readonly ended = '已結束';
  static readonly unpublishRequested = '下架申請中';
  static readonly unpublished = '已下架';

  /** 只會出現在活動狀態紀錄（WorkflowStatus）的狀態，EventStatus 沒有對應值。 */
  static readonly workflowFinalReview = '參與品牌名單確認';
  static readonly cancelled = '已取消';

  /** 所有可顯示的活動狀態。 */
  static readonly list: string[] = [
    ActivityStatus.draft,
    ActivityStatus.pendingReview,
    ActivityStatus.revisionRequired,
    ActivityStatus.mapBuilding,
    ActivityStatus.readyToPublish,
    ActivityStatus.registrationOpen,
    ActivityStatus.full,
    ActivityStatus.published,
    ActivityStatus.brandsPublished,
    ActivityStatus.active,
    ActivityStatus.finalConfirmation,
    ActivityStatus.ended,
    ActivityStatus.unpublishRequested,
    ActivityStatus.unpublished,
  ];

  /** 活動管理篩選下拉選項。 */
  static readonly filterList: string[] = [
    ActivityStatus.all,
    ...ActivityStatus.list,
  ];

  /** 活動狀態對應標籤樣式。 */
  static readonly classMap: Record<string, string> = {
    [ActivityStatus.draft]: 'tag-grey',
    [ActivityStatus.pendingReview]: 'tag-orange',
    [ActivityStatus.revisionRequired]: 'tag-red',
    [ActivityStatus.mapBuilding]: 'tag-blue',
    [ActivityStatus.readyToPublish]: 'tag-purple',
    [ActivityStatus.registrationOpen]: 'tag-green',
    [ActivityStatus.full]: 'tag-orange',
    [ActivityStatus.published]: 'tag-teal',
    [ActivityStatus.brandsPublished]: 'tag-teal',
    [ActivityStatus.active]: 'tag-blue',
    [ActivityStatus.finalConfirmation]: 'tag-teal',
    [ActivityStatus.ended]: 'tag-grey',
    [ActivityStatus.unpublishRequested]: 'tag-orange',
    [ActivityStatus.unpublished]: 'tag-red',
    [ActivityStatus.workflowFinalReview]: 'tag-teal',
    [ActivityStatus.cancelled]: 'tag-red',
  };

  /** 取得活動狀態標籤樣式。 */
  static getClass(status: string): string {
    return ActivityStatus.classMap[status] ?? 'tag-grey';
  }

  /** 後端 EventStatus 的 API 值（英文 key）對應到前端顯示用的中文標籤。 */
  static readonly apiStatusMap: Record<string, string> = {
    draft: ActivityStatus.draft,
    pendingReview: ActivityStatus.pendingReview,
    revisionRequired: ActivityStatus.revisionRequired,
    mapBuilding: ActivityStatus.mapBuilding,
    readyToPublish: ActivityStatus.readyToPublish,
    registrationOpen: ActivityStatus.registrationOpen,
    full: ActivityStatus.full,
    published: ActivityStatus.published,
    brandsPublished: ActivityStatus.brandsPublished,
    active: ActivityStatus.active,
    finalConfirmation: ActivityStatus.finalConfirmation,
    ended: ActivityStatus.ended,
    pendingUnpublish: ActivityStatus.unpublishRequested,
    unpublished: ActivityStatus.unpublished,
  };

  /** 把後端回傳的 EventStatus API 值轉成畫面用的中文標籤。 */
  static fromApiStatus(status: string): string {
    const value = status.trim();
    const normalized = ActivityStatus.normalizeApiStatusKey(value);
    return ActivityStatus.apiStatusMap[value]
      ?? ActivityStatus.apiStatusMap[normalized]
      ?? value;
  }

  /** 把畫面上的中文狀態標籤轉成要送給後端的 EventStatus API 值。 */
  static toApiStatus(label: string): string | null {
    const entry = Object.entries(ActivityStatus.apiStatusMap).find(([, value]) => value === label);
    return entry ? entry[0] : null;
  }

  /**
   * 後端 WorkflowStatus 的 API 值對應到前端顯示用的中文標籤。
   *
   * 用於活動詳細頁的狀態紀錄，跟活動列表用的 EventStatus 是不同的後端 enum，
   * 沒有「報名中/已額滿/進行中/已結束」這幾個算出來的狀態，但多了「已發布/品牌確認中/已取消」。
   */
  static readonly workflowApiStatusMap: Record<string, string> = {
    draft: ActivityStatus.draft,
    pendingReview: ActivityStatus.pendingReview,
    revisionRequired: ActivityStatus.revisionRequired,
    mapBuilding: ActivityStatus.mapBuilding,
    readyToPublish: ActivityStatus.readyToPublish,
    published: ActivityStatus.published,
    finalReview: ActivityStatus.workflowFinalReview,
    pendingUnpublish: ActivityStatus.unpublishRequested,
    unpublished: ActivityStatus.unpublished,
    cancelled: ActivityStatus.cancelled,
  };

  /** 把後端回傳的 WorkflowStatus API 值轉成畫面用的中文標籤。 */
  static fromWorkflowApiStatus(status: string): string {
    const value = status.trim();
    const normalized = ActivityStatus.normalizeApiStatusKey(value);
    return ActivityStatus.workflowApiStatusMap[value]
      ?? ActivityStatus.workflowApiStatusMap[normalized]
      ?? value;
  }

  /** 同時接受後端 enum 常見的 PENDING_REVIEW 與既有 pendingReview 格式。 */
  private static normalizeApiStatusKey(status: string): string {
    const lowerCase = status.toLowerCase();
    return lowerCase.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }
}
