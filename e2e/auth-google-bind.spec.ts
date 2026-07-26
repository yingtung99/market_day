import { expect, test } from './fixtures';
import {
  authRoleCases,
  getCredentials,
  installGoogleCredentialStub,
  installLocalLoginStub,
  loginWithUi,
  readStoredSession,
} from './auth-test-helpers';

const googleBindRoles = authRoleCases.filter(
  (config) => config.role === 'vendor' || config.role === 'organizer',
);

test.describe('AUTH-06 Google 帳號綁定', () => {
  for (const config of googleBindRoles) {
    test(`@smoke ${config.label}可以送出 Google 綁定並更新畫面`, async ({
      page,
    }) => {
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
      const loginBody = await loginResponse.json();
      expect(loginBody.statusCode).toBeGreaterThanOrEqual(200);
      expect(loginBody.statusCode).toBeLessThan(300);

      const credential = await installGoogleCredentialStub(page, email!);
      const session = await readStoredSession(page, config.role);
      const storedUser = JSON.parse(session.user ?? '{}');
      storedUser.provider = 'LOCAL';
      storedUser.googleSub = null;
      await page.evaluate(
        ({ role, user }) =>
          localStorage.setItem(`MarketDayUser_${role}`, JSON.stringify(user)),
        { role: config.role, user: storedUser },
      );

      let googleBound = false;
      let requestBody: Record<string, unknown> | undefined;
      await page.route('**/api/auth/google-bind', async (route) => {
        requestBody = route.request().postDataJSON() as Record<string, unknown>;
        googleBound = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiResult(null)),
        });
      });
      await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            apiResult({
              user: {
                ...storedUser,
                provider: googleBound ? 'BOTH' : 'LOCAL',
                googleSub: googleBound ? `e2e-google-${config.role}` : null,
              },
            }),
          ),
        });
      });

      await page.goto(`/${config.role}/dash-board/account-settings`);
      await expect(page.getByText('未綁定', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '前往綁定' }).click();

      const successDialog = page.getByRole('dialog');
      await expect(successDialog).toContainText('Google 帳號綁定成功');
      expect(requestBody).toEqual({ credential });
      await successDialog.getByRole('button', { name: '確定' }).click();
      await expect(page.getByText('已綁定', { exact: true })).toBeVisible();
    });
  }
});

function apiResult<T>(data: T): {
  statusCode: number;
  message: string;
  messageDetails: null;
  data: T;
} {
  return {
    statusCode: 200,
    message: 'success',
    messageDetails: null,
    data,
  };
}
