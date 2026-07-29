import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerAccessService } from '../../../../core/services/organizer-access.service';
import { AlertService } from '../../../../core/services/alert.service';
import {
  OrganizerNewebPayAccount,
  OrganizerNewebPayPortal,
  OrganizerNewebPayVerificationForm,
  OrganizerNewebPayVerificationStatus,
} from '../../../../models/interface/organizer/OrganizerNewebPay';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';

@Component({
  selector: 'app-organizer-newebpay-setup',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './organizer-newebpay-setup.html',
  styleUrl: './organizer-newebpay-setup.scss',
})
/** 主辦方藍新商店綁定與 NT$1 試刷驗證頁。 */
export class OrganizerNewebPaySetup implements OnInit {
  readonly form;
  account: OrganizerNewebPayAccount | null = null;
  portal: OrganizerNewebPayPortal | null = null;
  isLoading = true;
  isSaving = false;
  isVerifying = false;
  showHashKey = false;
  showHashIv = false;
  loadError = '';

  constructor(
    formBuilder: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly organizerApi: OrganizerApiService,
    private readonly organizerAccess: OrganizerAccessService,
    private readonly alert: AlertService,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
    this.form = formBuilder.nonNullable.group({
      merchantId: ['', [Validators.required]],
      hashKey: ['', [Validators.required, Validators.pattern(/^\S{32}$/)]],
      hashIv: ['', [Validators.required, Validators.pattern(/^\S{16}$/)]],
    });
  }

  ngOnInit(): void {
    void this.loadPage();
  }

  get verificationStatus(): OrganizerNewebPayVerificationStatus {
    return this.account?.verificationStatus ?? 'UNVERIFIED';
  }

  get isVerified(): boolean {
    return this.verificationStatus === 'VERIFIED';
  }

  openPortal(type: 'registration' | 'login'): void {
    const url = type === 'registration'
      ? this.portal?.registrationUrl
      : this.portal?.loginUrl;
    if (!url) return;

    try {
      const parsedUrl = this.parseNewebPayUrl(url);
      window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      void this.alert.error('無法開啟藍新網站', '藍新入口網址格式不正確，請稍後再試。');
    }
  }

  async save(): Promise<void> {
    if (this.isSaving || this.isVerifying) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const value = this.form.getRawValue();
    try {
      const response = await firstValueFrom(
        this.organizerApi.saveOrganizerNewebPayAccount({
          merchantId: value.merchantId.trim(),
          hashKey: value.hashKey.trim(),
          hashIv: value.hashIv.trim(),
        }),
      );
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error(
          '藍新資料儲存失敗',
          '請確認商店代號與串接資料後再試一次。',
        );
        return;
      }

      this.form.controls.hashKey.reset();
      this.form.controls.hashIv.reset();
      await this.reloadAccount();
      await this.organizerAccess.refresh();
      await this.alert.success(
        '藍新資料已儲存',
        '請繼續進行 NT$1 試刷驗證，完成後即可使用後台管理功能。',
      );
    } catch {
      await this.alert.error('藍新資料儲存失敗', '目前無法連線服務，請稍後再試。');
    } finally {
      this.isSaving = false;
    }
  }

  async verify(): Promise<void> {
    if (this.isSaving || this.isVerifying || !this.account?.bound) return;

    this.isVerifying = true;
    try {
      const response = await firstValueFrom(this.organizerApi.verifyOrganizerNewebPayAccount());
      if (!isApiSuccessStatus(response.statusCode)) {
        this.isVerifying = false;
        await this.alert.error('目前無法開始試刷驗證', '請稍後再試。');
        return;
      }
      this.submitNewebPayForm(response.data);
    } catch {
      this.isVerifying = false;
      await this.alert.error('目前無法開始試刷驗證', '請稍後再試。');
    }
  }

  hasError(controlName: 'merchantId' | 'hashKey' | 'hashIv'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  private async loadPage(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';
    try {
      const [portalResponse] = await Promise.all([
        firstValueFrom(this.organizerApi.getOrganizerNewebPayPortal()),
        this.reloadAccount(),
      ]);
      if (isApiSuccessStatus(portalResponse.statusCode)) {
        this.portal = portalResponse.data;
      }

      if (this.route.snapshot.queryParamMap.has('verificationStatus')) {
        await this.waitForVerificationCallback();
        await this.organizerAccess.refresh();
        if (this.isVerified) {
          await this.alert.success(
            '藍新帳戶驗證成功',
            'NT$1 試刷驗證已完成，主辦方後台管理功能已解鎖。',
          );
        } else if (this.verificationStatus === 'FAILED') {
          await this.alert.error(
            '藍新帳戶驗證失敗',
            '請確認商店代號與串接資料後重新儲存，再進行一次試刷驗證。',
          );
        }
      }
    } catch {
      this.loadError = '目前無法載入藍新設定，請稍後再試。';
    } finally {
      this.isLoading = false;
    }
  }

  private async waitForVerificationCallback(): Promise<void> {
    const returnedStatus = this.route.snapshot.queryParamMap.get('verificationStatus');
    if (returnedStatus !== 'SUCCESS' || this.verificationStatus !== 'PENDING') return;

    // NewebPay's browser ReturnURL can arrive before its server-to-server
    // NotifyURL. Poll briefly so the page reflects the authoritative Notify
    // result instead of leaving a successful verification looking PENDING.
    for (let attempt = 0; attempt < 10 && this.verificationStatus === 'PENDING'; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
      await this.reloadAccount();
    }
  }

  private async reloadAccount(): Promise<void> {
    const response = await firstValueFrom(this.organizerApi.getOrganizerNewebPayAccount());
    if (!isApiSuccessStatus(response.statusCode)) {
      throw new Error(response.message);
    }

    this.account = response.data;
    this.form.controls.merchantId.setValue(response.data.merchantId ?? '');
  }

  private submitNewebPayForm(payment: OrganizerNewebPayVerificationForm): void {
    const gateway = this.parseNewebPayUrl(payment.gateway);

    const form = this.document.createElement('form');
    form.method = 'POST';
    form.action = gateway.toString();
    form.style.display = 'none';
    const fields: Record<string, string> = {
      MerchantID: payment.merchantId,
      TradeInfo: payment.tradeInfo,
      TradeSha: payment.tradeSha,
      Version: payment.version,
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = this.document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    this.document.body.appendChild(form);
    form.submit();
  }

  private parseNewebPayUrl(url: string): URL {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      parsedUrl.protocol !== 'https:'
      || (hostname !== 'newebpay.com' && !hostname.endsWith('.newebpay.com'))
    ) {
      throw new Error('Invalid NewebPay URL');
    }
    return parsedUrl;
  }
}
