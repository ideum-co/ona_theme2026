import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const assets = resolve(root, 'assets');

test('every requestIdleCallback call site is Safari-safe', () => {
  /*
   * Safari/WebKit has never shipped `requestIdleCallback`. A bare reference to
   * it is not `undefined` there -- it is an unresolvable identifier, so it
   * throws `ReferenceError: Can't find variable: requestIdleCallback` and
   * takes the rest of the calling path down with it.
   *
   * `utilities.js` exports a guarded wrapper that falls back to
   * `setTimeout(cb, 0)`. Importing that is the fix; `predictive-search.js`
   * called the global instead, which threw for returning Safari visitors as
   * soon as the search dialog tried to render its recently-viewed empty
   * state (issue #363).
   *
   * Two spellings are already safe and stay allowed: `window.requestIdleCallback(...)`
   * is a property read, not an identifier lookup, and
   * `typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout`
   * (view-transitions.js) never evaluates the bare name on Safari because
   * `typeof` on an undeclared identifier does not throw.
   *
   * Derived from the directory rather than a list of known files, so a caller
   * added tomorrow is covered without anyone remembering to update this.
   */
  const offenders = [];

  for (const name of readdirSync(assets)) {
    if (!name.endsWith('.js') || name === 'utilities.js') continue;

    const source = readFileSync(resolve(assets, name), 'utf8');

    // Bare `requestIdleCallback(` -- not `window.`/`globalThis.`-qualified.
    const callsGlobal = /(^|[^.\w])requestIdleCallback\s*\(/.test(source);
    if (!callsGlobal) continue;

    const importsHelper =
      /import\s*\{[^}]*\brequestIdleCallback\b[^}]*\}\s*from\s*'@theme\/utilities'/s.test(source);
    if (!importsHelper) offenders.push(name);
  }

  assert.deepEqual(
    offenders,
    [],
    `these call the global directly and throw on Safari: ${offenders.join(', ')}`
  );
});
