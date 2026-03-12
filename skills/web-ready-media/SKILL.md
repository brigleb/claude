---
name: web-ready-media
description: "Process a folder of media (photos, videos, audio) into web-optimized assets. Creates a web-ready/ subfolder with everything converted, resized, and sensibly named. Preserves descriptive filenames (slugified) and uses vision to name generic/camera files. Use when you need to prepare raw media for the web."
user_invocable: true
argument_description: "Optional path to a folder of media files. Defaults to the current working directory."
---

# Web-Ready Media

Process a folder of raw media into web-optimized assets in a `web-ready/` subfolder.

## When to use

- Preparing photos/videos from shoots for web use
- Converting HEIC, RAW, TIFF, or oversized JPEG/PNG to web formats
- Batch-renaming generic camera filenames (IMG_1234, DSC_0042, UUIDs, timestamps) with descriptive names
- Creating a manifest of processed media

## Inputs

- `$ARGUMENTS`: optional path to source folder (defaults to current working directory)

## Procedure

### Phase 0 — Prerequisites

1. Verify required tools:
   ```bash
   which sips    # macOS built-in — required for image processing
   which ffmpeg  # required for video/audio — warn if missing, images still work
   which magick  # ImageMagick — optional, used for alpha detection in PNGs
   ```
2. If `ffmpeg` is missing, warn the user: "ffmpeg not found — video and audio files will be skipped. Install with: brew install ffmpeg"
3. Resolve the source directory:
   - If `$ARGUMENTS` is provided and is a valid directory, use it
   - Otherwise use the current working directory
4. Confirm the source directory exists and contains media files

### Phase 1 — Scan & Inventory

1. Recursively find all files in the source directory (excluding hidden files, `.DS_Store`, and any existing `web-ready/` folder)
2. Classify each file by extension into categories:

   | Category | Extensions |
   |----------|-----------|
   | **image** | `.jpg`, `.jpeg`, `.png`, `.heic`, `.heif`, `.tiff`, `.tif`, `.webp`, `.bmp`, `.gif`, `.raw`, `.cr2`, `.nef`, `.arw`, `.dng` |
   | **video** | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`, `.mts` |
   | **audio** | `.mp3`, `.wav`, `.aac`, `.m4a`, `.flac`, `.ogg` |
   | **skip** | everything else |

3. Report counts to the user: "Found X images, Y videos, Z audio (N non-media skipped)"
4. If there are 5+ total media files, create a task list to track progress by phase

### Phase 2 — Create Output Structure

1. Create the output directory:
   ```bash
   mkdir -p "<source>/web-ready"
   ```
2. Mirror the subdirectory structure from the source into `web-ready/`, converting directory names to kebab-case:
   - `More Photos/` → `more-photos/`
   - `Raw Exports/2024/` → `raw-exports/2024/`
3. Only create subdirectories that actually contain media files

### Phase 3 — Filename Decisions

For **each** media file, decide whether to rename or preserve the original name.

#### Step 1: Detect "useless" filenames

A filename is **useless** (i.e. not descriptive) if it matches any of these patterns:

- **Camera patterns**: `IMG_NNNN`, `DSC_NNNN`, `DSCF_NNNN`, `P10NNNNN`, `MVI_NNNN`, `DSCN_NNNN`, `SAM_NNNN`, `CRW_NNNN`
  - Regex: `^(IMG|DSC|DSCF|DSCN|MVI|SAM|CRW|P\d{2,3})[-_ ]?\d{3,5}\s*$` (case-insensitive)
- **UUIDs**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - Regex: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (case-insensitive)
- **Bare timestamps**: `2023-07-19 16.34.24`, `20240115_163424`, `2024-07-10 11.50.54`
  - Regex: `^\d{4}[-_]?\d{2}[-_]?\d{2}[\s._-]?\d{2}[._:]?\d{2}[._:]?\d{2}$`
- **Generic sequences**: `photo-1`, `image(3)`, `image`, `photo`
  - Regex: `^(photo|image|pic|picture|screenshot)[-_ (]*\d*[) ]*$` (case-insensitive)
- **Bare numbers**: `11`, `042`, `1234`
  - Regex: `^\d{1,5}$`

#### Step 2: Handle descriptive filenames

If the filename stem (without extension) is **NOT** useless:
- Slugify to kebab-case: replace underscores, spaces, and runs of special chars with hyphens
- Lowercase everything
- Strip leading/trailing hyphens
- Collapse multiple consecutive hyphens into one
- Truncate at 60 characters (at a word/hyphen boundary) if needed
- Example: `Upstream_Imports_Coffee_Rwanda-4.jpg` → `upstream-imports-coffee-rwanda-4.jpg`
- Example: `9 DE JULHO (3) Graziela de Moraes and Dona Vera.jpeg` → `9-de-julho-3-graziela-de-moraes-and-dona-vera.jpeg`
- Example: `El Salvador Rosa Apaneca - 2.jpeg` → `el-salvador-rosa-apaneca-2.jpeg`

#### Step 3: Handle useless filenames with vision

If the filename IS useless:
1. Use the **Read tool** to view the image file (Claude's multimodal capability)
2. Also consider context clues:
   - Parent folder name (e.g. if inside "Rwanda Coffee/", that's useful context)
   - Nearby files with descriptive names (e.g. sibling files named `Upstream_Imports_Coffee_*.jpg`)
   - EXIF data if available via `sips -g all`
3. Generate a descriptive kebab-case filename based on what you see:
   - Be specific and descriptive (e.g. `coffee-cherries-drying-on-raised-beds`)
   - No generic prefixes like `image-of-`, `photo-of-`, `picture-of-`
   - Max 60 characters (excluding extension)
   - Use kebab-case only: `[a-z0-9]+(-[a-z0-9]+)*`

For **video** files with useless names:
- Extract a thumbnail frame: `ffmpeg -i <input> -vframes 1 -ss 00:00:01 /tmp/thumb_<random>.jpg`
- Use the Read tool to view the thumbnail
- Generate a descriptive name the same way
- Clean up: `rm /tmp/thumb_<random>.jpg`

#### Step 4: Deduplicate

- Maintain a set of all assigned output filenames (including extension)
- On collision, append `-2`, `-3`, etc. before the extension
- Example: if `coffee-farm.jpg` already exists, the next one becomes `coffee-farm-2.jpg`

#### Step 5: Determine output format for images

- If the source is PNG: check for alpha channel
  - If `magick`/`identify` is available: `identify -format '%A' file.png` — if `True` or `Blend`, keep as PNG
  - If ImageMagick is NOT available: keep PNGs as PNG (safe default — don't convert what might have transparency)
- Everything else (JPEG, HEIC, TIFF, RAW, BMP, GIF, WebP, etc.) → **JPEG**

### Phase 4 — Process Images

For each image file:

1. **JPEG output**:
   ```bash
   sips -Z 4000 -s format jpeg -s formatOptions 85 "<input>" --out "<output>"
   ```
2. **Check file size** — if output > 4MB:
   - Try quality 75: `sips -Z 4000 -s format jpeg -s formatOptions 75 "<input>" --out "<output>"`
   - Try quality 65: `sips -Z 4000 -s format jpeg -s formatOptions 65 "<input>" --out "<output>"`
   - Try quality 50: `sips -Z 4000 -s format jpeg -s formatOptions 50 "<input>" --out "<output>"`
   - If still > 4MB, reduce max dimension: try 3000px, then 2500px (at quality 75)
3. **PNG output** (for alpha PNGs):
   ```bash
   sips -Z 4000 -s format png "<input>" --out "<output>"
   ```
   - If output > 4MB: reduce dimensions to 3000px, then 2500px
4. **Verify** each output:
   - File exists
   - Correct format (check with `sips -g format`)
   - Under 4MB
   - Report any failures to the user

Process images in batches — run the sips commands sequentially but report progress every ~5 files.

### Phase 5 — Process Video

For each video file (skip if `ffmpeg` not available):

1. Probe the source:
   ```bash
   ffprobe -v quiet -print_format json -show_streams "<input>"
   ```
2. If already H.264 MP4 with AAC audio:
   ```bash
   ffmpeg -i "<input>" -c copy -movflags +faststart "<output>.mp4"
   ```
3. Otherwise, transcode:
   ```bash
   ffmpeg -i "<input>" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart "<output>.mp4"
   ```
4. Report progress and final file size

### Phase 6 — Process Audio

For each audio file (skip if `ffmpeg` not available):

1. If already MP3 at reasonable bitrate (≤320kbps):
   ```bash
   cp "<input>" "<output>.mp3"
   ```
2. Otherwise:
   ```bash
   ffmpeg -i "<input>" -c:a libmp3lame -q:a 2 "<output>.mp3"
   ```

### Phase 7 — Generate Manifest

Create two manifest files in the `web-ready/` directory:

1. **`manifest.csv`** — machine-readable:
   ```
   original_path,new_filename,type,original_size_bytes,new_size_bytes
   ```
   - `original_path`: relative path from source directory
   - `new_filename`: filename in web-ready (including subdirectory if any)
   - `type`: image, video, or audio
   - `original_size_bytes`: original file size in bytes
   - `new_size_bytes`: processed file size in bytes

2. **`manifest.md`** — human-readable:
   ```markdown
   # Web-Ready Media Manifest

   Processed: YYYY-MM-DD
   Source: <source directory name>

   ## Files

   | Original | Web-Ready | Type | Original Size | New Size | Reduction |
   |----------|-----------|------|---------------|----------|-----------|
   | ... | ... | ... | ... | ... | ...% |

   ## Summary

   - **Images**: X processed
   - **Videos**: X processed
   - **Audio**: X processed
   - **Total original size**: X MB
   - **Total new size**: X MB
   - **Overall reduction**: X%
   ```

### Phase 8 — Summary

Report to the user:
- Total files processed by type (images, videos, audio)
- Total size reduction (original vs. processed, as percentage)
- Output path: `<source>/web-ready/`
- Any files that were skipped or had errors
- Remind the user: "Source files were not modified or deleted."

## Constraints

- **NEVER** modify or delete source files
- **NEVER** overwrite files in `web-ready/` without confirming with the user first (if `web-ready/` already exists, ask whether to overwrite or skip existing)
- **Preserve** descriptive filenames — only rename files with genuinely useless/generic names
- All output filenames: kebab-case, max 60 chars (excl. extension), `[a-z0-9-]` only
- All output images: JPEG or PNG, max 4000px on longest side, max 4MB file size
- All output video: H.264 MP4 with faststart
- All output audio: MP3
- Clean up any temporary files (e.g. video thumbnails in /tmp)
- Process files sequentially to avoid overwhelming the system
- Report progress regularly for large batches
