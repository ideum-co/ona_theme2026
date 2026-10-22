/*
 * Extracts the user-visible content of a template: the values a reader would notice if they
 * vanished. Shared by the preservation test and by the fixture generator, so the fixture and
 * the check can never drift apart by reading the template two different ways.
 *
 * Regenerate a fixture deliberately, never to make a red test green:
 *   node tests/extract-page-content.mjs templates/page.wholesale.json > tests/fixtures/wholesale-content.json
 * A value that leaves the page is a content decision and belongs in the PR that makes it.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/* Copy, media and destinations. Losing one of these loses information. */
export const CONTENT_KEYS = new Set([
  'main_title', 'title', 'title2', 'subtitle', 'subtitle2', 'content', 'text', 'tips',
  'video_title', 'button_text',
  'image', 'image2', 'image3', 'bottom_image', 'icon', 'video',
  'link', 'url', 'button_url', 'video_url',
  'id',
]);

/* Player furniture and layout decoration: the replacement brings its own, so these are recorded
   for the diff but not required to survive. */
export const CHROME_KEYS = new Set(['play_icon', 'overlay']);

export const stripBanner = (text) => text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');

/* Rich text fields hold markup; the information is the words and the destinations, not the tags.
   Hrefs are pulled out separately so a link buried in a paragraph still counts as content. */
export const normalise = (value) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const hrefsIn = (value) => [...value.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

export function extract(templatePath) {
  const parsed = JSON.parse(stripBanner(readFileSync(templatePath, 'utf8')));
  const required = [];
  const chrome = [];
  const disabled = [];

  const visit = (node, path, live) => {
    const settings = node.settings ?? {};
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;

      const bucket = CONTENT_KEYS.has(key) ? (live ? required : disabled) : CHROME_KEYS.has(key) ? chrome : null;
      if (!bucket) continue;

      const text = normalise(trimmed);
      if (text) bucket.push({ where: path, key, value: text });
      for (const href of hrefsIn(trimmed)) bucket.push({ where: path, key: `${key}@href`, value: href });
    }

    for (const [childKey, child] of Object.entries(node.blocks ?? {})) {
      visit(child, `${path}/${childKey}`, live && !child.disabled);
    }
  };

  for (const [key, section] of Object.entries(parsed.sections ?? {})) {
    visit(section, `${key}(${section.type})`, !section.disabled);
  }

  return { required, chrome, disabled };
}

if (process.argv[1] && process.argv[1].endsWith('extract-page-content.mjs')) {
  const [, , target] = process.argv;
  if (!target) {
    console.error('usage: node tests/extract-page-content.mjs <template.json>');
    process.exit(2);
  }
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  console.log(JSON.stringify({ source: target, generated_from: sha, ...extract(target) }, null, 2));
}
