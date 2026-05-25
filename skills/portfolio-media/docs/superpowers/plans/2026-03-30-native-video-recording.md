# Native Video Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch portfolio-media video scripts from screenshot-stitch to Playwright native `recordVideo` as default, add scroll easing, add ambient video mode, and extract shared code into `lib/`.

**Architecture:** Extract duplicated utilities (viewports, page-prep, naming, encoding) into `lib/` modules. Rewrite the three video scripts as thin orchestrators that create a Playwright context (with `recordVideo` for native mode), perform choreography, then delegate to a shared encode module. Add `--method screenshots` fallback preserving current behavior. Add new `ambient-video.js` for static viewport recording.

**Tech Stack:** Node.js, Playwright `^1.49.0` (existing), sharp (existing), ffmpeg (existing), minimist (existing)

**Spec:** `docs/superpowers/specs/2026-03-30-native-video-recording-design.md`

**Security notes:**
- Scripts use `execFileSync` (not `exec`) for calling ffmpeg/ffprobe. All arguments are passed as arrays. Inputs come from the local CLI user, not untrusted external sources.
- The easing module uses dynamic function construction to inject easing math into the browser's `page.evaluate()` context. The function body is selected from a hardcoded set of mathematical expressions in `lib/easing.js` (linear, cubic, cubic-bezier with parsed numeric values). No user-supplied strings are evaluated.

---

### Task 1: Create lib/viewports.js

**Files:**
- Create: `scripts/lib/viewports.js`

- [ ] **Step 1: Create the module**

Export the 13 viewport presets and a `resolveViewport(value)` function that accepts either a preset name (e.g. `'macbook-15'`) or a `WIDTHxHEIGHT` string (e.g. `'800x600'`). Returns `{ width, height }`. Exits with error for unknown values.

See spec for the full viewport preset list.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const v = require('./scripts/lib/viewports'); console.log(v.resolveViewport('macbook-15')); console.log(v.resolveViewport('800x600'));"`

Expected: `{ width: 1440, height: 900 }` then `{ width: 800, height: 600 }`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/viewports.js
git commit -m "refactor: extract viewport presets to lib/viewports.js"
```

---

### Task 2: Create lib/page-prep.js

**Files:**
- Create: `scripts/lib/page-prep.js`

- [ ] **Step 1: Create the module**

Export three functions:

`dismissCookieBanners(page)` — iterates the standard cookie consent selectors (OneTrust, Cookiebot, generic patterns — 14 selectors total, same as current scripts) and clicks the first visible one.

`triggerLazyLoad(page)` — scrolls through the full page in viewport-height increments (100ms per step), then scrolls back to top. Triggers lazy-loaded images.

`prepPage(page, { delay, waitFor })` — runs dismissCookieBanners, triggerLazyLoad, optional waitForSelector, optional delay. Convenience wrapper used by all scripts.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const p = require('./scripts/lib/page-prep'); console.log(typeof p.prepPage, typeof p.dismissCookieBanners, typeof p.triggerLazyLoad);"`

Expected: `function function function`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/page-prep.js
git commit -m "refactor: extract page prep utilities to lib/page-prep.js"
```

---

### Task 3: Create lib/naming.js

**Files:**
- Create: `scripts/lib/naming.js`

- [ ] **Step 1: Create the module**

Export four functions:

`extractDomain(url)` — returns hostname without `www.` prefix.

`extractPageSlug(url)` — returns pathname as a slug (`/portfolio/project-name` becomes `portfolio-project-name`). Returns `'homepage'` for `/`.

`buildOutputPaths(outputBase, url, mode)` — creates `{outputBase}/{domain}-{mode}/` directory, returns `{ domain, pageSlug, outDir }`.

`baseName(domain, pageSlug, mode, vp)` — returns `{domain}-{pageSlug}-{mode}-{W}x{H}` string for file naming.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const n = require('./scripts/lib/naming'); console.log(n.extractDomain('https://www.example.com/about')); console.log(n.extractPageSlug('https://example.com/portfolio/project-name')); console.log(n.baseName('example.com', 'about', 'scroll', {width:1440, height:900}));"`

Expected:
```
example.com
portfolio-project-name
example.com-about-scroll-1440x900
```

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/naming.js
git commit -m "refactor: extract naming utilities to lib/naming.js"
```

---

### Task 4: Create lib/easing.js

**Files:**
- Create: `scripts/lib/easing.js`

This module exports easing function body strings for injection into the browser's `page.evaluate()` context. The strings are selected from a hardcoded set of mathematical expressions — no user-supplied code is evaluated.

- [ ] **Step 1: Create the module**

Export `getEasingBody(name)` which returns a JavaScript function body string (suitable for `new Function('t', body)`) for the given easing name.

Supported names and their math:

| Name | Expression |
|---|---|
| `linear` | `return t;` |
| `ease-in` | `return t * t * t;` (cubic) |
| `ease-out` | `return 1 - Math.pow(1 - t, 3);` (cubic) |
| `ease-in-out` | `return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;` |
| `cubic-bezier:x1,y1,x2,y2` | Newton-Raphson cubic bezier solver (8 iterations) matching CSS behavior |

For `cubic-bezier:`, parse the four float values from the name string using a regex, then construct a function body containing the bezier helper functions (A, B, C, calcBezier, getSlope) and the Newton-Raphson iteration loop. The numeric values are baked into the string as literals.

Exit with error for unrecognized names, printing the valid options.

- [ ] **Step 2: Verify easing functions produce correct values**

Run: `node -e "const { getEasingBody } = require('./scripts/lib/easing'); var F = Function; const ease = new F('t', getEasingBody('ease-in-out')); console.log(ease(0), ease(0.5), ease(1));"`

Expected: `0 0.5 1`

Run: `node -e "const { getEasingBody } = require('./scripts/lib/easing'); var F = Function; const cb = new F('t', getEasingBody('cubic-bezier:0.42,0,0.58,1')); console.log(cb(0), cb(0.5), cb(1));"`

Expected: `0` then approximately `0.5` then `1`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/easing.js
git commit -m "feat: add easing module with cubic-bezier support"
```

---

### Task 5: Create lib/encode.js

**Files:**
- Create: `scripts/lib/encode.js`

Handles both native (WebM input with trimming) and screenshots (frame sequence) encoding pipelines. Produces MP4, WebM, GIF, and poster frames. Uses `execFileSync` with argument arrays (no shell interpolation).

- [ ] **Step 1: Create the module**

Export four functions:

`requireFfmpeg()` — checks that ffmpeg is on PATH, exits with install instructions if not.

`ffprobeGetDuration(filePath)` — returns video duration in seconds (float) or null on failure. Uses `execFileSync('ffprobe', [...args])`.

`encodeFromWebm(inputWebm, outDir, base, { trimStart, duration, viewportWidth })` — for native mode. Takes the raw Playwright WebM file and produces:
- MP4 (H.264, crf 18, slow preset, faststart)
- WebM (VP9 re-encode, crf 30)
- GIF (palettegen two-pass, 10fps cap, viewport width)
- Poster frames (extract first frame from MP4, then sharp to WebP quality 90, AVIF quality 80)

Trim args: if `trimStart > 0`, pass `-ss {trimStart}` before `-i`. If `duration`, pass `-t {duration}` before `-i`. Both as separate array elements.

`encodeFromFrames(framesDir, outDir, base, { fps, viewportWidth })` — for screenshots mode. Takes frame directory with `frame-000000.png` sequence and produces same output set. Uses `-framerate {fps} -i {framesDir}/frame-%06d.png`. Poster from first frame via fs.copy + sharp. Cleans up frames directory after encoding.

Both functions print progress messages and final output listing.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const e = require('./scripts/lib/encode'); console.log(typeof e.encodeFromWebm, typeof e.encodeFromFrames, typeof e.ffprobeGetDuration);"`

Expected: `function function function`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/encode.js
git commit -m "refactor: extract ffmpeg encoding pipeline to lib/encode.js"
```

---

### Task 6: Refactor screenshot.js to use shared libs

**Files:**
- Modify: `scripts/screenshot.js`

Replace inline viewport presets, cookie/lazy-load code, and naming helpers with shared lib imports. No behavior changes.

- [ ] **Step 1: Rewrite screenshot.js**

Remove the inline `VIEWPORTS` object, `COOKIE_SELECTORS` array, `dismissCookieBanners()`, `triggerLazyLoad()`, `extractDomain()`, `extractPageSlug()`. Replace with:

```js
const { resolveViewport } = require('./lib/viewports');
const { prepPage } = require('./lib/page-prep');
const { buildOutputPaths, baseName } = require('./lib/naming');
```

The main function flow stays identical:
1. Parse args (same defaults: device-scale-factor 2, delay 0, full-page false)
2. `resolveViewport(argv.viewport)` instead of inline lookup
3. `buildOutputPaths(argv.output, argv.url, 'screenshot')` instead of manual mkdir
4. `baseName(domain, pageSlug, 'screenshot', vp)` instead of manual string construction
5. Launch browser, create context (same settings), navigate
6. `prepPage(page, { delay, waitFor })` instead of calling dismissCookieBanners + triggerLazyLoad + waitForSelector + delay individually
7. Optional scroll-to (unchanged)
8. Screenshot capture (unchanged)
9. Sharp conversion to WebP + AVIF (unchanged)

- [ ] **Step 2: Verify screenshot.js works**

Run:
```bash
node scripts/screenshot.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-test
ls -la /tmp/pm-test/example.com-screenshot/
```

Expected: Directory contains PNG, WebP, AVIF files with non-zero sizes.

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshot.js
git commit -m "refactor: update screenshot.js to use shared lib modules"
```

---

### Task 7: Rewrite scroll-video.js with native recording

**Files:**
- Modify: `scripts/scroll-video.js`

Complete rewrite. Two recording modes (native default, screenshots fallback). Easing support.

- [ ] **Step 1: Write the new scroll-video.js**

Structure the file as three sections: `recordNative()`, `recordScreenshots()`, and `main()`.

**Imports:**
```js
const { resolveViewport } = require('./lib/viewports');
const { prepPage } = require('./lib/page-prep');
const { buildOutputPaths, baseName } = require('./lib/naming');
const { encodeFromWebm, encodeFromFrames, ffprobeGetDuration } = require('./lib/encode');
const { getEasingBody } = require('./lib/easing');
```

**`recordNative(argv, vp, outDir, base)`:**
1. Get speed (default 60) and easing body from argv
2. Create tmpVideoDir in outDir
3. Launch browser with `recordVideo: { dir: tmpVideoDir, size: { width: vp.width, height: vp.height } }`
4. Navigate, prepPage
5. Scroll to top, get scrollHeight, calculate maxScroll and durationMs (`maxScroll / speed * 1000`)
6. Record `recordStartTime = Date.now()`
7. Wait 1000ms (hold at top)
8. Execute scroll via `page.evaluate()` — pass `{ maxScroll, durationMs, easingBody }`. Inside the evaluate: create ease function from body string, run requestAnimationFrame loop that computes `rawProgress = elapsed / durationMs`, applies `ease(rawProgress)`, scrolls to `Math.round(easedProgress * maxScroll)`, resolves when rawProgress >= 1
9. Wait 1000ms (hold at bottom)
10. Calculate `contentDuration = (Date.now() - recordStartTime) / 1000`
11. Get video path, close context, close browser
12. Find WebM in tmpVideoDir, get raw duration via `ffprobeGetDuration`
13. Calculate `trimStartSec = rawDurationSec - contentDuration` (clamp to 0)
14. Call `encodeFromWebm(rawWebm, outDir, base, { trimStart, duration: contentDuration, viewportWidth })`
15. Remove tmpVideoDir

**`recordScreenshots(argv, vp, outDir, base)`:**
Identical to current scroll-video.js behavior but using shared libs. Parse speed/fps/scaleFactor from argv. Create framesDir. Launch browser with deviceScaleFactor. Navigate, prepPage. Capture hold-at-top frames (fps count), scroll frames (pxPerFrame increments with waitForTimeout), hold-at-bottom frames. Call `encodeFromFrames()`.

**`main()`:**
Parse args with defaults: `speed: 60, fps: 30, delay: 0, method: 'native', easing: 'linear', 'device-scale-factor': 2`. Validate required args. Build output paths. Dispatch to recordNative or recordScreenshots based on `argv.method`.

- [ ] **Step 2: Test native mode**

Run:
```bash
node scripts/scroll-video.js --url "https://example.com" --viewport generic-desktop --output /tmp/pm-test-scroll --speed 120
ls -la /tmp/pm-test-scroll/example.com-scroll/
```

Expected: MP4, WebM, GIF, and poster files with non-zero sizes.

- [ ] **Step 3: Test screenshots fallback mode**

Run:
```bash
node scripts/scroll-video.js --url "https://example.com" --viewport generic-desktop --output /tmp/pm-test-scroll-ss --method screenshots --speed 120
```

Expected: Same output format.

- [ ] **Step 4: Test easing**

Run:
```bash
node scripts/scroll-video.js --url "https://example.com" --viewport generic-desktop --output /tmp/pm-test-scroll-ease --easing ease-in-out --speed 120
```

Expected: Completes without error.

- [ ] **Step 5: Commit**

```bash
git add scripts/scroll-video.js
git commit -m "feat: rewrite scroll-video with native recording, easing support, screenshots fallback"
```

---

### Task 8: Rewrite interaction-video.js with native recording

**Files:**
- Modify: `scripts/interaction-video.js`

Same pattern: native default, screenshots fallback.

- [ ] **Step 1: Write the new interaction-video.js**

Structure: `getClickLocator()` helper, `recordNative()`, `recordScreenshots()`, `main()`.

**`getClickLocator(page, argv)`:**
If `argv.click`, return `page.locator(argv.click).first()`. Otherwise, search for the `click-text` in `a`, `button`, `[role="button"]`, `[role="link"]` elements.

**`recordNative(argv, vp, outDir, base)`:**
1. Get recordDuration (default 5) from argv
2. Create tmpVideoDir, launch browser with recordVideo
3. Navigate, prepPage
4. Record `recordStartTime = Date.now()`
5. Wait 1000ms (initial state)
6. Find click target, scrollIntoViewIfNeeded, wait 300ms, click. On error: close context, exit.
7. Wait 200ms, then wait `recordDuration * 1000`ms
8. Calculate contentDuration, close context/browser
9. Find WebM, ffprobe duration, calculate trim, encodeFromWebm
10. Remove tmpVideoDir

**`recordScreenshots(argv, vp, outDir, base)`:**
Same as current interaction-video.js behavior using shared libs. Uses a `captureFrames(durationSec)` inner function. Records 1s initial, 0.3s pre-click, then recordDuration post-click. Calls encodeFromFrames.

**`main()`:**
Parse args. Validate url, viewport, output, click/click-text. Dispatch to native or screenshots.

- [ ] **Step 2: Test native mode**

Run:
```bash
node scripts/interaction-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-test-int --click-text "More information" --record-duration 3
ls -la /tmp/pm-test-int/example.com-interaction/
```

Expected: MP4, WebM, GIF, poster files.

- [ ] **Step 3: Test screenshots fallback**

Run:
```bash
node scripts/interaction-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-test-int-ss --click-text "More information" --method screenshots --record-duration 3
```

Expected: Same output format.

- [ ] **Step 4: Commit**

```bash
git add scripts/interaction-video.js
git commit -m "feat: rewrite interaction-video with native recording and screenshots fallback"
```

---

### Task 9: Create ambient-video.js

**Files:**
- Create: `scripts/ambient-video.js`

New script for recording a static viewport section with real-time motion.

- [ ] **Step 1: Write ambient-video.js**

Structure: `recordNative()`, `recordScreenshots()`, `main()`.

**`recordNative(argv, vp, outDir, base)`:**
1. Get duration from argv (required)
2. Create tmpVideoDir, launch browser with recordVideo
3. Navigate, prepPage
4. If `--scroll-to`, scroll to position and wait 300ms
5. Record `recordStartTime = Date.now()`
6. Wait `duration * 1000`ms
7. Calculate contentDuration, close context/browser
8. Find WebM, ffprobe, trim, encodeFromWebm
9. Remove tmpVideoDir

**`recordScreenshots(argv, vp, outDir, base)`:**
1. Get duration, fps (default 30), scaleFactor from argv
2. Launch browser with deviceScaleFactor, navigate, prepPage
3. If scroll-to, scroll
4. Capture `Math.ceil(duration * fps)` frames with waitForTimeout pacing
5. encodeFromFrames

**`main()`:**
Parse args. Required: url, viewport, output, duration. Optional: scroll-to, delay, wait-for, method (default native), fps, device-scale-factor. Dispatch to native or screenshots.

Output subfolder: `{domain}-ambient/`
File naming: `{domain}-{page}-ambient-{W}x{H}.{ext}`

- [ ] **Step 2: Test native mode**

Run:
```bash
node scripts/ambient-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-test-amb --duration 3
ls -la /tmp/pm-test-amb/example.com-ambient/
```

Expected: MP4, WebM, GIF, poster files. MP4 duration approximately 3 seconds.

- [ ] **Step 3: Test with scroll-to**

Run:
```bash
node scripts/ambient-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-test-amb2 --duration 3 --scroll-to 200
```

Expected: Completes successfully.

- [ ] **Step 4: Commit**

```bash
git add scripts/ambient-video.js
git commit -m "feat: add ambient-video.js for recording static viewport sections with real motion"
```

---

### Task 10: Update package.json and skill documentation

**Files:**
- Modify: `scripts/package.json`
- Modify: the portfolio-media skill definition file

- [ ] **Step 1: Update package.json**

Bump version to `1.1.0`. Add `"ambient-video": "node ambient-video.js"` to scripts.

- [ ] **Step 2: Update the skill documentation**

Find the portfolio-media skill definition markdown file. Add three new sections after the existing capture modes:

**Section: "4. Ambient Video Mode"** — document the script, all parameters (url, viewport, output, duration required; scroll-to, delay, wait-for, method optional), output file naming pattern, and a usage example.

**Section: "Recording Methods"** — explain the `--method` flag available on all video scripts. Table with `native` (default, captures real browser motion at 1x) and `screenshots` (frame-by-frame capture supporting 2x retina via device-scale-factor).

**Section: "Scroll Easing"** — document the `--easing` flag on scroll-video. Table of values: linear (default), ease-out, ease-in-out, ease-in, cubic-bezier:x1,y1,x2,y2. Include a usage example.

- [ ] **Step 3: Commit**

```bash
git add scripts/package.json <skill-definition-file>
git commit -m "docs: update package.json and skill docs for native recording, ambient mode, easing"
```

- [ ] **Step 4: Final verification — run all four scripts**

Run each against a test URL and confirm output:

```bash
# Screenshot
node scripts/screenshot.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-final

# Scroll (native, with easing)
node scripts/scroll-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-final --speed 120 --easing ease-in-out

# Interaction (native)
node scripts/interaction-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-final --click-text "More information" --record-duration 3

# Ambient (native)
node scripts/ambient-video.js --url "https://example.com" --viewport macbook-15 --output /tmp/pm-final --duration 3
```

Verify all output directories contain the expected files:
```bash
find /tmp/pm-final -type f | sort
```

Expected: Four subdirectories (example.com-screenshot, example.com-scroll, example.com-interaction, example.com-ambient) each with their respective output files.
