'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Extract the bare domain (without www.) from a URL.
 * Returns 'unknown' if the URL cannot be parsed.
 *
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Extract a URL pathname as a filesystem-safe slug.
 * Slashes become hyphens, non-alphanumeric characters are stripped.
 * Returns 'homepage' for the root path or on error.
 *
 * @param {string} url
 * @returns {string}
 */
function extractPageSlug(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    if (!pathname || pathname === '') return 'homepage';
    return (
      pathname
        .replace(/^\//, '')
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/gi, '') || 'homepage'
    );
  } catch {
    return 'homepage';
  }
}

/**
 * Create the output directory and return naming components.
 *
 * @param {string} outputBase  - Base output directory (e.g. argv.output)
 * @param {string} url         - The page URL being captured
 * @param {string} mode        - Mode string used as directory suffix (e.g. 'screenshot', 'scroll')
 * @returns {{ domain: string, pageSlug: string, outDir: string }}
 */
function buildOutputPaths(outputBase, url, mode) {
  const domain = extractDomain(url);
  const pageSlug = extractPageSlug(url);
  const outDir = path.join(outputBase, `${domain}-${mode}`);
  fs.mkdirSync(outDir, { recursive: true });
  return { domain, pageSlug, outDir };
}

/**
 * Build the base filename (without extension) for a capture.
 *
 * @param {string} domain
 * @param {string} pageSlug
 * @param {string} mode
 * @param {{ width: number, height: number }} vp
 * @returns {string}
 */
function baseName(domain, pageSlug, mode, vp) {
  return `${domain}-${pageSlug}-${mode}-${vp.width}x${vp.height}`;
}

module.exports = { extractDomain, extractPageSlug, buildOutputPaths, baseName };
