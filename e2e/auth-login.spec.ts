import { expect, test } from './fixtures';
import {
  authRoleCases,
  getCredentials,
  installLocalLoginStub,
  loginWithUi,
  readStoredSession,
} from './auth-test-helpers';

test.describe('AUTH-03 本地登入', () => {
  for (const config of authRoleCases) {
    test(`@smoke ${config.label}使用正確帳密可以登入後台`, async ({ page }) => {
      const { email, password } = getCredentials(config);
      test.skip(
        !email || !password,
        `尚未設定 ${config.emailEnv} 或 ${config.passwordEnv}`,
      );

      await installLocalLoginStub(page, config, {
        email: email!,
        password: password!,
      });
      const loginResponse = await loginWithUi(page, config, email!, password!);
      const responseBody = await loginResponse.json();

      expect(loginResponse.ok()).toBe(true);
      expect(responseBody.statusCode).toBeGreaterThanOrEqual(200);
      expect(responseBody.statusCode).toBeLessThan(300);
      expect(responseBody.data?.user?.role).toBe(config.expectedApiRole);
      await expect(page).toHaveURL(config.dashboardPath);

      const session = await readStoredSession(page, config.role);
      expect(session.token).toBeTruthy();
      expect(JSON.parse(session.user ?? '{}').role).toBe(config.expectedApiRole);
    });
  }

  test('@smoke 主辦方使用錯誤密碼時不能登入', async ({ page }) => {
    const organizer = authRoleCases.find((item) => item.role === 'organizer')!;
    const { email, password } = getCredentials(organizer);
    test.skip(
      !email || !password,
      `尚未設定 ${organizer.emailEnv} 或 ${organizer.passwordEnv}`,
    );

    await installLocalLoginStub(page, organizer, {
      email: email!,
      password: password!,
    });
    const loginResponse = await loginWithUi(
      page,
      organizer,
      email!,
      'DefinitelyWrong-E2E-Password-2026!',
    );
    const responseBody = await loginResponse.json();

    expect(responseBody.statusCode).toBe(400);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('登入失敗');
    await expect(dialog).toContainText(/Email 或密碼錯誤|帳號或密碼錯誤/);
    await expect(page).toHaveURL(organizer.loginPath);
  });
});
