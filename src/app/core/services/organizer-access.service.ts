import { computed, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { OrganizerNewebPayVerificationStatus } from '../../models/interface/organizer/OrganizerNewebPay';
import { isApiSuccessStatus } from '../../models/interface/shared/ApiResult';
import { OrganizerApiService } from './organizer-api.service';

@Injectable({ providedIn: 'root' })
export class OrganizerAccessService {
  private readonly needsProfileState = signal<boolean | null>(null);
  private readonly newebPayVerificationState =
    signal<OrganizerNewebPayVerificationStatus | null>(null);
  private initialization?: Promise<boolean>;

  readonly needsProfile = this.needsProfileState.asReadonly();
  readonly newebPayVerificationStatus = this.newebPayVerificationState.asReadonly();
  readonly setupCompleted = computed(
    () => this.needsProfileState() === false
      && this.newebPayVerificationState() === 'VERIFIED',
  );
  readonly needsNewebPaySetup = computed(
    () => this.needsProfileState() === false
      && this.newebPayVerificationState() !== 'VERIFIED',
  );

  constructor(private readonly organizerApiService: OrganizerApiService) {}

  initialize(force = false): Promise<boolean> {
    const currentValue = this.needsProfileState();
    if (!force && currentValue !== null) {
      return Promise.resolve(currentValue);
    }

    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = this.loadState().finally(() => {
      this.initialization = undefined;
    });
    return this.initialization;
  }

  refresh(): Promise<boolean> {
    return this.initialize(true);
  }

  private async loadState(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.organizerApiService.getOrganizerDashboardInit(),
      );
      const needsProfile = isApiSuccessStatus(response.statusCode) && response.data
        ? response.data.needsProfile
        : true;
      this.needsProfileState.set(needsProfile);

      if (needsProfile) {
        this.newebPayVerificationState.set(null);
        return true;
      }

      try {
        const paymentAccountResponse = await firstValueFrom(
          this.organizerApiService.getOrganizerNewebPayAccount(),
        );
        const verificationStatus =
          isApiSuccessStatus(paymentAccountResponse.statusCode) && paymentAccountResponse.data
            ? paymentAccountResponse.data.verificationStatus
            : null;
        this.newebPayVerificationState.set(verificationStatus);
      } catch {
        // 主辦方資料已完成但無法確認藍新狀態時，只鎖定管理功能，不回退成資料未完成。
        this.newebPayVerificationState.set(null);
      }
      return needsProfile;
    } catch {
      // 無法確認主辦方資料狀態時先維持鎖定，避免繞過首次設定限制。
      this.needsProfileState.set(true);
      this.newebPayVerificationState.set(null);
      return true;
    }
  }
}
