'use strict';

/**
 * Easing function bodies for injection into the browser via page.evaluate().
 *
 * Each exported string is a valid JavaScript function body that accepts a
 * parameter `t` (0–1) and returns a value (0–1). The caller in the browser
 * context constructs a function from the body string and invokes it inside
 * the requestAnimationFrame scroll loop.
 *
 * The cubic-bezier solver uses Newton-Raphson iteration (8 steps) to match
 * CSS cubic-bezier() behaviour. Values are baked in as numeric literals, so
 * no user-supplied code is ever evaluated.
 */

const EASING_BODIES = {
  'linear':      'return t;',
  'ease-in':     'return t * t * t;',
  'ease-out':    'return 1 - Math.pow(1 - t, 3);',
  'ease-in-out': 'return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;',
};

/**
 * Build a cubic-bezier function body string with the four control-point
 * values baked in as numeric literals. Implements a Newton-Raphson solver
 * (8 iterations) matching CSS cubic-bezier() behaviour.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {string}
 */
function buildCubicBezierBody(x1, y1, x2, y2) {
  return `
  var cx = 3 * ${x1};
  var bx = 3 * (${x2} - ${x1}) - cx;
  var ax = 1 - cx - bx;
  var cy = 3 * ${y1};
  var by = 3 * (${y2} - ${y1}) - cy;
  var ay = 1 - cy - by;

  function calcBezierX(t) { return ((ax * t + bx) * t + cx) * t; }
  function calcBezierY(t) { return ((ay * t + by) * t + cy) * t; }
  function getSlope(t)    { return 3 * ax * t * t + 2 * bx * t + cx; }

  // Newton-Raphson: solve calcBezierX(s) == t for s, then return calcBezierY(s)
  var s = t;
  for (var i = 0; i < 8; i++) {
    var slope = getSlope(s);
    if (slope === 0) break;
    s -= (calcBezierX(s) - t) / slope;
  }
  return calcBezierY(s);
`.trim();
}

/**
 * Return the easing function body string for the given easing name.
 *
 * Supported names:
 *   linear | ease-in | ease-out | ease-in-out
 *   cubic-bezier:x1,y1,x2,y2
 *
 * If `name` is null or undefined, the linear body is returned.
 * Unrecognised names cause process.exit(1) with a helpful error message.
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
function getEasingBody(name) {
  if (name == null) {
    return EASING_BODIES['linear'];
  }

  if (EASING_BODIES[name]) {
    return EASING_BODIES[name];
  }

  const cbMatch = name.match(/^cubic-bezier:([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/);
  if (cbMatch) {
    const [, x1, y1, x2, y2] = cbMatch.map(Number);
    return buildCubicBezierBody(x1, y1, x2, y2);
  }

  const valid = [...Object.keys(EASING_BODIES), 'cubic-bezier:x1,y1,x2,y2'];
  console.error(`[easing] Unknown easing name: "${name}"`);
  console.error(`[easing] Valid options: ${valid.join(', ')}`);
  process.exit(1);
}

module.exports = { getEasingBody };
