'use strict';

// ---------------------------------------------------------------------------
// Cookie banner dismissal — covers the most common consent frameworks
// ---------------------------------------------------------------------------
const COOKIE_SELECTORS = [
  // OneTrust
  '#onetrust-accept-btn-handler',
  // Cookiebot
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  // Generic patterns
  'button[id*="accept" i][id*="cookie" i]',
  'button[class*="accept" i][class*="cookie" i]',
  'a[id*="accept" i][id*="cookie" i]',
  '[data-testid="cookie-accept"]',
  '[aria-label*="accept" i][aria-label*="cookie" i]',
  // Common CMP buttons
  '.cc-btn.cc-allow',
  '.cc-accept',
  '#gdpr-consent-accept',
  // Generic "Accept" / "Accept All" buttons within cookie contexts
  '.cookie-banner button:first-of-type',
  '.cookie-notice button:first-of-type',
  '[class*="consent"] button[class*="accept" i]',
  '[class*="consent"] button[class*="allow" i]',
];

/**
 * Iterate known cookie consent selectors and click the first visible one.
 *
 * @param {import('playwright').Page} page
 */
async function dismissCookieBanners(page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click({ timeout: 1000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // selector not found or not clickable — move on
    }
  }
}

/**
 * Scroll through the full page in viewport-height increments so lazy-loaded
 * assets are triggered, then scroll back to the top.
 *
 * @param {import('playwright').Page} page
 */
async function triggerLazyLoad(page) {
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  let pos = 0;
  while (pos < scrollHeight) {
    pos += viewportHeight;
    await page.evaluate((y) => window.scrollTo(0, y), pos);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/**
 * Run all standard page preparation steps.
 *
 * @param {import('playwright').Page} page
 * @param {{ delay?: number, waitFor?: string|null }} [options]
 */
async function prepPage(page, { delay = 0, waitFor = null } = {}) {
  await dismissCookieBanners(page);
  await triggerLazyLoad(page);

  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { timeout: 10000 });
    } catch {
      console.warn(`Selector "${waitFor}" not found within 10s, proceeding anyway`);
    }
  }

  if (delay > 0) {
    await page.waitForTimeout(Number(delay));
  }
}

module.exports = { dismissCookieBanners, triggerLazyLoad, prepPage };
