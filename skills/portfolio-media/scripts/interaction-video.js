#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const parseArgs = require('minimist');

const { resolveViewport } = require('./lib/viewports');
const { prepPage } = require('./lib/page-prep');
const { buildOutputPaths, baseName } = require('./lib/naming');
const { encodeFromWebm, encodeFromFrames, ffprobeGetDuration } = require('./lib/encode');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// getClickLocator — resolve click target from argv
// ---------------------------------------------------------------------------

function getClickLocator(page, argv) {
  if (argv.click) {
    return page.locator(argv.click).first();
  }
  return page.locator(
    `a:has-text("${argv['click-text']}"), ` +
    `button:has-text("${argv['click-text']}"), ` +
    `[role="button"]:has-text("${argv['click-text']}"), ` +
    `[role="link"]:has-text("${argv['click-text']}")`
  ).first();
}

// ---------------------------------------------------------------------------
// recordNative — Playwright video recording with native browser capture
// ---------------------------------------------------------------------------

async function recordNative(argv, vp, outDir, base) {
  const recordDuration = Number(argv['record-duration']) || 5;

  const tmpVideoDir = path.join(outDir, '_tmp_video');
  fs.mkdirSync(tmpVideoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    userAgent: USER_AGENT,
    recordVideo: {
      dir: tmpVideoDir,
      size: { width: vp.width, height: vp.height },
    },
  });
  const page = await context.newPage();

  try {
    await page.goto(argv.url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    console.warn('networkidle timed out, proceeding');
  }

  await prepPage(page, { delay: Number(argv.delay), waitFor: argv['wait-for'] });

  const recordStartTime = Date.now();

  // Hold for 1 second to capture the initial state
  await page.waitForTimeout(1000);

  // Find and click the target element
  const targetLocator = getClickLocator(page, argv);
  try {
    await targetLocator.waitFor({ state: 'visible', timeout: 5000 });
    await targetLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await targetLocator.click();
  } catch (err) {
    console.error(`Error clicking target: ${err.message}`);
    await context.close();
    await browser.close();
    process.exit(1);
  }

  // Brief pause to let the transition start, then record post-click
  await page.waitForTimeout(200);
  await page.waitForTimeout(recordDuration * 1000);

  const contentDuration = (Date.now() - recordStartTime) / 1000;

  // Retrieve the recorded video path before closing
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  // Find the raw .webm file in tmpVideoDir
  const files = fs.readdirSync(tmpVideoDir);
  const webmFile = files.find((f) => f.endsWith('.webm'));
  const rawWebm = webmFile ? path.join(tmpVideoDir, webmFile) : videoPath;

  // Calculate trim — Playwright may buffer video before content starts
  const rawDurationSec = ffprobeGetDuration(rawWebm);
  const trimStartSec = rawDurationSec ? Math.max(0, rawDurationSec - contentDuration) : 0;

  await encodeFromWebm(rawWebm, outDir, base, {
    trimStart: trimStartSec,
    duration: contentDuration,
    viewportWidth: vp.width,
  });

  // Clean up temporary video directory
  fs.rmSync(tmpVideoDir, { recursive: true, force: true });

  console.log('Done.');
}

// ---------------------------------------------------------------------------
// recordScreenshots — legacy frame-capture mode
// ---------------------------------------------------------------------------

async function recordScreenshots(argv, vp, outDir, base) {
  const recordDuration = Number(argv['record-duration']) || 5;
  const fps = Number(argv.fps) || 30;
  const scaleFactor = Number(argv['device-scale-factor']) || 2;

  const framesDir = path.join(outDir, '_frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: scaleFactor,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();

  try {
    await page.goto(argv.url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    console.warn('networkidle timed out, proceeding');
  }

  await prepPage(page, { delay: Number(argv.delay), waitFor: argv['wait-for'] });

  let frameNum = 0;
  const interval = 1000 / fps;

  // Inner helper: capture frames for a given duration
  async function captureFrames(durationSec) {
    const totalFrames = Math.ceil(durationSec * fps);
    for (let i = 0; i < totalFrames; i++) {
      const framePath = path.join(framesDir, `frame-${String(frameNum).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath });
      frameNum++;
      if (i < totalFrames - 1) {
        await page.waitForTimeout(Math.max(10, Math.floor(interval / 2)));
      }
    }
  }

  // Phase 1: Record 1 second of initial state
  await captureFrames(1);

  // Phase 2: Find and click the target element
  const targetLocator = getClickLocator(page, argv);
  try {
    await targetLocator.waitFor({ state: 'visible', timeout: 5000 });
    await targetLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Capture pre-click frames showing the element
    await captureFrames(0.3);

    await targetLocator.click();
  } catch (err) {
    console.error(`Error clicking target: ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  // Brief pause to let the transition start
  await page.waitForTimeout(200);

  // Phase 3: Record post-click content
  await captureFrames(recordDuration);

  console.log(`  Captured ${frameNum} total frames.`);
  await browser.close();

  await encodeFromFrames(framesDir, outDir, base, { fps, viewportWidth: vp.width });

  console.log('Done.');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['url', 'viewport', 'output', 'click', 'click-text', 'method', 'wait-for'],
    default: {
      'record-duration': 5,
      delay: 0,
      fps: 30,
      method: 'native',
      'device-scale-factor': 2,
    },
  });

  if (!argv.url)      { console.error('Error: --url is required');      process.exit(1); }
  if (!argv.viewport) { console.error('Error: --viewport is required'); process.exit(1); }
  if (!argv.output)   { console.error('Error: --output is required');   process.exit(1); }
  if (!argv.click && !argv['click-text']) {
    console.error('Error: --click (CSS selector) or --click-text (visible text) is required');
    process.exit(1);
  }

  const vp = resolveViewport(argv.viewport);

  const { domain, pageSlug, outDir } = buildOutputPaths(argv.output, argv.url, 'interaction');
  const base = baseName(domain, pageSlug, 'interaction', vp);

  console.log(`Recording interaction on ${argv.url} at ${vp.width}x${vp.height} [${argv.method}] ...`);

  if (argv.method === 'screenshots') {
    await recordScreenshots(argv, vp, outDir, base);
  } else {
    await recordNative(argv, vp, outDir, base);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
