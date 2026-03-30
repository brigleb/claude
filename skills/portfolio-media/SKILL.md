---
name: portfolio-media
description: >
  This skill should be used when the user asks to "take a screenshot of a website", "record a scroll video",
  "capture a client site", "generate portfolio screenshots", "record a site interaction", "capture at multiple
  viewports", "make a scroll recording", "create a demo video of a website", "capture a page for my portfolio",
  "generate media assets from a URL", or "document a website visually". Trigger on any request to capture or
  record a live website for portfolio, case study, or presentation purposes — including responsive captures,
  before/after comparisons, and interaction demos.
---

# Portfolio Media Capture

Automates capturing websites as screenshots and scroll/interaction videos for portfolio use. Produces
optimized assets in multiple formats ready for portfolio sites, case studies, and presentations.

The scripts live at `~/.claude/skills/portfolio-media/scripts/`. All commands below use this path directly.

## Setup (first-time only)

Check whether setup is already complete before running:

```bash
# Check if dependencies are installed
ls ~/.claude/skills/portfolio-media/scripts/node_modules 2>/dev/null && echo "npm: ok" || echo "npm: needs install"
which ffmpeg && echo "ffmpeg: ok" || echo "ffmpeg: needs install"
```

To install dependencies if needed:

```bash
cd ~/.claude/skills/portfolio-media/scripts
npm install
npx playwright install chromium
# macOS: brew install ffmpeg
# Linux: apt install ffmpeg
```

## Four Capture Modes

### 1. Screenshot Mode

Captures a full-resolution still image at a given viewport, then converts to WebP and AVIF.

```bash
node ~/.claude/skills/portfolio-media/scripts/screenshot.js \
  --url "https://example.com" \
  --viewport macbook-16 \
  --output ./output-folder \
  [--scroll-to 500] \
  [--full-page] \
  [--delay 2000] \
  [--wait-for "#hero-image"]
```

**Parameters:**
- `--url` (required): The URL to capture
- `--viewport` (required): Preset name or `WIDTHxHEIGHT` (e.g., `1440x900`)
- `--output` (required): Output directory — creates `{domain}-screenshot/` subfolder automatically
- `--scroll-to`: Pixel position to scroll to before capture (for below-fold content)
- `--full-page`: Capture the entire scrollable page, not just the viewport
- `--delay`: Extra ms to wait after load (for animations, lazy content)
- `--wait-for`: CSS selector to wait for before capturing
- `--device-scale-factor`: Pixel density, default 2 (Retina). Set to 1 for 1x.

**Viewport presets:**
| Preset | Dimensions |
|---|---|
| `macbook-16` | 1728×1117 |
| `macbook-15` | 1440×900 |
| `macbook-14` | 1512×982 |
| `macbook-13` | 1470×956 |
| `imac-27` | 2560×1440 |
| `ipad-pro-13` | 1024×1366 |
| `ipad-pro-11` | 834×1194 |
| `iphone-16-pro-max` | 440×956 |
| `iphone-16-pro` | 402×874 |
| `iphone-se` | 375×667 |
| `generic-desktop` | 1920×1080 |
| `generic-tablet` | 768×1024 |
| `generic-mobile` | 390×844 |

**Output files** (produced automatically):
- `{domain}-{page}-screenshot-{W}x{H}.png`
- `{domain}-{page}-screenshot-{W}x{H}.webp`
- `{domain}-{page}-screenshot-{W}x{H}.avif`

### 2. Scroll Video Mode

Records a smooth scroll from top to bottom, producing video in multiple formats plus a poster frame.

```bash
node ~/.claude/skills/portfolio-media/scripts/scroll-video.js \
  --url "https://example.com" \
  --viewport 1480x900 \
  --output ./output-folder \
  [--speed 60] \
  [--fps 30] \
  [--delay 2000]
```

**Parameters:**
- `--url` (required): The URL to capture
- `--viewport` (required): Preset name or `WIDTHxHEIGHT`
- `--output` (required): Output directory — creates `{domain}-scroll/` subfolder
- `--speed`: Scroll speed in pixels per second (default: 60)
- `--easing`: Scroll velocity curve — `linear` (default), `ease-out`, `ease-in-out`, `ease-in`, or `cubic-bezier:x1,y1,x2,y2`
- `--method`: Recording method — `native` (default) or `screenshots` (see Recording Methods below)
- `--fps`: Frames per second (default: 30, screenshots mode only)
- `--delay`: Extra ms to wait after load before starting scroll
- `--device-scale-factor`: Pixel density, default 2 (screenshots mode only)

**Output files:**
- `{domain}-{page}-scroll-{W}x{H}.mp4` (H.264, web-optimized)
- `{domain}-{page}-scroll-{W}x{H}.webm` (VP9)
- `{domain}-{page}-scroll-{W}x{H}.gif` (animated, max 10fps)
- `{domain}-{page}-scroll-{W}x{H}-poster.png/webp/avif`

### 3. Interaction Video Mode

Records a click action and the resulting page transition or animation.

```bash
node ~/.claude/skills/portfolio-media/scripts/interaction-video.js \
  --url "https://example.com" \
  --viewport 1480x900 \
  --output ./output-folder \
  --click "nav a[href='/about']" \
  [--click-text "About Us"] \
  [--record-duration 5] \
  [--delay 2000]
```

**Parameters:**
- `--url` (required): Starting URL
- `--viewport` (required): Preset name or `WIDTHxHEIGHT`
- `--output` (required): Output directory — creates `{domain}-interaction/` subfolder
- `--click`: CSS selector of element to click
- `--click-text`: Alternative — find element by visible text content
- `--record-duration`: Seconds to record after the click (default: 5)
- `--method`: Recording method — `native` (default) or `screenshots` (see Recording Methods below)
- `--delay`: Extra ms to wait after initial load before clicking
- `--device-scale-factor`: Pixel density, default 2 (screenshots mode only)

**Output files:** Same naming pattern as scroll video but with `-interaction-` in the filename.

### 4. Ambient Video Mode

Records a static viewport section for a specified duration, capturing real-time motion like background videos, CSS animations, and looping content.

```bash
node ~/.claude/skills/portfolio-media/scripts/ambient-video.js \
  --url "https://example.com" \
  --viewport macbook-15 \
  --output ./output-folder \
  --duration 8 \
  [--scroll-to 500] \
  [--delay 2000] \
  [--wait-for ".hero-video"]
```

**Parameters:**
- `--url` (required): The URL to capture
- `--viewport` (required): Preset name or `WIDTHxHEIGHT`
- `--output` (required): Output directory — creates `{domain}-ambient/` subfolder
- `--duration` (required): Seconds to record
- `--scroll-to`: Pixel position to scroll to before recording
- `--delay`: Extra ms to wait after load before recording
- `--wait-for`: CSS selector to wait for before recording
- `--method`: Recording method — `native` (default) or `screenshots`

**Output files:**
- `{domain}-{page}-ambient-{W}x{H}.mp4` (H.264, web-optimized)
- `{domain}-{page}-ambient-{W}x{H}.webm` (VP9)
- `{domain}-{page}-ambient-{W}x{H}.gif` (animated, max 10fps)
- `{domain}-{page}-ambient-{W}x{H}-poster.png/webp/avif`

## Recording Methods

All video scripts (scroll, interaction, ambient) support two recording methods via `--method`:

| Method | Description | Best for |
|---|---|---|
| `native` (default) | Uses Playwright's built-in video recording. Captures real browser motion: background videos, CSS animations, transitions, canvas/WebGL. Records at 1x viewport resolution. | Most use cases, especially sites with motion content |
| `screenshots` | Captures individual screenshots and stitches with ffmpeg. Supports 2x retina via `--device-scale-factor`. Cannot capture real video playback or animations between frames. | When you need retina resolution output |

## Scroll Easing

The scroll video script supports `--easing` to control the scroll velocity curve:

| Value | Behavior |
|---|---|
| `linear` (default) | Constant scroll speed |
| `ease-out` | Fast start, gentle deceleration to stop |
| `ease-in-out` | Slow start, cruise, gentle stop |
| `ease-in` | Gentle start, accelerates |
| `cubic-bezier:x1,y1,x2,y2` | Custom CSS cubic-bezier curve |

Example:
```bash
node ~/.claude/skills/portfolio-media/scripts/scroll-video.js \
  --url "https://example.com" \
  --viewport macbook-15 \
  --output ./output \
  --easing ease-in-out \
  --speed 50
```

## Usage Patterns

### Capture a client site at multiple viewports

To capture responsive breakpoints for a portfolio case study:

```bash
URL="https://clientsite.com"
for vp in macbook-16 ipad-pro-13 iphone-16-pro; do
  node ~/.claude/skills/portfolio-media/scripts/screenshot.js \
    --url "$URL" --viewport $vp --output ~/Desktop/captures
done
```

### Record a full-page scroll for a case study

```bash
node ~/.claude/skills/portfolio-media/scripts/scroll-video.js \
  --url "https://clientsite.com" \
  --viewport macbook-15 \
  --output ~/Desktop/captures \
  --speed 50
```

### Record a menu or navigation interaction

```bash
node ~/.claude/skills/portfolio-media/scripts/interaction-video.js \
  --url "https://clientsite.com" \
  --viewport macbook-15 \
  --output ~/Desktop/captures \
  --click-text "Menu" \
  --record-duration 4
```

### Record a hero section with a background video

```bash
node ~/.claude/skills/portfolio-media/scripts/ambient-video.js \
  --url "https://clientsite.com" \
  --viewport macbook-15 \
  --output ~/Desktop/captures \
  --duration 6
```

## What the Scripts Handle Automatically

- **Cookie banners**: Auto-dismissed before capture by testing common consent button selectors.
- **Lazy-loaded images**: A full-page pre-scroll triggers lazy loading before the actual capture.
- **Slow-rendering pages**: Scripts wait for `networkidle` plus any `--delay` specified.
- **Animated content**: Use `--delay` to let entrance animations complete before capture.
- **Fixed/sticky headers**: Preserved naturally — Playwright captures the live viewport state.

## Notes

- Scripts create output subdirectories automatically.
- File naming uses the domain and path slug (`homepage` for `/`).
- Video GIF output uses ffmpeg's `palettegen` filter for better color quality.
- All scripts exit 0 on success, non-zero with stderr messages on failure.
