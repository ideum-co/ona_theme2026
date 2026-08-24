import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('sections/section.liquid', 'utf8');
const snippet = fs.readFileSync('snippets/section.liquid', 'utf8');
const schemaSource = section.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/)?.[1];

assert.ok(schemaSource, 'missing section schema');

const settings = JSON.parse(schemaSource).settings;
const limitSetting = settings.find((setting) => setting.id === 'limit_content_width');
const maxSetting = settings.find((setting) => setting.id === 'max_width');

assert.equal(limitSetting.default, false);
assert.equal(maxSetting.visible_if, '{{ section.settings.limit_content_width }}');
assert.match(snippet, /custom-section-content--limited/);
assert.match(snippet, /--custom-section-content-max-width:/);
assert.match(snippet, /max-inline-size: var\(--custom-section-content-max-width/);
assert.match(snippet, /margin-inline: auto/);

const limitedContentWrapper = /<div\s+class="border-style custom-section-content\s*\{%-? if section\.settings\.limit_content_width -?%\}\s*custom-section-content--limited\s*\{%-? endif -?%\}"[\s\S]*?style="[\s\S]*?--custom-section-content-max-width: \{\{ section\.settings\.max_width \}\}px;/;
assert.match(snippet, limitedContentWrapper, 'the max-width class and custom property must be on .custom-section-content');
assert.doesNotMatch(snippet, /class="section-background[^\"]*custom-section-content--limited/);
assert.doesNotMatch(snippet, /class="section[^\"]*custom-section-content--limited/);
