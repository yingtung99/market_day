import { expect, test as base } from '@playwright/test';
import { environment } from '../src/environments/environment';

const browserApiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
const authApiPattern = new RegExp(
  `^${browserApiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/(?:` +
    '(?:vendor|organizer|admin)/local-login|' +
    'auth/(?:logout|resetPassword/reset)' +
    ')(?:[/?#]|$)',
);
const localAppOrigin = 'http://localhost:4200';

const test = base.extend<{ authApiCorsBridge: void; visualCursor: void }>({
  authApiCorsBridge: [
    async ({ page }, use) => {
      await page.route(authApiPattern, async (route) => {
        const request = route.request();
        const requestOrigin =
          (await request.headerValue('origin')) ?? localAppOrigin;

        if (request.method() === 'OPTIONS') {
          const requestedHeaders =
            (await request.headerValue('access-control-request-headers')) ??
            'content-type';
          const requestedMethod =
            (await request.headerValue('access-control-request-method')) ??
            'GET,POST,PUT,PATCH,DELETE';

          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-credentials': 'true',
              'access-control-allow-headers': requestedHeaders,
              'access-control-allow-methods': requestedMethod,
              'access-control-allow-origin': requestOrigin,
              vary: 'Origin',
            },
          });
          return;
        }

        const { origin: _origin, ...headers } = request.headers();
        const response = await route.fetch({ headers });

        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'access-control-allow-credentials': 'true',
            'access-control-allow-origin': requestOrigin,
            vary: 'Origin',
          },
        });
      });

      await use();
    },
    { auto: true },
  ],
  visualCursor: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const installCursor = () => {
          if (document.querySelector('[data-playwright-cursor]')) {
            return;
          }

          const cursor = document.createElement('div');
          cursor.dataset['playwrightCursor'] = 'true';
          cursor.setAttribute('aria-hidden', 'true');
          cursor.innerHTML = `
            <svg width="20" height="25" viewBox="0 0 20 25" fill="none"
                 xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 1.5V20.5L6.2 16L9.6 23.2L13 21.6L9.6 14.7H16.5L1.5 1.5Z"
                    fill="#202124" stroke="white" stroke-width="1.5"
                    stroke-linejoin="round" />
            </svg>
          `;
          Object.assign(cursor.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            width: '20px',
            height: '25px',
            pointerEvents: 'none',
            zIndex: '2147483647',
            opacity: '0',
            filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35))',
            transform: 'translate(-100px, -100px)',
          });
          document.documentElement.appendChild(cursor);

          const clickRing = document.createElement('div');
          Object.assign(clickRing.style, {
            position: 'fixed',
            width: '24px',
            height: '24px',
            border: '2px solid rgba(66, 133, 244, 0.75)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: '2147483646',
            opacity: '0',
          });
          document.documentElement.appendChild(clickRing);

          document.addEventListener(
            'mousemove',
            (event) => {
              cursor.style.opacity = '1';
              cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
            },
            true,
          );

          document.addEventListener(
            'mousedown',
            (event) => {
              clickRing.style.left = `${event.clientX - 12}px`;
              clickRing.style.top = `${event.clientY - 12}px`;
              clickRing.animate(
                [
                  { opacity: 0.8, transform: 'scale(0.6)' },
                  { opacity: 0, transform: 'scale(1.25)' },
                ],
                { duration: 350, easing: 'ease-out' },
              );
            },
            true,
          );
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', installCursor, { once: true });
        } else {
          installCursor();
        }
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect, test };
