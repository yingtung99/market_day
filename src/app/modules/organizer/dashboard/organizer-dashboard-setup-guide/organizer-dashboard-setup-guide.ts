import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { OrganizerProfileDialogService } from '../../../../core/services/organizer-profile-dialog.service';
import { OrganizerNewebPayVerificationStatus } from '../../../../models/interface/organizer/OrganizerNewebPay';
import { SetupStep } from '../../../../models/interface/organizer/OrganizerSetupGuide';

@Component({
  selector: 'app-organizer-dashboard-setup-guide',
  standalone: true,
  imports: [],
  templateUrl: './organizer-dashboard-setup-guide.html',
  styleUrl: './organizer-dashboard-setup-guide.scss',
})
/** 主辦方首次設定導引，說明建檔流程並開啟主辦方資料視窗。 */
export class OrganizerDashboardSetupGuide {
  @Input() needsProfile = true;
  @Input() verificationStatus: OrganizerNewebPayVerificationStatus | null = null;

  constructor(
    private readonly organizerProfileDialog: OrganizerProfileDialogService,
    private readonly router: Router,
  ) {}

  get currentTitle(): string {
    return this.needsProfile ? '設定主辦方資料' : '設定藍新收款帳戶';
  }

  get currentDescription(): string {
    if (this.needsProfile) {
      return '完成主辦方資料並儲存後，才能繼續設定藍新收款帳戶。';
    }
    if (this.verificationStatus === 'PENDING') {
      return 'NT$1 驗證正在處理中；完成藍新付款後，系統會依 callback 結果更新狀態。';
    }
    if (this.verificationStatus === 'FAILED') {
      return '上次 NT$1 驗證未成功，請確認商店串接資料後重新驗證。';
    }
    return '綁定藍新商店並完成 NT$1 實際付款驗證後，才能使用後台管理功能。';
  }

  get actionLabel(): string {
    return this.needsProfile ? '設定主辦方資料' : '設定藍新收款';
  }

  get requirements(): Array<{ icon: string; title: string; description: string }> {
    if (this.needsProfile) {
      return [
        {
          icon: 'bi-building',
          title: '主辦方基本資料',
          description: '主辦方名稱、公司／團體資訊與聯絡地址',
        },
        {
          icon: 'bi-telephone',
          title: '聯絡資訊',
          description: '聯絡人、電話與電子郵件',
        },
        {
          icon: 'bi-clock',
          title: '服務時間',
          description: '可聯繫的服務星期與服務時段',
        },
      ];
    }

    return [
      {
        icon: 'bi-person-plus',
        title: '申請或登入藍新',
        description: '建立藍新帳號與商店資料',
      },
      {
        icon: 'bi-shield-lock',
        title: '綁定商店資料',
        description: '填寫 MerchantID、HashKey 與 HashIV',
      },
      {
        icon: 'bi-credit-card',
        title: '完成 NT$1 驗證',
        description: '實際付款驗證成功後解鎖管理功能',
      },
    ];
  }

  /** 主辦方建立第一場活動前的設定流程說明。 */
  readonly setupSteps: SetupStep[] = [
    {
      step: 1,
      icon: 'bi-card-text',
      title: '活動基本資料',
      description: '設定活動名稱、類型、封面與活動介紹。',
    },
    {
      step: 2,
      icon: 'bi-clock',
      title: '活動時間',
      description: '設定活動日期、時段與攤主報名期間。',
    },
    {
      step: 3,
      icon: 'bi-geo-alt',
      title: '活動場地與攤位規劃',
      description: '設定活動地點、地圖與攤位配置。',
    },
    {
      step: 4,
      icon: 'bi-lightning-charge',
      title: '活動設備與用電設定',
      description: '設定設備租借與活動用電方案。',
    },
  ];

  openCurrentSetup(): void {
    if (this.needsProfile) {
      this.organizerProfileDialog.open();
      return;
    }
    void this.router.navigate(['/organizer/dash-board/newebpay']);
  }
}
