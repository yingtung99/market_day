import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  getPasswordResetEmailKey,
  getPasswordResetTokenKey,
  getPendingRegistrationEmailKey,
} from '../../../core/auth/auth-storage.constants';
import { AlertService } from '../../../core/services/alert.service';
import { isApiSuccessStatus } from '../../../models/interface/shared/ApiResult';

type VerifyRole = 'vendor' | 'organizer';

@Component({
  selector: 'app-auth-verify-email',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth-verify-email.html',
  styleUrl: './auth-verify-email.scss',
})
export class AuthVerifyEmail implements OnInit, OnDestroy {
  @ViewChildren('codeInput') codeInputs!: QueryList<ElementRef<HTMLInputElement>>;

  @Input() formTitle = '';
  @Input() backLink = '';
  @Input() loginLink = '';
  @Input() role: VerifyRole = 'vendor';

  email = '';
  code = ['', '', '', '', '', ''];
  resendSeconds = 56;
  isSubmitting = false;
  purpose: 'registration' | 'reset' = 'registration';

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly alert: AlertService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.purpose =
      this.route.snapshot.queryParamMap.get('purpose') === 'reset'
        ? 'reset'
        : 'registration';

    this.email =
      this.route.snapshot.queryParamMap.get('email')?.trim() ||
      sessionStorage.getItem(
        this.purpose === 'reset'
          ? getPasswordResetEmailKey(this.role)
          : getPendingRegistrationEmailKey(this.role)
      ) ||
      '';
    this.startResendCountdown();
  }

  get effectiveBackLink(): string {
    return this.purpose === 'reset'
      ? `/${this.role}/forgot-password`
      : this.backLink;
  }

  get isCodeComplete(): boolean {
    return /^\d{6}$/.test(this.code.join(''));
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  onCodeInput(value: string, index: number): void {
    if (this.isSubmitting) {
      return;
    }

    const numbers = value.replace(/\D/g, '');
    if (!numbers) {
      this.code[index] = '';
      return;
    }

    const digits = numbers.slice(0, this.code.length - index).split('');
    digits.forEach((digit, digitIndex) => {
      this.code[index + digitIndex] = digit;
    });

    const nextIndex = Math.min(index + digits.length, this.code.length - 1);

    if (nextIndex > index || index < this.code.length - 1) {
      this.focusCodeInput(nextIndex);
    }
  }

  onCodeBackspace(index: number): void {
    if (!this.code[index] && index > 0) {
      this.focusCodeInput(index - 1);
    }
  }

  onCodePaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();

    const pastedCode = event.clipboardData?.getData('text') ?? '';
    this.onCodeInput(pastedCode, index);
  }

  async verifyCode(): Promise<void> {
    if (this.isSubmitting) {
      return;
    }

    const fullCode = this.code.join('');
    if (!this.email || !/^\d{6}$/.test(fullCode)) {
      await this.alert.error(
        '驗證資料不完整',
        this.email
          ? '請輸入完整的 6 位數驗證碼。'
          : '找不到待驗證的 Email，請重新註冊。',
        '重新檢查'
      );
      return;
    }

    this.isSubmitting = true;

    try {
      if (this.purpose === 'reset') {
        await this.verifyResetCode(fullCode);
        return;
      }

      await this.verifyRegistrationCode(fullCode);
    } catch (error: unknown) {
      await this.alert.error(
        '驗證失敗',
        this.getErrorMessage(error),
        '重新輸入'
      );
      this.resetCode();
    } finally {
      this.isSubmitting = false;
    }
  }

  private async verifyRegistrationCode(code: string): Promise<void> {
    const response = await firstValueFrom(
      this.authService.verifyRegistrationEmail({
        email: this.email,
        code,
      })
    );

    if (!isApiSuccessStatus(response.statusCode)) {
      await this.showVerificationError(response.message);
      return;
    }

    sessionStorage.removeItem(getPendingRegistrationEmailKey(this.role));
    await this.alert.success(
      'Email 驗證成功',
      this.role === 'vendor'
        ? '帳號已啟用，現在可以登入攤主後台。'
        : '帳號已啟用，現在可以登入主辦方後台。',
      '前往登入'
    );
    await this.router.navigate(
      [this.loginLink || `/${this.role}/login`],
      { queryParams: { email: this.email } }
    );
  }

  private async verifyResetCode(code: string): Promise<void> {
    const response = await firstValueFrom(
      this.authService.verifyPasswordResetEmail({
        email: this.email,
        code,
      })
    );

    if (!isApiSuccessStatus(response.statusCode)) {
      await this.showVerificationError(response.message);
      return;
    }

    const resetToken = response.data?.resetToken;
    if (!resetToken) {
      await this.showVerificationError('Reset token is missing');
      return;
    }

    sessionStorage.setItem(
      getPasswordResetTokenKey(this.role),
      resetToken
    );
    await this.alert.success(
      'Email 驗證成功',
      '驗證完成，請在 10 分鐘內設定新密碼。',
      '設定新密碼'
    );
    await this.router.navigateByUrl(`/${this.role}/reset-password`);
  }

  async resendCode(): Promise<void> {
    if (this.resendSeconds > 0) {
      return;
    }

    if (!this.email) {
      await this.alert.error(
        '找不到 Email',
        '找不到待驗證的 Email，請重新執行註冊流程。',
        '知道了'
      );
      return;
    }

    this.isSubmitting = true;
    try {
      const response = await firstValueFrom(
        this.purpose === 'reset'
          ? this.authService.requestPasswordReset({ email: this.email })
          : this.authService.resendRegistrationVerificationCode({ email: this.email })
      );
      if (!isApiSuccessStatus(response.statusCode)) {
        await this.alert.error(
          '寄送失敗',
          response.message || '驗證碼寄送失敗，請稍後再試。',
          '知道了'
        );
        return;
      }

      this.resendSeconds = 56;
      this.startResendCountdown();
      await this.alert.success(
        '驗證碼已重新寄出',
        `新的 6 位數驗證碼已寄送至<br>${this.email}。`,
        '知道了'
      );
    } catch (error: unknown) {
      await this.alert.error(
        '寄送失敗',
        this.getResendErrorMessage(error),
        '知道了'
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  private async showVerificationError(message: string): Promise<void> {
    const text =
      message === 'Invalid or expired verification code'
        ? '驗證碼錯誤或已逾期，請確認後重新輸入。'
        : message === 'Reset token is missing'
          ? '未取得密碼重設憑證，請重新執行忘記密碼流程。'
        : message === 'Email already verified'
          ? '此 Email 已完成驗證，請直接登入。'
          : message || 'Email 驗證失敗，請稍後再試。';

    await this.alert.error('驗證失敗', text, '重新輸入');
    this.resetCode();
  }

  private resetCode(): void {
    this.code = ['', '', '', '', '', ''];
    setTimeout(() => this.focusCodeInput(0));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || '無法連線至伺服器，請確認後端已啟動。';
    }

    return '驗證時發生錯誤，請稍後再試。';
  }

  private getResendErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        return '後端尚未載入驗證碼重寄功能，請重新啟動後端後再試。';
      }

      if (error.status === 0) {
        return '無法連線至後端服務，請確認後端已啟動。';
      }
    }

    return this.getErrorMessage(error);
  }

  private focusCodeInput(index: number): void {
    const input = this.codeInputs.get(index)?.nativeElement;
    if (input) {
      input.focus();
      input.select();
    }
  }

  private startResendCountdown(): void {
    this.clearResendTimer();
    this.resendTimer = setInterval(() => {
      if (this.resendSeconds <= 0) {
        this.clearResendTimer();
        return;
      }
      this.resendSeconds--;
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }
}
