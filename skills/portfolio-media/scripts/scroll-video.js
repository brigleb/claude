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
const { getEasingBody } = require('./lib/easing');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// recordNative — Playwright video recording with rAF-based eased scrolling
// ---------------------------------------------------------------------------

async function recordNative(argv, vp, outDir, base) {
  const speed = Number(argv.speed) || 60;
  const easingBody = getEasingBody(argv.easing);

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

  // Ensure we start at the top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const maxScroll = Math.max(0, scrollHeight - vp.height);
  const durationMs = (maxScroll / speed) * 1000;

  console.log(`  Page height: ${scrollHeight}px, max scroll: ${maxScroll}px`);
  console.log(`  Scroll duration: ${(durationMs / 1000).toFixed(2)}s, easing: ${argv.easing}`);

  const recordStartTime = Date.now();

  // Hold at top for 1 second
  await page.waitForTimeout(1000);

  // Perform the eased scroll via requestAnimationFrame
  if (maxScroll > 0) {
    await page.evaluate(
      ({ maxScroll, durationMs, easingBody }) => {
        // Construct the easing function from the prebuilt body string
        // eslint-disable-next-line no-new-func
        const ease = new Function('t', easingBody); // NOSONAR - intentional, body is from trusted lib/easing.js
        return new Promise((resolve) => {
          const startTime = performance.now();
          function frame() {
            const elapsed = performance.now() - startTime;
            const rawProgress = Math.min(elapsed / durationMs, 1);
            const easedProgress = ease(rawProgress);
            window.scrollTo(0, Math.round(easedProgress * maxScroll));
            if (rawProgress >= 1) {
              resolve();
            } else {
              requestAnimationFrame(frame);
            }
          }
          requestAnimationFrame(frame);
        });
      },
      { maxScroll, durationMs, easingBody }
    );
  }

  // Hold at bottom for 1 second
  await page.waitForTimeout(1000);

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
  const speed = Number(argv.speed) || 60;
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

  // Ensure we start at the top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const maxScroll = Math.max(0, scrollHeight - vp.height);
  const pxPerFrame = speed / fps;

  console.log(`  Page height: ${scrollHeight}px, max scroll: ${maxScroll}px`);

  let frameNum = 0;

  // Hold at top for 1 second (fps frames)
  const holdFrames = fps;
  for (let i = 0; i < holdFrames; i++) {
    const framePath = path.join(framesDir, `frame-${String(frameNum).padStart(6, '0')}.png`);
    await page.screenshot({ path: framePath });
    frameNum++;
  }

  // Scroll down frame by frame
  let currentScroll = 0;
  while (currentScroll < maxScroll) {
    currentScroll = Math.min(currentScroll + pxPerFrame, maxScroll);
    await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
    await page.waitForTimeout(Math.max(10, Math.floor(1000 / fps / 3)));
    const framePath = path.join(framesDir, `frame-${String(frameNum).padStart(6, '0')}.png`);
    await page.screenshot({ path: framePath });
    frameNum++;
  }

  // Hold at bottom for 1 second (fps frames)
  for (let i = 0; i < holdFrames; i++) {
    const framePath = path.join(framesDir, `frame-${String(frameNum).padStart(6, '0')}.png`);
    await page.screenshot({ path: framePath });
    frameNum++;
  }

  console.log(`  Captured ${frameNum} frames.`);
  await browser.close();

  await encodeFromFrames(framesDir, outDir, base, { fps, viewportWidth: vp.width });

  console.log('Done.');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['url', 'viewport', 'output', 'method', 'easing', 'wait-for'],
    default: {
      speed: 60,
      fps: 30,
      delay: 0,
      method: 'native',
      easing: 'linear',
      'device-scale-factor': 2,
    },
  });

  if (!argv.url)      { console.error('Error: --url is required');      process.exit(1); }
  if (!argv.viewport) { console.error('Error: --viewport is required'); process.exit(1); }
  if (!argv.output)   { console.error('Error: --output is required');   process.exit(1); }

  const vp = resolveViewport(argv.viewport);

  const { domain, pageSlug, outDir } = buildOutputPaths(argv.output, argv.url, 'scroll');
  const base = baseName(domain, pageSlug, 'scroll', vp);

  console.log(`Recording scroll of ${argv.url} at ${vp.width}x${vp.height} [${argv.method}] ...`);

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
