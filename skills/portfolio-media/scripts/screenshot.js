#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const parseArgs = require('minimist');

const { resolveViewport } = require('./lib/viewports');
const { prepPage } = require('./lib/page-prep');
const { buildOutputPaths, baseName } = require('./lib/naming');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['url', 'viewport', 'output', 'wait-for'],
    boolean: ['full-page'],
    default: {
      'device-scale-factor': 2,
      'delay': 0,
      'scroll-to': null,
      'full-page': false,
    },
  });

  if (!argv.url) { console.error('Error: --url is required'); process.exit(1); }
  if (!argv.viewport) { console.error('Error: --viewport is required'); process.exit(1); }
  if (!argv.output) { console.error('Error: --output is required'); process.exit(1); }

  const vp = resolveViewport(argv.viewport);
  const { domain, pageSlug, outDir } = buildOutputPaths(argv.output, argv.url, 'screenshot');
  const base = baseName(domain, pageSlug, 'screenshot', vp);

  const scaleFactor = Number(argv['device-scale-factor']) || 2;

  console.log(`Capturing ${argv.url} at ${vp.width}x${vp.height} @${scaleFactor}x ...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: scaleFactor,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(argv.url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (err) {
    // networkidle can time out on heavy sites — fall back to load event
    console.warn('networkidle timed out, proceeding with current state');
  }

  await prepPage(page, { delay: Number(argv.delay), waitFor: argv['wait-for'] });

  // Optional scroll-to
  if (argv['scroll-to'] !== null && argv['scroll-to'] !== undefined) {
    await page.evaluate((y) => window.scrollTo(0, y), Number(argv['scroll-to']));
    await page.waitForTimeout(300);
  }

  // Capture
  const pngPath = path.join(outDir, `${base}.png`);
  await page.screenshot({
    path: pngPath,
    fullPage: argv['full-page'],
  });
  console.log(`  PNG: ${pngPath}`);

  await browser.close();

  // Convert to WebP and AVIF
  const pngBuffer = fs.readFileSync(pngPath);

  const webpPath = path.join(outDir, `${base}.webp`);
  await sharp(pngBuffer).webp({ quality: 90 }).toFile(webpPath);
  console.log(`  WebP: ${webpPath}`);

  const avifPath = path.join(outDir, `${base}.avif`);
  await sharp(pngBuffer).avif({ quality: 80 }).toFile(avifPath);
  console.log(`  AVIF: ${avifPath}`);

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
