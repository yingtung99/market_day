import { expect, test } from './fixtures';
import {
  authRoleCases,
  getCredentials,
  installLocalLoginStub,
  installLogoutStub,
  loginWithUi,
  readStoredSession,
} from './auth-test-helpers';

test.describe('AUTH-08 登出', () => {
  for (const config of authRoleCases) {
    test(`@smoke ${config.label}登出後清除登入狀態並返回登入頁`, async ({ page }) => {
      const { email, password } = getCredentials(config);
      test.skip(
        !email || !password,
        `尚未設定 ${config.emailEnv} 或 ${config.passwordEnv}`,
      );

      await installLocalLoginStub(page, config, {
        email: email!,
        password: password!,
      });
      await installLogoutStub(page);
      await loginWithUi(page, config, email!, password!);
      await expect(page).toHaveURL(config.dashboardPath);

      const userMenuButton = page.locator('button.user-box');
      await userMenuButton.focus();
      await userMenuButton.press('Enter');

      const logoutButton = page.locator('button.user-menu-item.logout');
      await expect(logoutButton).toBeVisible();
      await logoutButton.focus();
      await logoutButton.press('Enter');

      const logoutResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/auth/logout') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: '確認登出', exact: true }).click();
      const logoutResponse = await logoutResponsePromise;
      const responseBody = await logoutResponse.json();

      expect(logoutResponse.ok()).toBe(true);
      expect(responseBody.statusCode).toBeGreaterThanOrEqual(200);
      expect(responseBody.statusCode).toBeLessThan(300);
      await expect(page).toHaveURL(config.loginPath);

      const session = await readStoredSession(page, config.role);
      expect(session.token).toBeNull();
      expect(session.user).toBeNull();
    });
  }
});
