'use strict';

/**
 * lib/encode.js
 *
 * FFmpeg encoding pipeline for portfolio-media scripts.
 * Handles both native (WebM input with trimming) and screenshot
 * (frame sequence) encoding modes.
 *
 * All ffmpeg calls use execFileSync with argument arrays — never
 * shell string interpolation — for safety and correctness.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// ---------------------------------------------------------------------------
// Internal helper — execFileSync wrapper
// ---------------------------------------------------------------------------

/**
 * Run ffmpeg with the given argument array.
 * @param {string[]} args
 */
function ffmpeg(args) {
  execFileSync('ffmpeg', args, { stdio: 'pipe' });
}

// ---------------------------------------------------------------------------
// requireFfmpeg
// ---------------------------------------------------------------------------

/**
 * Verify ffmpeg is available on PATH. Exits with install instructions if not.
 */
function requireFfmpeg() {
  try {
    execFileSync('which', ['ffmpeg'], { stdio: 'pipe' });
  } catch {
    console.error('Error: ffmpeg not found on PATH.');
    console.error('Install it with:');
    console.error('  macOS:  brew install ffmpeg');
    console.error('  Ubuntu: sudo apt install ffmpeg');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// ffprobeGetDuration
// ---------------------------------------------------------------------------

/**
 * Return the duration of a video file in seconds (float), or null on failure.
 * @param {string} filePath
 * @returns {number|null}
 */
function ffprobeGetDuration(filePath) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ], { stdio: 'pipe' });
    const val = parseFloat(out.toString().trim());
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// encodeFromWebm
// ---------------------------------------------------------------------------

/**
 * Encode a native Playwright WebM recording into MP4, WebM, GIF, and poster images.
 *
 * @param {string} inputWebm      Path to the raw WebM file from Playwright.
 * @param {string} outDir         Output directory (will be created if needed).
 * @param {string} base           Base filename (no extension).
 * @param {object} opts
 * @param {number} [opts.trimStart=0]   Seconds to skip from the beginning.
 * @param {number|null} [opts.duration] Max duration in seconds (null = no limit).
 * @param {number} opts.viewportWidth   Pixel width for GIF scaling.
 */
async function encodeFromWebm(inputWebm, outDir, base, {
  trimStart = 0,
  duration = null,
  viewportWidth,
} = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  const mp4Path  = path.join(outDir, `${base}.mp4`);
  const webmPath = path.join(outDir, `${base}.webm`);
  const gifPath  = path.join(outDir, `${base}.gif`);

  // Build shared trim args that go *before* -i
  const trimArgs = [];
  if (trimStart > 0) trimArgs.push('-ss', trimStart.toFixed(3));
  if (duration !== null) trimArgs.push('-t', duration.toFixed(3));

  // -------------------------------------------------------------------------
  // MP4 — H.264, web-optimized
  // -------------------------------------------------------------------------
  console.log('  Encoding MP4...');
  ffmpeg([
    '-y',
    ...trimArgs,
    '-i', inputWebm,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4Path,
  ]);

  // -------------------------------------------------------------------------
  // WebM — VP9
  // -------------------------------------------------------------------------
  console.log('  Encoding WebM...');
  ffmpeg([
    '-y',
    ...trimArgs,
    '-i', inputWebm,
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-pix_fmt', 'yuv420p',
    webmPath,
  ]);

  // -------------------------------------------------------------------------
  // GIF — two-pass palettegen
  // -------------------------------------------------------------------------
  console.log('  Encoding GIF...');
  const palettePath = path.join(outDir, `${base}-palette.png`);

  // Pass 1: generate palette
  ffmpeg([
    '-y',
    ...trimArgs,
    '-i', inputWebm,
    '-vf', `fps=10,scale=${viewportWidth}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    palettePath,
  ]);

  // Pass 2: apply palette with bayer dither
  ffmpeg([
    '-y',
    ...trimArgs,
    '-i', inputWebm,
    '-i', palettePath,
    '-lavfi', `fps=10,scale=${viewportWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    gifPath,
  ]);

  // Remove palette temp file
  try { fs.unlinkSync(palettePath); } catch { /* ignore */ }

  // -------------------------------------------------------------------------
  // Poster frames — extract first frame from MP4 via ffmpeg, then sharp
  // -------------------------------------------------------------------------
  console.log('  Generating poster frames...');
  const posterPng  = path.join(outDir, `${base}-poster.png`);
  const posterWebp = path.join(outDir, `${base}-poster.webp`);
  const posterAvif = path.join(outDir, `${base}-poster.avif`);

  // Extract frame 1 from the encoded MP4
  ffmpeg([
    '-y',
    '-i', mp4Path,
    '-vframes', '1',
    '-q:v', '2',
    posterPng,
  ]);

  const posterBuf = fs.readFileSync(posterPng);
  await sharp(posterBuf).webp({ quality: 90 }).toFile(posterWebp);
  await sharp(posterBuf).avif({ quality: 80 }).toFile(posterAvif);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\nOutputs in ${outDir}/:`);
  for (const name of [`${base}.mp4`, `${base}.webm`, `${base}.gif`,
                       `${base}-poster.png`, `${base}-poster.webp`, `${base}-poster.avif`]) {
    console.log(`  ${name}`);
  }
}

// ---------------------------------------------------------------------------
// encodeFromFrames
// ---------------------------------------------------------------------------

/**
 * Encode a PNG frame sequence into MP4, WebM, GIF, and poster images,
 * then clean up the frames directory.
 *
 * @param {string} framesDir    Directory containing frame-000000.png …
 * @param {string} outDir       Output directory (will be created if needed).
 * @param {string} base         Base filename (no extension).
 * @param {object} opts
 * @param {number} opts.fps           Frames per second of the sequence.
 * @param {number} opts.viewportWidth Pixel width for GIF scaling.
 */
async function encodeFromFrames(framesDir, outDir, base, { fps, viewportWidth }) {
  fs.mkdirSync(outDir, { recursive: true });

  const mp4Path  = path.join(outDir, `${base}.mp4`);
  const webmPath = path.join(outDir, `${base}.webm`);
  const gifPath  = path.join(outDir, `${base}.gif`);
  const framePattern = path.join(framesDir, 'frame-%06d.png');

  // -------------------------------------------------------------------------
  // MP4 — H.264, web-optimized
  // -------------------------------------------------------------------------
  console.log('  Encoding MP4...');
  ffmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', framePattern,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4Path,
  ]);

  // -------------------------------------------------------------------------
  // WebM — VP9
  // -------------------------------------------------------------------------
  console.log('  Encoding WebM...');
  ffmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', framePattern,
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-pix_fmt', 'yuv420p',
    webmPath,
  ]);

  // -------------------------------------------------------------------------
  // GIF — capped at 10fps, two-pass palettegen
  // -------------------------------------------------------------------------
  console.log('  Encoding GIF...');
  const gifFps = Math.min(fps, 10);
  const palettePath = path.join(framesDir, 'palette.png');

  // Pass 1: generate palette
  ffmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', framePattern,
    '-vf', `fps=${gifFps},scale=${viewportWidth}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    palettePath,
  ]);

  // Pass 2: apply palette with bayer dither
  ffmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', framePattern,
    '-i', palettePath,
    '-lavfi', `fps=${gifFps},scale=${viewportWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    gifPath,
  ]);

  // -------------------------------------------------------------------------
  // Poster frames — copy first frame then convert with sharp
  // -------------------------------------------------------------------------
  console.log('  Generating poster frames...');
  const firstFrame = path.join(framesDir, 'frame-000000.png');
  const posterPng  = path.join(outDir, `${base}-poster.png`);
  const posterWebp = path.join(outDir, `${base}-poster.webp`);
  const posterAvif = path.join(outDir, `${base}-poster.avif`);

  fs.copyFileSync(firstFrame, posterPng);

  const posterBuf = fs.readFileSync(posterPng);
  await sharp(posterBuf).webp({ quality: 90 }).toFile(posterWebp);
  await sharp(posterBuf).avif({ quality: 80 }).toFile(posterAvif);

  // -------------------------------------------------------------------------
  // Cleanup frames directory
  // -------------------------------------------------------------------------
  console.log('  Cleaning up frames...');
  fs.rmSync(framesDir, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\nOutputs in ${outDir}/:`);
  for (const name of [`${base}.mp4`, `${base}.webm`, `${base}.gif`,
                       `${base}-poster.png`, `${base}-poster.webp`, `${base}-poster.avif`]) {
    console.log(`  ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  requireFfmpeg,
  ffprobeGetDuration,
  encodeFromWebm,
  encodeFromFrames,
};
