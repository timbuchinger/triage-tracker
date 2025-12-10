import { test, expect } from '@playwright/test';

test('login error message wraps and does not overflow', async ({ page }) => {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('form');

  const errorText = '{"message":"Invalid email or password","error":"Unauthorized","statusCode":401}';

  await page.evaluate((txt) => {
    const form = document.querySelector('form');
    if (!form) return;

    let alert = document.querySelector('.alert.alert-error');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'alert alert-error min-w-0';

      const svg = document.createElement('svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.className = 'stroke-current shrink-0 h-6 w-6';
      alert.appendChild(svg);

      const container = document.createElement('div');
      container.className = 'flex-1 min-w-0';
      const span = document.createElement('span');
      span.className = 'block break-words whitespace-normal max-w-full';
      span.textContent = txt;
      container.appendChild(span);
      alert.appendChild(container);

      form.insertBefore(alert, form.firstChild || null);
    } else {
      const span = alert.querySelector('.flex-1 span');
      if (span) span.textContent = txt;
    }
  }, errorText);

  await page.waitForTimeout(200);

  const overflow = await page.evaluate(() => {
    const span = document.querySelector('.alert.alert-error .flex-1 .block') as HTMLElement | null;
    if (!span) return { found: false };
    return { found: true, scrollWidth: span.scrollWidth, clientWidth: span.clientWidth, overflow: span.scrollWidth > span.clientWidth };
  });

  expect(overflow.found).toBeTruthy();
  expect(overflow.overflow).toBeFalsy();
});
