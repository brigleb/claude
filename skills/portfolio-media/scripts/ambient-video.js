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
// recordNative — Playwright video recording of a static viewport with motion
// ---------------------------------------------------------------------------

async function recordNative(argv, vp, outDir, base) {
  const duration = Number(argv.duration);

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

  if (argv['scroll-to']) {
    const [x, y] = String(argv['scroll-to']).split(',').map(Number);
    await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: x || 0, y: y || 0 });
    await page.waitForTimeout(300);
  }

  const recordStartTime = Date.now();

  console.log(`  Recording ${duration}s of ambient content ...`);

  await page.waitForTimeout(duration * 1000);

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
// recordScreenshots — frame-capture mode for static viewport
// ---------------------------------------------------------------------------

async function recordScreenshots(argv, vp, outDir, base) {
  const duration = Number(argv.duration);
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

  if (argv['scroll-to']) {
    const [x, y] = String(argv['scroll-to']).split(',').map(Number);
    await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: x || 0, y: y || 0 });
    await page.waitForTimeout(300);
  }

  const totalFrames = Math.ceil(duration * fps);
  const pacingMs = Math.max(10, Math.floor((1000 / fps) / 2));

  console.log(`  Capturing ${duration}s at ${fps}fps (screenshots mode) ...`);

  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(framesDir, `frame-${String(i).padStart(6, '0')}.png`);
    await page.screenshot({ path: framePath });
    await page.waitForTimeout(pacingMs);
  }

  console.log(`  Captured ${totalFrames} frames.`);
  await browser.close();

  await encodeFromFrames(framesDir, outDir, base, { fps, viewportWidth: vp.width });

  console.log('Done.');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['url', 'viewport', 'output', 'method', 'wait-for'],
    default: {
      delay: 0,
      fps: 30,
      method: 'native',
      'scroll-to': null,
      'device-scale-factor': 2,
    },
  });

  if (!argv.url)        { console.error('Error: --url is required');                                         process.exit(1); }
  if (!argv.viewport)   { console.error('Error: --viewport is required');                                    process.exit(1); }
  if (!argv.output)     { console.error('Error: --output is required');                                      process.exit(1); }
  if (!argv.duration)   { console.error('Error: --duration is required (seconds to record)');                process.exit(1); }

  const vp = resolveViewport(argv.viewport);

  const { domain, pageSlug, outDir } = buildOutputPaths(argv.output, argv.url, 'ambient');
  const base = baseName(domain, pageSlug, 'ambient', vp);

  console.log(`Recording ambient video of ${argv.url} at ${vp.width}x${vp.height} [${argv.method}] ...`);
  console.log(`  Duration: ${argv.duration}s`);

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
