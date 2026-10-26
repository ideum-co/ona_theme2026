# Coffee quiz — reconcile the product-template instance with the homepage

Verified on live 2026-10-26.

## The problem customers reported

> "Whatever you answer in the quiz comes up as *Maple*, and it won't let me put images in."

This reproduces **only on product pages** (the "Try our coffee quiz" trigger on every
PDP), never on the homepage.

- **Homepage** (`templates/index.json`) — correct: 7 matches, each with a real product,
  variant id and image; option tags line up. This is the state the #217 fix left.
- **Product pages** (`templates/product.json`) — stale: only 3 matches
  (`raspberry-candy`, `ugly-sweater`, `maple`), every match with `variantId: 0` and no
  image, and a maple-heavy tag spread. The #217 fix only ever updated `index.json`; the
  product template's quiz was never brought along.
- **Non-coffee products** (`templates/product.non-coffee.json`) — a `#coffee-quiz` button
  with **no quiz section behind it**, so it opens nothing.

Why "always maple": on the PDP quiz, Q1/Q2/Q6 carry no tags, and the only scoring
questions (Q3–Q5) are dominated by `maple`, so maple wins most answer paths; the fallback
match is `raspberry-candy`. Why "no images / dead Add to cart": the 3 matches have no
product selected (`variantId: 0`), and the section only shows an image when the match has
a product (it falls back to the product's featured image when the *Image* field is blank).

## Why this is an editor-side fix, not a git PR

`templates/product.json` is **editor-owned and divergent** — git's copy is far behind the
live editor copy (see `branching-and-release.md`; the quiz "exists only in the theme's copy
of product.json", per `deploy-verification.md`). Hand-editing git's `product.json` risks a
merge reverting live editor state. Apply the fix in the **theme editor**.

## The fix

Theme editor → **Product** template → **Coffee quiz** section. Leave each match's *Image*
field blank — the section uses the product's featured photo automatically.

### Questions — paste into each Question block's *Options*

Q1 "How do you brew?" — *How do you make your coffee?*
```
Espresso
Pour Over/ Filter | raspberry-candy-filter
French Press | gargari
AeroPress | gargari
Stovetop / Moka Pot
Automatic Machine
I'm not sure
```

Q2 "How do you drink it?" — *How do you usually enjoy your coffee?*
```
Black | raspberry-candy-filter
With milk
Both
Iced
It depends
```

Q3 "What sounds best?" — *What flavours sound best to you?*
```
🍫 Chocolatey & nutty | aspen
🍯 Sweet & caramel-like | maple
🍓 Fruity & juicy | raspberry-candy
🌸 Floral & delicate | raspberry-candy-filter
🍊 Bright & citrusy | unwind
🍇 Rich & wine-like | gargari
```

Q4 "How adventurous are you?" — *How adventurous do you like your coffee?*
```
Keep it familiar | gateway
Somewhere in the middle | aspen
Take me somewhere new | gargari
```

Q5 "What matters most?" — *What matters most in your next coffee?*
```
Something easy to drink every day | gateway
Something sweet & balanced | maple
Something bright & fruity | raspberry-candy
Something complex & interesting | gargari
Something special / limited | gargari
I just want the best one!
```

Q6 "What are you shopping for?" — *What are you shopping for?*
```
My everyday coffee | gateway
Something for the weekend | unwind
A coffee to explore | gargari
A gift
Not sure yet
```

### Matches — replace the 3 stale blocks with these 7

Delete `ugly-sweater` (discontinued). Edit the two survivors and add four new Match blocks.

| Tag | Product | Title |
|---|---|---|
| `gateway` | Gateway | Gateway |
| `raspberry-candy` | Raspberry Candy | Raspberry Candy |
| `maple` | Maple | Maple |
| `aspen` | Aspen | Aspen |
| `unwind` | Unwind | Unwind |
| `raspberry-candy-filter` | Raspberry Candy Filter | Raspberry Candy Filter |
| `gargari` | Gargari Gutity G1 Red, Ethiopia, Natural | Gargari Gutity G1 Red, Ethiopia, Natural |

Descriptions and reasons (to match the homepage):

- **Gateway** — An approachable, easy-drinking blend with berries and chocolate — the
  perfect first step into specialty coffee. · Smooth & approachable / Great in milk /
  Ideal if you're just getting started
- **Raspberry Candy** — Our most popular blend — fruit-forward espresso with vibrant berry
  notes and creamy white chocolate sweetness. · Juicy & fruit-forward / Shines in milk /
  ONA's signature release
- **Maple** — A warm, balanced everyday espresso with caramel, biscuit, nut and gentle
  spice. · Sweet & caramel-like / Comforting & balanced / Easy to drink every day
- **Aspen** — A rich, classic blend built on chocolate, hazelnut and malt — made for
  milk. · Chocolatey & nutty / Smooth with milk / A dependable crowd-pleaser
- **Unwind** — All the flavour without the caffeine — a smooth, balanced decaf with
  caramel, chocolate and citrus. · Decaf, any time of day / Smooth & balanced / Perfect to
  wind down
- **Raspberry Candy Filter** — The filter side of Raspberry Candy — raspberry, chocolate
  and hibiscus, built for black coffee. · Fruity & floral / Best brewed as filter / Bright
  and clean black
- **Gargari Gutity G1 Red, Ethiopia, Natural** — A single-origin natural from Ethiopia —
  berries, caramel and milk chocolate, for when you want something special. · Complex &
  distinctive / Single-origin Ethiopia / One to explore

### Non-coffee trigger

`templates/product.non-coffee.json` has a `#coffee-quiz` button and no quiz section.
Remove the button — the quiz only recommends coffees, so it does not belong on equipment
or merch. (Adding the quiz section there is the alternative, but it is more work and less
coherent.)

## Known, handled elsewhere

The Gargari match points at the product handle `milk-w-som1` — a known data error carried
over from the homepage. **Leave it as is here**; the team is handling it with a store-side
redirect rather than a handle change. Select the "Gargari…" product in the picker; do not
reason from the handle.
