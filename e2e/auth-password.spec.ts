import { Page, Response } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  AuthRoleCase,
  authRoleCases,
  getCredentials,
  installAuthMeStub,
  installLocalLoginStub,
  loginWithUi,
  readStoredSession,
} from './auth-test-helpers';

const passwordRoles = authRoleCases.filter(
  (config) => config.role === 'vendor' || config.role === 'organizer',
);

test.describe('AUTH-07 登入後修改密碼', () => {
  for (const config of passwordRoles) {
    test(`@smoke @mutating ${config.label}目前密碼驗證與修改密碼`, async ({ page }) => {
      test.setTimeout(90_000);
      const { email, password } = getCredentials(config);
      test.skip(
        !email || !password,
        `尚未設定 ${config.emailEnv} 或 ${config.passwordEnv}`,
      );

      const temporaryPassword = createTemporaryPassword(config);
      const passwordRequests: Array<{
        currentPassword?: string;
        password?: string;
      }> = [];

      await installLocalLoginStub(page, config, {
        email: email!,
        password: password!,
      });
      await installAuthMeStub(page, config, email!);
      await page.route('**/api/auth/resetPassword/reset', async (route) => {
        const payload = route.request().postDataJSON() as {
          currentPassword?: string;
          password?: string;
        };
        passwordRequests.push(payload);
        const isCurrentPasswordValid = payload.currentPassword === password;

        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            statusCode: isCurrentPasswordValid ? 200 : 400,
            message: isCurrentPasswordValid
              ? 'Password updated'
              : 'Current password is incorrect',
            messageDetails: null,
            data: null,
          }),
        });
      });

      const loginResponse = await loginWithUi(page, config, email!, password!);
      const loginBody = await loginResponse.json();
      expect(loginBody.statusCode).toBeGreaterThanOrEqual(200);
      expect(loginBody.statusCode).toBeLessThan(300);

      const session = await readStoredSession(page, config.role);
      expect(session.token).toBeTruthy();

      await page.goto(`/${config.role}/dash-board/account-settings`);
      await expect(page.getByRole('heading', { name: '帳號設定' })).toBeVisible();
      await page
        .getByRole('button', { name: '修改密碼', exact: true })
        .click();

      const incorrectResponse = await submitPasswordChange(
        page,
        'DefinitelyWrong-E2E-Password-2026!',
        temporaryPassword,
      );
      const incorrectBody = await incorrectResponse.json();

      expect(incorrectBody.statusCode).toBe(400);
      const incorrectMessage =
        incorrectBody.messageDetails || incorrectBody.message;
      expect(incorrectMessage).toBeTruthy();
      await expect(page.getByRole('alert')).toContainText(incorrectMessage);

      const successResponse = await submitPasswordChange(
        page,
        password!,
        temporaryPassword,
      );
      const successBody = await successResponse.json();

      expect(successBody.statusCode).toBeGreaterThanOrEqual(200);
      expect(successBody.statusCode).toBeLessThan(300);
      expect(passwordRequests).toEqual([
        {
          currentPassword: 'DefinitelyWrong-E2E-Password-2026!',
          password: temporaryPassword,
        },
        {
          currentPassword: password,
          password: temporaryPassword,
        },
      ]);

      const successDialog = page.getByRole('dialog');
      await expect(successDialog).toContainText('密碼已更新');
      await successDialog.getByRole('button', { name: '確定' }).click();
    });
  }
});

async function submitPasswordChange(
  page: Page,
  currentPassword: string,
  newPassword: string,
): Promise<Response> {
  const dialog = page.getByRole('dialog', { name: '修改密碼' });
  await dialog.locator('input[name="currentPassword"]').fill(currentPassword);
  await dialog.locator('input[name="newPassword"]').fill(newPassword);
  await dialog.locator('input[name="confirmPassword"]').fill(newPassword);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/resetPassword/reset') &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: '儲存變更' }).click();
  return responsePromise;
}

function createTemporaryPassword(config: AuthRoleCase): string {
  return `E2e${config.expectedApiRole}${Date.now()}A1`;
}
