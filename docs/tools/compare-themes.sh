#!/usr/bin/env bash
# Side-by-side comparison: published theme vs ona_theme2026.
#
# Lives under docs/ deliberately: the Shopify GitHub integration syncs only the
# known theme directories (assets, blocks, config, layout, locales, sections,
# snippets, templates). docs/ is verified not to sync, so nothing here reaches
# the theme.
#
# Usage:  bash docs/tools/compare-themes.sh [outdir]
#
# Fetches the same set of pages from each theme using a per-theme cookie jar --
# NOT a shared one. ?preview_theme_id= sets a sticky cookie, so a single jar
# would silently serve one theme for both halves and the diff would come back
# empty and look like a pass.

set -uo pipefail

LIVE_ID="${LIVE_ID:-160815546559}"
NEW_ID="${NEW_ID:-154676789439}"
BASE="https://onacoffee.com.au"
OUT="${1:-./theme-compare-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUT"

PAGES=( "" "collections/all-coffee" "products/maple" "products/raspberry-candy"
        "pages/about" "pages/wholesale" "pages/faq" "pages/contact"
        "search?q=maple" "cart" "blogs/news" )

# A failed fetch must stop the run, not become a data point. `set -e` is not on
# (fetch_theme returns a status the callers check), and plain `curl -s` exits 0
# on a 429 or a 500 and writes the error page to the output file. The Python
# phase would then diff a Shopify error page against a real one and report it as
# content loss -- or, on a timeout, silently skip the pair and read as a pass.
# So: bound every request, and check the status code of every one.
CURL_OPTS=( -sL --connect-timeout 10 --max-time 60 --retry 2 --retry-delay 2 )

fetch_page () {                         # $1=jar  $2=url  $3=outfile ("" = discard)
  local jar="$1" url="$2" dest="${3:-/dev/null}" code
  code=$(curl "${CURL_OPTS[@]}" -b "$jar" -c "$jar" -w '%{http_code}' -o "$dest" "$url") || {
    echo "ABORT: curl failed (exit $?) for $url" >&2; return 1
  }
  if [ "$code" != "200" ]; then
    echo "ABORT: HTTP $code for $url" >&2; return 1
  fi
}

fetch_theme () {                        # $1=label  $2=theme_id
  local label="$1" id="$2" jar="$OUT/.jar-$1"
  rm -f "$jar"
  fetch_page "$jar" "$BASE/?preview_theme_id=$id" "" || return 1
  local probe="$OUT/.probe-$label.html" pinned
  fetch_page "$jar" "$BASE/" "$probe" || return 1
  pinned=$(grep -oE '"id":1[0-9]{11}' "$probe" | head -1 | cut -d: -f2)
  rm -f "$probe"
  if [ "$pinned" != "$id" ]; then
    echo "ABORT: $label pinned to ${pinned:-nothing}, expected $id" >&2; return 1
  fi
  echo "  $label pinned to $pinned OK" >&2
  for p in "${PAGES[@]}"; do
    local safe; safe=$(echo "${p:-home}" | tr '/?=&' '____')
    fetch_page "$jar" "$BASE/$p" "$OUT/$label--$safe.html" || return 1
    # An empty or truncated 200 is just as misleading as a 500.
    if [ ! -s "$OUT/$label--$safe.html" ]; then
      echo "ABORT: empty response for $BASE/$p" >&2; return 1
    fi
  done
}

echo "Fetching published theme ($LIVE_ID)..." >&2; fetch_theme live "$LIVE_ID" || exit 1
echo "Fetching ona_theme2026 ($NEW_ID)..."   >&2; fetch_theme new  "$NEW_ID"  || exit 1

python3 -I - "$OUT" <<'PY'
import glob, os, re, sys
out = sys.argv[1]

def signals(path):
    h = open(path, encoding='utf-8', errors='replace').read()
    nos = re.sub(r'(?is)<script.*?</script>|<style.*?</style>', '', h)
    main = re.search(r'(?is)<main\b.*?</main>', nos)
    body = main.group(0) if main else nos
    text = re.sub(r'(?s)<[^>]+>', ' ', body)
    text = re.sub(r'\s+', ' ', text).strip()
    dead = 0
    for m in re.finditer(r'<a\b[^>]*>', nos):
        t = m.group(0)
        if 'jdgm' in t:            # Judge.me scripted buttons are not links
            continue
        hm = re.search(r'href\s*=\s*"([^"]*)"', t)
        if hm is None or hm.group(1).strip() in ('', '#'):
            dead += 1
    return {
        'visible_chars': len(text),
        'anchors':  len(re.findall(r'<a\b', nos)),
        'dead':     dead,
        'sections': len(re.findall(r'id="shopify-section', h)),
        'prices':   len(re.findall(r'<product-price', h)),
        'pickers':  len(re.findall(r'<variant-picker|<variant-select-component', h)),
        'pricesync':len(re.findall(r'product-card-price-sync', h)),
        'harvest':  len(re.findall(r'(?i)new harvest', h)),
        'inseq':    len(re.findall(r'(?i)in sequence|in-sequence', h)),
        'wfg':      len(re.findall(r'(?i)water for good', h)),
        'jdgm':     len(re.findall(r'jdgm-', h)),
        'lowres':   len(re.findall(r'_fe2a7355|_5026993b|_42d7a4ca|_168a30eb', h)),
    }

keys = ['visible_chars','sections','anchors','dead','prices','pickers','pricesync',
        'wfg','inseq','harvest','jdgm','lowres']
pages = sorted({os.path.basename(p).split('--',1)[1] for p in glob.glob(out+'/live--*.html')})

print('\n%-22s %-11s %s' % ('page','signal','live -> 2026'))
print('-'*72)
for pg in pages:
    a, b = out+'/live--'+pg, out+'/new--'+pg
    if not (os.path.exists(a) and os.path.exists(b)): continue
    A, B = signals(a), signals(b)
    label = pg.replace('.html','')
    first = True
    for k in keys:
        if A[k] == B[k]: continue
        flag = ''
        if k == 'visible_chars' and B[k] < A[k]*0.5: flag = '   <-- CONTENT LOST'
        if k == 'dead' and B[k] > A[k]:              flag = '   <-- new dead links'
        if k == 'wfg' and B[k] < A[k]:               flag = '   <-- WFG line missing'
        if k == 'inseq' and B[k] < A[k]:             flag = '   <-- In Sequence missing'
        if k == 'harvest' and B[k] > A[k]:           flag = '   <-- New Harvest leftover'
        # 135 -> 0 site-wide means the Judge.me APP EMBED is off, not that a
        # review widget vanished; PDPs go 135 -> 314 because the Reviews tab
        # has its own app block, which works without the embed. Both are real
        # signals, so label them differently rather than calling either a loss.
        if k == 'jdgm' and B[k] == 0 and A[k] > 0:   flag = '   <-- Judge.me app embed OFF'
        elif k == 'jdgm' and B[k] > A[k]:            flag = '   (PDP app block present)'
        print('%-22s %-11s %6d -> %-6d%s' % (label if first else '', k, A[k], B[k], flag))
        first = False
    if first:
        print('%-22s %-11s %s' % (label, '(identical on every signal)', ''))
print('\nFiles in', out)
PY
