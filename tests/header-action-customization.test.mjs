import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const header = read('sections/header.liquid');
const actions = read('snippets/header-actions.liquid');
const search = read('snippets/search.liquid');
const row = read('snippets/header-row.liquid');
const drawer = read('snippets/header-drawer.liquid');
const schema = JSON.parse(header.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)[1]);
const settings = new Map(schema.settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]));

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
assert.match(drawer, /on:click="\/toggle"/);

const expectedSettings = {
  quick_link_font_size: { type: 'range', min: 12, max: 28, step: 1, unit: 'px', default: 16 },
  header_icon_size: { type: 'range', min: 16, max: 40, step: 1, unit: 'px', default: 27 },
  solid_action_button_background: { type: 'color', default: '#8a1238' },
  solid_action_button_text: { type: 'color', default: '#ffffff' },
  solid_action_icon_color: { type: 'color', default: '#4b0b16' },
  transparent_action_button_background: { type: 'color', default: '#8a1238' },
  transparent_action_button_text: { type: 'color', default: '#ffffff' },
  transparent_action_icon_color: { type: 'color', default: '#ffffff' },
};

for (const [id, expected] of Object.entries(expectedSettings)) {
  const setting = settings.get(id);
  assert.ok(setting, `missing ${id}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(setting[key], value, `${id}.${key} must be ${value}`);
  }
}

for (const [settingId, variable, fallback] of [
  ['quick_link_font_size', '--header-quick-link-font-size', '16'],
  ['header_icon_size', '--header-action-icon-size', '27'],
  ['solid_action_button_background', '--header-solid-action-button-background', "'#8a1238'"],
  ['solid_action_button_text', '--header-solid-action-button-text', "'#ffffff'"],
  ['solid_action_icon_color', '--header-solid-action-icon-color', "'#4b0b16'"],
  ['transparent_action_button_background', '--header-transparent-action-button-background', "'#8a1238'"],
  ['transparent_action_button_text', '--header-transparent-action-button-text', "'#ffffff'"],
  ['transparent_action_icon_color', '--header-transparent-action-icon-color', "'#ffffff'"],
]) {
  const unit = settingId.includes('size') ? 'px' : '';
  assert.match(
    header,
    new RegExp(`${variable}:\\s*\\{\\{ section\\.settings\\.${settingId} \\| default: ${fallback} \\}\\}${unit};`),
    `${settingId} must publish a safe CSS variable`,
  );
}

assert.match(header, /--header-action-button-background:\s*var\(--header-solid-action-button-background\)/);
assert.match(header, /--header-action-button-text:\s*var\(--header-solid-action-button-text\)/);
assert.match(header, /--header-action-icon-color:\s*var\(--header-solid-action-icon-color\)/);
assert.match(
  header,
  /\.header\[transparent\][\s\S]*?--header-action-button-background:\s*var\(--header-transparent-action-button-background\)[\s\S]*?--header-action-button-text:\s*var\(--header-transparent-action-button-text\)[\s\S]*?--header-action-icon-color:\s*var\(--header-transparent-action-icon-color\)/,
  'active transparent state must switch all effective colors',
);
assert.match(header, /\.header-quick-links \.button\s*\{[\s\S]*?font-size:\s*var\(--header-quick-link-font-size\)/);
assert.match(header, /\.header-quick-links \.button\s*\{[\s\S]*?--button-background-color:\s*var\(--header-action-button-background\)/);
assert.match(header, /\.header-quick-links \.button\s*\{[\s\S]*?--button-color:\s*var\(--header-action-button-text\)/);
assert.match(header, /#header-component[\s\S]*?\.header-actions__action[\s\S]*?color:\s*var\(--header-action-icon-color\)/);
assert.match(header, /#header-component[\s\S]*?\.header__icon--menu[\s\S]*?color:\s*var\(--header-action-icon-color\)/);
assert.match(header, /\.header-actions__action[\s\S]*?min-width:\s*var\(--minimum-touch-target\)[\s\S]*?min-height:\s*var\(--minimum-touch-target\)/);
assert.match(header, /\.header__icon--menu[\s\S]*?min-width:\s*var\(--minimum-touch-target\)[\s\S]*?min-height:\s*var\(--minimum-touch-target\)/);
