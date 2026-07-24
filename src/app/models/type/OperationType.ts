/**管理員操作類型 */
export class OperationType {
    /** 活動審核 */
    static readonly activityReview = '活動審核';
    /** 要求補件 */
    static readonly requestRevision = '要求補件';
    /** 完成地圖建置 */
    static readonly mapBuildCompleted = '完成地圖建置';
    /** 活動下架審核 */
    static readonly eventUnpublishReview = '活動下架審核';
    /** 帳號恢復 */
    static readonly accountRestored = '帳號恢復';
    /** 帳號停用 */
    static readonly accountDisabled = '帳號停用';
    /**系統設定 */
    static readonly systemSetting = '系統設定';

    /** 操作類型 -> 標籤顏色 class 對應 */
    static readonly classMap: Record<string, string> = {
        [OperationType.activityReview]: 'admin-blue',
        [OperationType.requestRevision]: 'admin-orange',
        [OperationType.mapBuildCompleted]: 'admin-teal',
        [OperationType.eventUnpublishReview]: 'admin-yellow',
        [OperationType.accountRestored]: 'admin-green',
        [OperationType.accountDisabled]: 'admin-red',
        [OperationType.systemSetting]: 'admin-purple',
    };

    /** 取得操作類型對應的標籤顏色 class */
    static getClass(type: string): string {
        return OperationType.classMap[type] ?? 'admin-grey';
    }

    /** 後端 AdminOperationType 的 API 值（英文 key）對應到前端顯示用的中文標籤。 */
    static readonly apiOperationTypeMap: Record<string, string> = {
        activityReview: OperationType.activityReview,
        requestRevision: OperationType.requestRevision,
        mapBuildCompleted: OperationType.mapBuildCompleted,
        eventUnpublishReview: OperationType.eventUnpublishReview,
        accountRestored: OperationType.accountRestored,
        accountDisabled: OperationType.accountDisabled,
        systemSetting: OperationType.systemSetting,
    };

    /** 把後端回傳的 AdminOperationType API 值轉成畫面用的中文標籤。 */
    static fromApiOperationType(type: string): string {
        return OperationType.apiOperationTypeMap[type] ?? type;
    }

    /** 把畫面上的中文操作類型標籤轉成要送給後端的 AdminOperationType API 值。 */
    static toApiOperationType(label: string): string | null {
        const entry = Object.entries(OperationType.apiOperationTypeMap).find(([, value]) => value === label);
        return entry ? entry[0] : null;
    }
}
