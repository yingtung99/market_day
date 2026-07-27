/**側邊欄目錄 */
export interface MenuItem {
  /** 標題 */
  label: string;
  /** icon */
  icon: string;
  /** 路徑 */
  path: string;
  /** 額外視為此選單作用中的路徑前綴 */
  activePathPrefixes?: string[];
  /** 訊息數 */
  badge?: number;
  /** 主辦方首次設定（基本資料與藍新驗證）完成後才能使用 */
  requiresOrganizerSetup?: boolean;
  /** 攤位資料完成後才能使用 */
  requiresVendorProfile?: boolean;
}
