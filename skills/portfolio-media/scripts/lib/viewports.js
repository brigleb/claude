'use strict';

// ---------------------------------------------------------------------------
// Viewport presets
// ---------------------------------------------------------------------------
const VIEWPORTS = {
  'macbook-16':        { width: 1728, height: 1117 },
  'macbook-15':        { width: 1440, height: 900  },
  'macbook-14':        { width: 1512, height: 982  },
  'macbook-13':        { width: 1470, height: 956  },
  'imac-27':           { width: 2560, height: 1440 },
  'ipad-pro-13':       { width: 1024, height: 1366 },
  'ipad-pro-11':       { width: 834,  height: 1194 },
  'iphone-16-pro-max': { width: 440,  height: 956  },
  'iphone-16-pro':     { width: 402,  height: 874  },
  'iphone-se':         { width: 375,  height: 667  },
  'generic-desktop':   { width: 1920, height: 1080 },
  'generic-tablet':    { width: 768,  height: 1024 },
  'generic-mobile':    { width: 390,  height: 844  },
};

/**
 * Resolve a viewport preset name or a WIDTHxHEIGHT string to { width, height }.
 * Exits the process with an error message for unknown values.
 *
 * @param {string} value - Preset name (e.g. 'macbook-16') or 'WIDTHxHEIGHT' (e.g. '1280x800')
 * @returns {{ width: number, height: number }}
 */
function resolveViewport(value) {
  if (VIEWPORTS[value]) {
    return VIEWPORTS[value];
  }
  if (/^\d+x\d+$/.test(value)) {
    const [w, h] = value.split('x').map(Number);
    return { width: w, height: h };
  }
  console.error(`Error: Unknown viewport "${value}". Use a preset name or WIDTHxHEIGHT.`);
  console.error('Available presets:', Object.keys(VIEWPORTS).join(', '));
  process.exit(1);
}

module.exports = { VIEWPORTS, resolveViewport };
