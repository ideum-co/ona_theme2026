import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const header = read('sections/header.liquid');
const actions = read('snippets/header-actions.liquid');
const search = read('snippets/search.liquid');
const row = read('snippets/header-row.liquid');

const iconPaths = [
  'assets/icon-header-user.svg',
  'assets/icon-header-search.svg',
  'assets/icon-header-bag.svg',
];

for (const iconPath of iconPaths) {
  assert.ok(fs.existsSync(iconPath), `${iconPath} must exist`);
  const icon = read(iconPath);
  assert.match(icon, /viewBox="0 0 27 29\.4"/, `${iconPath} must preserve the supplied viewBox`);
  assert.match(icon, /currentColor/, `${iconPath} must follow the configured header color`);
  assert.doesNotMatch(icon, /#fff\b/i, `${iconPath} must not keep a fixed white fill`);
  assert.doesNotMatch(icon, /AdobeIllustrator|aipgf/i, `${iconPath} must not contain Illustrator metadata`);
}

assert.match(actions, /@param \{string\} \[search_markup\]/, 'header-actions must document its search markup input');
assert.match(header, /render 'header-actions'[\s\S]*?search_markup:\s*search/, 'header must pass search into actions');
assert.match(search, /'icon-header-search\.svg' \| inline_asset_content/, 'search must use the approved asset');
assert.match(actions, /'icon-header-user\.svg' \| inline_asset_content/, 'account must use the approved asset');
assert.match(actions, /'icon-header-bag\.svg' \| inline_asset_content/, 'cart must use the approved asset');

const quickLinksIndex = header.indexOf('class="header-quick-links"');
const actionsRenderIndex = header.indexOf("render 'header-actions'");
assert.ok(quickLinksIndex >= 0 && actionsRenderIndex > quickLinksIndex, 'Shop and Subscribe must precede header-actions');

const accountIndex = actions.indexOf('<shopify-account');
const searchIndex = actions.indexOf('{{ search_markup }}');
const cartIndex = actions.indexOf("settings.cart_type == 'drawer'");
assert.ok(accountIndex >= 0 && searchIndex > accountIndex && cartIndex > searchIndex, 'actions must order account, search, then bag');

assert.match(row, /if first != blank[\s\S]*?assign right = right \| append: 'first '/, 'menu trigger must append after right-side actions');

assert.equal((header.match(/search_markup:\s*search/g) || []).length, 1, 'desktop search must enter actions exactly once');
assert.match(actions, /<shopify-account/);
assert.match(search, /on:click="#search-modal\/showDialog"/);
assert.match(actions, /data-testid="cart-drawer-trigger"/);
assert.match(actions, /href="\{\{ routes\.cart_url \}\}"/);
assert.match(actions, /data-testid="cart-count-live-region"/);
assert.match(read('snippets/header-drawer.liquid'), /on:click="\/toggle"/);
