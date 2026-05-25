# Native Video Recording for Portfolio Media Capture

**Date:** 2026-03-30
**Status:** Draft

## Summary

Switch all video capture scripts from the current screenshot-stitch approach to Playwright's native `recordVideo` API as the default recording method. This enables capturing real browser motion — background videos, CSS animations, transitions, and canvas/WebGL rendering. Add a new ambient video mode for recording static viewport sections with motion content. Extract shared code into a `lib/` directory.

## Motivation

The current screenshot-stitch approach captures individual `page.screenshot()` frames at intervals and assembles them with ffmpeg. This misses:

- `<video>` element playback (frames don't advance between screenshots)
- CSS animations and transitions (only captured at snapshot moments)
- Canvas/WebGL animations
- Any real-time motion content

For portfolio pieces that showcase sites with background videos, animated heroes, or smooth transitions, the current approach produces dead-looking output. Playwright's `recordVideo` captures the actual Chromium compositor output, producing video that matches what a visitor sees.

## Design

### Recording Method Switch

All three video scripts (scroll, interaction, ambient) use Playwright's `recordVideo` context option as the default:

```js
const context = await browser.newContext({
  viewport: { width: vp.width, height: vp.height },
  recordVideo: {
    dir: tmpVideoDir,
    size: { width: vp.width, height: vp.height }
  }
});
```

The video size matches the viewport at 1x resolution. This is appropriate because portfolio videos are displayed within constrained containers, not edge-to-edge on retina displays.

After the choreography completes, `browserContext.close()` flushes the WebM file. ffmpeg then post-processes into the standard output set: MP4 (H.264), WebM (VP9 re-encode), GIF, and poster frames (PNG/WebP/AVIF).

**Video trimming:** Playwright starts recording the moment the context is created, so page prep (navigation, cookie dismissal, lazy-load scrolling) is captured in the raw WebM. Each script tracks the wall-clock time from context creation to the start of the "real" content (e.g., the hold-at-top for scroll, the initial-state hold for interaction, the duration start for ambient). ffmpeg's `-ss {trimStart}` and `-t {duration}` flags extract just the relevant portion during post-processing. The raw WebM is discarded after encoding.

### Fallback: `--method screenshots`

All video scripts accept `--method` with two values:

| Value | Behavior |
|---|---|
| `native` | Playwright `recordVideo` (default) |
| `screenshots` | Current frame-capture approach |

When `--method screenshots` is used, `--device-scale-factor` applies (default 2, producing 2x retina frames). In native mode, `--device-scale-factor` is ignored since `recordVideo` captures at 1x compositor resolution.

### Script Changes

#### 1. `scroll-video.js`

**Native mode (default):**

1. Create context with `recordVideo` enabled
2. Load page, dismiss cookies, trigger lazy-load, wait for `--delay`
3. Hold at top for 1 second (real-time wait)
4. Execute smooth scroll via `page.evaluate()` using a `requestAnimationFrame` loop inside the browser. The browser's own frame clock drives the scroll, producing smooth motion in the recording. The evaluate resolves when scroll reaches the bottom.
5. Hold at bottom for 1 second
6. Close context, post-process with ffmpeg

**Scroll timing:** For `--speed 60` (60px/sec), a page with 5000px of scrollable content takes ~83 seconds. The `--speed` value determines total duration: `maxScroll / speed` seconds.

**Easing:** New `--easing` flag controls the scroll velocity curve:

| Value | Behavior |
|---|---|
| `linear` | Constant speed (default) |
| `ease-out` | Fast start, gentle deceleration |
| `ease-in-out` | Slow start, cruise, gentle stop |
| `ease-in` | Gentle start, accelerates |
| `cubic-bezier:x1,y1,x2,y2` | Custom curve |

Easing applies to the overall scroll journey. The `--speed` value determines total duration (same regardless of easing), but the distance-over-time distribution follows the curve. Implementation is a standard cubic-bezier function running inside the `requestAnimationFrame` evaluate.

**Screenshots mode:** Identical to current behavior — capture frame, advance scroll by `speed/fps` pixels, capture next frame, stitch with ffmpeg. `--easing` is ignored in this mode (scroll positions are calculated per-frame without real-time constraints).

**CLI interface:** No breaking changes. New flags: `--method` (default: `native`), `--easing` (default: `linear`).

#### 2. `interaction-video.js`

**Native mode (default):**

1. Create context with `recordVideo` enabled
2. Load page, dismiss cookies, trigger lazy-load, wait for `--delay`
3. Real-time wait for 1 second (records initial state)
4. Perform click action (same locator logic — CSS selector or visible text)
5. Real-time wait for `--record-duration` seconds (default 5)
6. Close context, post-process with ffmpeg

This mode benefits most from the switch. CSS transition easing, opacity fades, page transitions, and any video/canvas content are captured faithfully.

**Screenshots mode:** Identical to current behavior.

**CLI interface:** No breaking changes. New flag: `--method` (default: `native`).

#### 3. `ambient-video.js` (new)

Records a static viewport section for a specified duration. Designed for background videos, looping CSS animations, hero sections with motion content.

```bash
node ~/.claude/skills/portfolio-media/scripts/ambient-video.js \
  --url "https://example.com" \
  --viewport macbook-15 \
  --output ./output \
  --duration 8 \
  [--scroll-to 500] \
  [--delay 2000] \
  [--wait-for ".hero-video"]
```

**Parameters:**

| Flag | Required | Default | Description |
|---|---|---|---|
| `--url` | yes | — | URL to capture |
| `--viewport` | yes | — | Preset name or `WIDTHxHEIGHT` |
| `--output` | yes | — | Output directory (creates `{domain}-ambient/` subfolder) |
| `--duration` | yes | — | Seconds to record |
| `--scroll-to` | no | 0 | Pixel position to scroll to before recording |
| `--delay` | no | 0 | Extra ms to wait after load before recording |
| `--wait-for` | no | — | CSS selector to wait for before recording |
| `--method` | no | `native` | `native` or `screenshots` |

**Implementation (native mode):**

1. Create context with `recordVideo` enabled
2. Load page, dismiss cookies, trigger lazy-load
3. If `--scroll-to`, scroll to position
4. If `--wait-for`, wait for selector
5. Wait for `--delay`
6. Real-time wait for `--duration` seconds
7. Close context, post-process with ffmpeg

**Implementation (screenshots mode):** Capture frames at target fps for `--duration` seconds. Useful for retina poster frames or high-res GIFs of CSS animations. Will not capture real `<video>` playback.

**Output files:** `{domain}-{page}-ambient-{W}x{H}.mp4/.webm/.gif` + poster frames (PNG/WebP/AVIF).

#### 4. `screenshot.js`

No changes. Screenshots remain screenshot-based (this is the correct tool for still captures).

### Shared Code Extraction

Extract duplicated code from all four scripts into `lib/`:

| Module | Contents |
|---|---|
| `lib/viewports.js` | Viewport preset map (13 devices) |
| `lib/page-prep.js` | `dismissCookieBanners(page)`, `triggerLazyLoad(page)` |
| `lib/naming.js` | `extractDomain(url)`, `extractPageSlug(url)`, output path construction |
| `lib/encode.js` | ffmpeg encoding (MP4 H.264, WebM VP9, GIF with palettegen) and poster frame generation (PNG, WebP via sharp, AVIF via sharp) |
| `lib/easing.js` | Easing functions: linear, ease-in, ease-out, ease-in-out, cubic-bezier parser |

The four main scripts become thin orchestrators: parse args, create browser context, perform choreography, hand off to encode.

### Output File Naming

No changes to naming conventions. Each script continues to use its existing pattern:

- Scroll: `{domain}-{page}-scroll-{W}x{H}.{ext}`
- Interaction: `{domain}-{page}-interaction-{W}x{H}.{ext}`
- Ambient: `{domain}-{page}-ambient-{W}x{H}.{ext}`
- Screenshot: `{domain}-{page}-screenshot-{W}x{H}.{ext}`

### ffmpeg Post-Processing

The native recording produces a WebM file from Playwright. Post-processing:

1. **MP4** (H.264): `ffmpeg -i input.webm -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart output.mp4`
2. **WebM** (VP9 re-encode): `ffmpeg -i input.webm -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p output.webm`
3. **GIF**: Same palettegen two-pass approach, capped at 10fps
4. **Poster frames**: Extract first frame, convert to PNG/WebP/AVIF via sharp

For screenshots mode, the existing frame-sequence-to-video ffmpeg pipeline remains unchanged.

### Dependencies

No new dependencies. Playwright `^1.49.0` already supports `recordVideo`. sharp and ffmpeg are already required.

### Skill Documentation Update

Update the portfolio-media skill README to document:
- The `--method` flag on all video scripts
- The `--easing` flag on scroll-video
- The new ambient-video script and its parameters
- A note that native recording captures real motion (background videos, CSS animations) while screenshots mode produces 2x retina frames
