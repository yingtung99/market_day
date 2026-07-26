import { expect, Page, Response } from '@playwright/test';

export type AuthRole = 'vendor' | 'organizer' | 'admin';

export interface AuthRoleCase {
  role: AuthRole;
  label: string;
  expectedApiRole: 'VENDOR' | 'ORGANIZER' | 'ADMIN';
  loginPath: string;
  dashboardPath: string;
  loginHeading: string;
  loginButtonName: string;
  emailEnv: string;
  passwordEnv: string;
}

export const authRoleCases: readonly AuthRoleCase[] = [
  {
    role: 'vendor',
    label: '攤主',
    expectedApiRole: 'VENDOR',
    loginPath: '/vendor/login',
    dashboardPath: '/vendor/dash-board/home',
    loginHeading: '攤主登入',
    loginButtonName: '登入',
    emailEnv: 'E2E_VENDOR_EMAIL',
    passwordEnv: 'E2E_VENDOR_PASSWORD',
  },
  {
    role: 'organizer',
    label: '主辦方',
    expectedApiRole: 'ORGANIZER',
    loginPath: '/organizer/login',
    dashboardPath: '/organizer/dash-board/home',
    loginHeading: '主辦方登入',
    loginButtonName: '登入',
    emailEnv: 'E2E_ORGANIZER_EMAIL',
    passwordEnv: 'E2E_ORGANIZER_PASSWORD',
  },
  {
    role: 'admin',
    label: '管理員',
    expectedApiRole: 'ADMIN',
    loginPath: '/admin/login',
    dashboardPath: '/admin/dash-board/home',
    loginHeading: '管理員登入',
    loginButtonName: '登入後台',
    emailEnv: 'E2E_ADMIN_EMAIL',
    passwordEnv: 'E2E_ADMIN_PASSWORD',
  },
] as const;

export function getCredentials(config: AuthRoleCase): {
  email?: string;
  password?: string;
} {
  return {
    email: process.env[config.emailEnv],
    password: process.env[config.passwordEnv],
  };
}

export async function installLocalLoginStub(
  page: Page,
  config: AuthRoleCase,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.route(`**/api/${config.role}/local-login`, async (route) => {
    const payload = route.request().postDataJSON() as {
      email?: string;
      password?: string;
    };
    const isValid =
      payload.email === credentials.email &&
      payload.password === credentials.password;

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        isValid
          ? apiResult({
              token: createUnsignedJwt({
                sub: `${config.role}-auth-smoke`,
                role: config.expectedApiRole,
                exp: Math.floor(Date.now() / 1000) + 3600,
              }),
              user: createAuthUser(config, credentials.email),
            })
          : apiResult(null, {
              statusCode: 400,
              message: 'Invalid email or password',
            }),
      ),
    });
  });
}

export async function installAuthMeStub(
  page: Page,
  config: AuthRoleCase,
  email: string,
): Promise<void> {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        apiResult({
          user: createAuthUser(config, email),
        }),
      ),
    });
  });
}

export async function installLogoutStub(page: Page): Promise<void> {
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(apiResult(null)),
    });
  });
}

export async function loginWithUi(
  page: Page,
  config: AuthRoleCase,
  email: string,
  password: string,
): Promise<Response> {
  await page.goto(config.loginPath);
  await expect(page.getByRole('heading', { name: config.loginHeading })).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/${config.role}/local-login`) &&
      response.request().method() === 'POST',
  );

  await page
    .getByRole('button', { name: config.loginButtonName, exact: true })
    .click();

  return loginResponsePromise;
}

export async function readStoredSession(
  page: Page,
  role: AuthRole,
): Promise<{ token: string | null; user: string | null }> {
  return page.evaluate((currentRole) => ({
    token: localStorage.getItem(`MarketDayToken_${currentRole}`),
    user: localStorage.getItem(`MarketDayUser_${currentRole}`),
  }), role);
}

export async function installGoogleCredentialStub(
  page: Page,
  email: string,
): Promise<string> {
  const credential = createUnsignedJwt({
    email,
    sub: `e2e-google-${email}`,
  });

  await page.addInitScript((fakeCredential) => {
    const googleState = window as unknown as Record<string, unknown>;
    (window as unknown as Record<string, unknown>)['google'] = {
      accounts: {
        id: {
          initialize: (config: {
            callback: (response: { credential: string }) => void;
          }) => {
            googleState['__e2eGoogleInitialized'] = true;
            googleState['__e2eGoogleCredentialCallback'] = config.callback;
          },
          prompt: () => {
            googleState['__e2eGooglePrompted'] = true;
            window.setTimeout(() => {
              const callback = googleState['__e2eGoogleCredentialCallback'] as
                | ((response: { credential: string }) => void)
                | undefined;
              googleState['__e2eGoogleCredentialDelivered'] = Boolean(callback);
              callback?.({ credential: fakeCredential });
            });
          },
          cancel: () => undefined,
        },
      },
    };
  }, credential);

  return credential;
}

export function createUnsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.e2e-signature`;
}

function apiResult<T>(
  data: T,
  options: { statusCode?: number; message?: string } = {},
): {
  statusCode: number;
  message: string;
  messageDetails: null;
  data: T;
} {
  return {
    statusCode: options.statusCode ?? 200,
    message: options.message ?? 'success',
    messageDetails: null,
    data,
  };
}

function createAuthUser(config: AuthRoleCase, email: string) {
  return {
    email,
    name: `E2E ${config.label}`,
    role: config.expectedApiRole,
    status: 'ACTIVE',
    isLogin: true,
    provider: 'LOCAL',
    googleSub: null,
  };
}
