# ONA Coffee — Design tokens

Inventario de los tokens de diseño del tema `ona_theme2026` (base Shopify Horizon), extraído del código tal como está en `main`. Sirve para dos cosas: generar un archivo de tokens (Figma Variables, Style Dictionary, Tokens Studio…) y saber **de dónde sale cada valor** para cambiarlo en el sitio correcto y no en una copia.

## 1. Fuentes de verdad y orden de precedencia

Los tokens no viven en un solo archivo. Se resuelven en `<head>` en este orden, y **el último que escribe `:root` gana**:

| orden | archivo | qué define |
|---|---|---|
| 1 | `config/settings_schema.json` | los ajustes de tema y sus valores por defecto |
| 2 | `config/settings_data.json` → `current` | los valores **guardados en la tienda** (la paleta, la escala tipográfica, radios, anchos) |
| 3 | `snippets/theme-styles-variables.liquid` | convierte los ajustes en variables CSS y declara todas las escalas fijas (espaciado, opacidades, motion, capas…) |
| 4 | `snippets/brand-fonts.liquid` | **sobrescribe** las familias tipográficas con Silk Serif y Karla |
| 5 | `snippets/color-palette.liquid` | escribe los colores semánticos (botones, inputs, variantes, hover) a partir de la paleta |
| 6 | `assets/base.css` | márgenes de página, anchos, breakpoints, estilos base |

Regla práctica: **un color o tamaño se cambia en `settings_data.json` (o en el editor de temas), nunca en el CSS**. Las excepciones —valores escritos a mano en secciones— están listadas en §2.4 precisamente porque se salen de esa regla.

---

## 2. Color

### 2.1 Paleta de marca

Cinco colores, definidos en `settings_data.json → current.color_palette`. Todo lo demás se deriva de estos.

| token | hex | rgb | hsl | brillo* | rol |
|---|---|---|---|---|---|
| `color.palette.background` | `#F4F3E9` | 244 243 233 | 55° 33% 94% | 242 | Crema. Fondo de página. |
| `color.palette.foreground` | `#470A12` | 71 10 18 | 352° 75% 16% | 29 | Burdeos oscuro. Texto, bordes, botón primario. |
| `color.palette.color1` | `#751132` | 117 17 50 | 340° 75% 26% | 51 | Granate de marca. Fondos de sección, acentos. |
| `color.palette.color2` | `#D67BA6` | 214 123 166 | 332° 53% 66% | 155 | Rosa. Badge *sold out*, acentos decorativos. |
| `color.palette.color3` | `#762D0D` | 118 45 13 | 18° 80% 26% | 63 | Tostado. Bordes de inputs y de selectores de variante. |

\* Brillo según `color_brightness` de Liquid — `(r·299 + g·587 + b·114) / 1000` — que es lo que el tema usa para decidir contrastes y hovers.

Derivados automáticos (`color-palette.liquid` los calcula recorriendo la paleta):

| token | valor | regla |
|---|---|---|
| `--palette-lightest` | `#F4F3E9` | el color opaco de mayor brillo |
| `--palette-darkest` | `#470A12` | el de menor brillo |

### 2.2 Tokens semánticos

Cada uno es un ajuste de tema cuyo **valor por defecto apunta a la paleta** (`{{ settings.color_palette.x }}`). Ninguno está sobrescrito en la tienda salvo los tres marcados con ●.

**Página**

| variable CSS | ajuste | resuelve a |
|---|---|---|
| `--color-background` | `page_background_color` | `background` `#F4F3E9` |
| `--color-foreground` | `page_text_color` | `foreground` `#470A12` |
| `--color-border` | = `page_text_color` | `#470A12` |
| `--color-foreground-muted` | — | `foreground` al 60 % |
| `--color-foreground-subdued` | — | `foreground` al 80 % |

**Botón primario**

| variable CSS | ajuste | resuelve a |
|---|---|---|
| `--color-primary-button-background` | `palette_primary_button_background` | `foreground` `#470A12` |
| `--color-primary-button-text` | `palette_primary_button_text` | `background` `#F4F3E9` |
| `--color-primary-button-border` | `palette_primary_button_border` | `background` `#F4F3E9` |
| `--color-primary-button-hover-background` | derivado | ≈ `#8A1323` (ver regla de hover) |
| `--color-primary-button-hover-text` | derivado | `--palette-lightest` |

**Botón secundario**

| variable CSS | ajuste | resuelve a |
|---|---|---|
| `--color-secondary-button-background` | `palette_secondary_button_background` | `background` `#F4F3E9` |
| `--color-secondary-button-text` | `palette_secondary_button_text` | `foreground` `#470A12` |
| `--color-secondary-button-border` | `palette_secondary_button_border` | `foreground` `#470A12` |
| `--color-secondary-button-hover-background` | derivado | ≈ `#ECEAD8` |

**Inputs**

| variable CSS | ajuste | resuelve a |
|---|---|---|
| `--color-input-background` | `palette_input_background` | `background` |
| `--color-input-text` | `palette_input_text` | `foreground` |
| `--color-input-border` | `palette_input_border` ● | `color3` `#762D0D` |
| `--input-disabled-background-color` | — | `foreground` al 10 % |
| `--input-disabled-text-color` | — | `foreground` al 50 % |

**Selector de variantes**

| variable CSS | ajuste | resuelve a |
|---|---|---|
| `--color-variant-background` | `palette_variant_background` | `background` |
| `--color-variant-text` | `palette_variant_text` | `foreground` |
| `--color-variant-border` | `palette_variant_border` ● | `color3` `#762D0D` |
| `--color-selected-variant-background` | `palette_selected_variant_background` | `foreground` |
| `--color-selected-variant-text` | `palette_selected_variant_text` | `background` |
| `--color-selected-variant-border` | `palette_selected_variant_border` | `foreground` |

**Badges, drawers, popovers**

| ajuste | resuelve a |
|---|---|
| `badge_sale_background_color` | `foreground` |
| `badge_sale_text_color` | *(vacío → contraste automático)* |
| `badge_sold_out_background_color` ● | `color2` `#D67BA6` |
| `badge_sold_out_text_color` | `foreground` |
| `drawer_background_color` / `drawer_text_color` / `drawer_border_color` | `background` / `foreground` / `foreground` |
| `popover_background_color` / `popover_text_color` / `popover_border_color` / `popover_shadow_color` | `background` / `foreground` / `foreground` / `foreground` |
| `quick_add_background` / `quick_add_text` | `background` / `foreground` |

**Estado y utilidad** (fijos en `theme-styles-variables.liquid`, no vienen de la paleta)

| variable CSS | hex |
|---|---|
| `--color-error` | `#8B0000` |
| `--color-success` | `#006400` |
| `--color-instock` | `#3ED660` |
| `--color-lowstock` | `#EE9441` |
| `--color-outofstock` | `#C8C8C8` |
| `--color-white` | `#FFFFFF` |

### 2.3 Regla de hover

`snippets/util-palette-hover-shift.liquid` deriva el color de interacción del color base, por brillo. No es un token guardado: se recalcula en cada render.

| brillo del color base | transformación |
|---|---|
| alpha < 0.4 | alpha + 0.15 |
| ≤ 40 | aclarar 15 % (HSL) |
| 41 – 128 | aclarar 5 % |
| 129 – 190 | oscurecer 10 % |
| > 190 | oscurecer 5 % |

Aplicado a la paleta: `foreground` `#470A12` → ≈ `#8A1323`; `color1` `#751132` → ≈ `#8B143C`; `background` `#F4F3E9` → ≈ `#ECEAD8`. El texto en hover salta a `--palette-lightest` o `--palette-darkest` según el brillo del fondo resultante.

### 2.4 Colores escritos a mano en secciones — y la deriva que hay que cerrar

Las secciones propias de ONA traen colores por defecto en su `schema`, y varios están **guardados** en `templates/index.json`. No pasan por la paleta, así que cambiar la paleta no los mueve. Están aquí para que el archivo de tokens los incluya como alias… o para unificarlos.

| hex | dónde | observación |
|---|---|---|
| `#F5F4EA` | `coffee-quiz`, `product-intro`, `press-quotes`, `collection-carousel`, `club-benefits`, `product-highlight`, `story-video`, `club-invite`, 15 usos en `index.json` | **Crema de sección.** Difiere en 1 punto de `background` `#F4F3E9`. Debería ser el mismo token. |
| `#6B1235` | `coffee-quiz`, `collection-carousel`, 4 usos en `index.json` | **Granate de sección.** Distinto de `color1` `#751132`. |
| `#8A1238` | `header.liquid` (botones de acción, sólido y transparente) | Otro granate. |
| `#8A1538` | `club-benefits`, 1 uso en `index.json` | Otro granate. |
| `#6B1835` | `locations-store-finder`, `locations-flagships` | Otro granate. |
| `#4B0B16` | `header.liquid` (icono sólido) | Variante de `foreground` `#470A12`. |
| `#F5F0E8` | `locations-*` | Otra crema. |
| `#D9A441` / `#B8862B` / `#F3DDA0` | `product-intro` (gradiente del wordmark) | Dorados. No existen en la paleta. |
| `#E488B0` | `product-intro`, 1 uso en `index.json` | Rosa, distinto de `color2` `#D67BA6`. |
| `#252525` / `#333030` / `#4A4340` / `#4D4748` | `locations-*`, `icon`, `club-benefits`, `index.json` | Grises cálidos. No existen en la paleta. |
| `#0A142F` | `header-actions` | Azul marino. Un solo uso. |

**Cinco granates y tres cremas** para lo que en el diseño es un color de cada. Propuesta de tokens canónicos para cuando se unifique:

```
color.brand.cream      #F4F3E9   ← background (absorbe #F5F4EA, #F5F0E8)
color.brand.burgundy   #470A12   ← foreground (absorbe #4B0B16)
color.brand.wine       #751132   ← color1     (absorbe #6B1235, #6B1835, #8A1238, #8A1538)
color.brand.rose       #D67BA6   ← color2     (absorbe #E488B0)
color.brand.toast      #762D0D   ← color3
color.brand.gold       #D9A441   ← nuevo; con #B8862B y #F3DDA0 como escalones del gradiente
color.neutral.charcoal #333030   ← nuevo; absorbe #252525, #4A4340, #4D4748
```

### 2.5 Contraste (WCAG 2.1, sobre `background` `#F4F3E9`)

| combinación | ratio | AA texto | AA texto grande |
|---|---|---|---|
| `foreground` `#470A12` | **14.27 : 1** | ✅ | ✅ |
| `color1` `#751132` | **10.01 : 1** | ✅ | ✅ |
| `color3` `#762D0D` | **8.76 : 1** | ✅ | ✅ |
| `color2` `#D67BA6` | **2.60 : 1** | ❌ | ❌ |
| `color2` sobre `foreground` | 5.49 : 1 | ✅ | ✅ |
| `background` sobre `color1` (botón, sección granate) | 10.01 : 1 | ✅ | ✅ |

`color2` no vale para texto sobre crema; solo como fondo del badge *sold out* con texto `foreground`, que es como está configurado.

### 2.6 Opacidades

Fijas, en `theme-styles-variables.liquid`:

```
--opacity-5: 0.05   --opacity-8: 0.08   --opacity-10: 0.1   --opacity-15: 0.15
--opacity-20: 0.2   --opacity-25: 0.25  --opacity-30: 0.3   --opacity-40: 0.4
--opacity-50: 0.5   --opacity-60: 0.6   --opacity-70: 0.7   --opacity-80: 0.8
--opacity-85: 0.85  --opacity-90: 0.9
--opacity-subdued-text: 0.8   --opacity-muted-text: 0.6
```

Contextuales, calculadas por `brightness-opacities.liquid` según el brillo del fondo (sube en fondos oscuros para que lo semitransparente siga viéndose):

| variable | fondo claro (brillo ≥ 64) | fondo oscuro |
|---|---|---|
| `--opacity-5-15` | 0.05 | 0.15 |
| `--opacity-10-25` | 0.10 | 0.25 |
| `--opacity-30-60` | 0.30 | 0.60 |
| `--opacity-35-55` | 0.35 | 0.55 |
| `--opacity-40-60` | 0.40 | 0.60 |

Sobre la crema de ONA aplican siempre los valores de fondo claro.

---

## 3. Tipografía

### 3.1 Familias

Dos tipografías de marca, **con licencia y servidas desde `assets/`** (no son fuentes de Shopify, por eso no pasan por el `font_picker`). `brand-fonts.liquid` las declara y sobrescribe las variables del tema.

| token | familia | archivos | pesos disponibles | fallback |
|---|---|---|---|---|
| `--font-brand-display` | **Silk Serif** | `silk-serif-{regular,italic,medium,medium-italic}.woff2` | 400, 400 *italic*, 500, 500 *italic* | Georgia, 'Times New Roman', serif |
| `--font-brand-text` | **Karla** | `karla-{regular,italic,medium,bold,bold-italic}.woff2` | 400, 400 *italic*, 500, 700, 700 *italic* | -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif |

Asignación a los cuatro roles del tema:

| rol | variable | familia | peso | estilo | uso |
|---|---|---|---|---|---|
| body | `--font-body--family` | Karla | 400 | normal | párrafos, botones, precio, carrito |
| subheading | `--font-subheading--family` | Karla | 400 | normal | h5, h6, etiquetas |
| heading | `--font-heading--family` | Silk Serif | 400 | normal | h1 – h4, títulos de sección, hero |
| accent | `--font-accent--family` | Silk Serif | 400 | normal | acentos |

Del comp de la home: **Silk Serif solo en títulos de sección y hero; todo lo demás —títulos de producto incluidos— es Karla.**

> Nota: `settings_data.json` sigue guardando `inter_n4/n5/n7` en `type_*_font`. Esos valores ya no gobiernan las familias (las pisa `brand-fonts.liquid`), pero `theme-styles-variables.liquid` sigue emitiendo los `@font-face` de Inter, así que **el navegador descarga Inter sin usarla**. Vale la pena vaciarlo cuando se toque la tipografía.

### 3.2 Escala tipográfica

Los tamaños vienen de `settings_data.json` (`type_size_*`) y `theme-styles-variables.liquid` los convierte. Los que están en **48 px o más se vuelven fluidos**: `clamp(mínimo, tamaño × 0.1 vw, máximo)`, donde el mínimo es el siguiente escalón de la escala (más 4 px si ese escalón está por debajo de 48).

| preset | variable | tamaño | valor emitido | familia | line-height | tracking | caja |
|---|---|---|---|---|---|---|---|
| h1 | `--font-h1--size` | 56 px | `clamp(3rem, 5.6vw, 3.5rem)` | Silk Serif 400 | `display-tight` **1** | `heading-normal` 0 | none |
| h2 | `--font-h2--size` | 48 px | `clamp(2.25rem, 4.8vw, 3rem)` | Silk Serif 400 | `display-tight` **1** | 0 | none |
| h3 | `--font-h3--size` | 32 px | `2rem` | Silk Serif 400 | `display-normal` **1.1** | 0 | none |
| h4 | `--font-h4--size` | 24 px | `1.5rem` | Silk Serif 400 | `display-tight` **1** | 0 | none |
| h5 | `--font-h5--size` | 14 px | `0.875rem` | Karla 400 | `display-loose` **1.2** | 0 | none |
| h6 | `--font-h6--size` | 12 px | `0.75rem` | Karla 400 | `display-loose` **1.2** | 0 | none |
| paragraph | `--font-paragraph--size` | 14 px | `0.875rem` | Karla 400 | `body-loose` **1.6** | — | — |

Cada preset publica además `--font-<preset>--family / --style / --weight / --line-height / --letter-spacing / --case`, y las clases `.h1` … `.h6`, `.paragraph` de `base.css` las consumen. Las secciones de la home leen `--font-h3--size` como tamaño base de título (nivel por defecto H3).

Márgenes de bloque: `--font-heading--spacing: 0.25em` (h1 – h6), `--font-paragraph--spacing: 0.5em`.

### 3.3 Tamaños fijos

Para UI que no pasa por los presets:

```
--font-size--3xs: 0.625rem  (10)    --font-size--xl:  1.25rem (20)
--font-size--2xs: 0.75rem   (12)    --font-size--2xl: 1.5rem  (24)
--font-size--xs:  0.8125rem (13)    --font-size--3xl: 2rem    (32)
--font-size--sm:  0.875rem  (14)    --font-size--4xl: 2.5rem  (40)
--font-size--md:  1rem      (16)    --font-size--5xl: 3rem    (48)
--font-size--lg:  1.125rem  (18)    --font-size--6xl: 3.5rem  (56)
```

Menú: `--menu-font-{sm,md,xl,2xl}--size` = 0.875 / 1 / 1.25 / 1.75 rem, con `line-height: calc(1.1 + 0.5 × min(16 / tamaño))`.

Los selects de tamaño de las secciones (grupo *Typography*) ofrecen: 10, 12, 14, 16, 18, 20, 24, 32, 40, 48, 56, 72, 88, 120, 152, 184 px; a partir de 48 se vuelven fluidos con la misma regla.

### 3.4 Line-height, tracking y medida

| escala | tight | normal | loose |
|---|---|---|---|
| `--line-height--display-*` | 1 | 1.1 | 1.2 |
| `--line-height--heading-*` | 1.15 | 1.25 | 1.35 |
| `--line-height--body-*` | 1.2 | 1.4 | 1.6 |
| `--letter-spacing--display-*` | −0.03em | 0 | 0.03em |
| `--letter-spacing--heading-*` | −0.03em | 0 | 0.03em |
| `--letter-spacing--body-*` | −0.03em | 0 | 0.03em |

`--letter-spacing-sm: 0.06em` (etiquetas en mayúsculas, eyebrows).

Medida (ancho máximo de línea):

```
--max-width--body-normal: 32.5em     --max-width--heading-normal: 32.5em    --max-width--display-normal: 13em
--max-width--body-narrow: 22.75em    --max-width--heading-narrow: 19.5em    --max-width--display-narrow: 9.75em
                                                                             --max-width--display-tight:  3.25em
```

---

## 4. Espaciado

### 4.1 Escalas

Tres escalas con los mismos nombres y valores casi idénticos (`rem`, base 16 px):

| paso | `--margin-*` | `--padding-*` | `--gap-*` |
|---|---|---|---|
| 3xs | 0.125 (2) | 0.125 (2) | 0.125 (2) |
| 2xs | 0.3 (4.8) | 0.25 (4) | 0.3 (4.8) |
| xs | 0.5 (8) | 0.5 (8) | 0.5 (8) |
| sm | 0.7 (11.2) | 0.7 (11.2) | 0.7 (11.2) |
| md | 0.8 (12.8) | 0.8 (12.8) | 0.9 (14.4) |
| lg | 1 (16) | 1 (16) | 1 (16) |
| xl | 1.25 (20) | 1.25 (20) | 1.25 (20) |
| 2xl | 1.5 (24) | 1.5 (24) | 2 (32) |
| 3xl | — | 1.75 (28) | 3 (48) |
| 4xl | 2 (32) | 2 (32) | — |
| 5xl | — | 3 (48) | — |
| 6xl | 5 (80) | 4 (64) | — |

> Las secciones de la home usan `--gap-6xl` como separación título → contenido con reserva de `4rem`: la variable **no existe** (la escala de gap termina en 3xl), así que siempre aplica la reserva. Si se añade `--gap-6xl` al tema hay que hacerlo con 4rem para no mover nada.

### 4.2 Padding de sección y escala responsive

Los paddings de sección (`padding-block-start / end`, y en el carrusel de colecciones también los horizontales) se emiten por `snippets/spacing-style.liquid`:

- ≤ 20 px → tal cual;
- \> 20 px → `max(20px, calc(var(--spacing-scale) × valor))`.

```
--spacing-scale-default: 1.0   (≥ 990 px)
--spacing-scale-md:      0.7   (< 990 px)
```

Un padding de 80 px en escritorio son 56 px en tablet y móvil sin ajuste extra.

### 4.3 Componentes

```
--button-padding-inline: 24px       --input-padding-y / -x: 0.8rem
--button-padding-block: 10px        --input-textarea-min-height: 55px
--button-size-md: 36px              --checkbox-label-padding: 8px (6px ≥ 750)
--checkout-button-gap: 10px         --drawer-padding: calc(var(--padding-sm) + 7px)
--badge-rectangle-padding: 1px 6px  (4px 10px ≥ 750)
```

---

## 5. Layout y breakpoints

### 5.1 Anchos de página

La tienda usa `page_width: narrow`.

| token | valor |
|---|---|
| `--narrow-page-width` | 90rem (1440) ← **activo** |
| `--normal-page-width` | 120rem (1920) |
| `--wide-page-width` | 150rem (2400) |
| `--normal-content-width` | 42rem (672) — plantilla `page-width-content` |
| `--narrow-content-width` | 36rem (576) |
| `--page-margin` | **16px** < 750 · **40px** ≥ 750 |
| `--page-width` | `--page-content-width + 2 × --page-margin` |
| `--sidebar-width` | 25rem |
| `--theme-drawer-width` | 30rem |

Tope adicional de la home: los carruseles adaptativos (*Featured collection*, *Collection carousel*) se contienen a **1360 px** (`--adaptive-max-width`, ajuste `max_width`), independiente del ancho de página.

### 5.2 Breakpoints

| px | uso |
|---|---|
| **749 / 750** | móvil ↔ escritorio. Es el corte de casi todo: presets `*_mobile`, columnas, `--page-margin`, badges, checkbox |
| **990** | `--spacing-scale` 0.7 → 1; segunda fila del header |
| 1200 | algunos `max-width` de base.css |
| 1400 | escalón alto puntual |
| 40em / 60em | alturas de sección (`--section-height-*`) |

Las secciones de la home preguntan por `max-width: 749px` para la variante móvil; los carruseles lo hacen con **container queries** (`@container resource-list-carousel (min-width: 750px)`) sobre el ancho del carrusel, no del viewport.

### 5.3 Alturas de sección

| token | < 40em | ≥ 40em | ≥ 60em |
|---|---|---|---|
| `--section-height-small` | 15rem | 40svh | 50svh |
| `--section-height-medium` | 25rem | 55svh | 65svh |
| `--section-height-large` | 35rem | 70svh | 80svh |

---

## 6. Bordes, radios y formas

Fijos:

```
--style-border-width: 1px              --style-border-radius-xs: 0.2rem
--border-width-sm: 1px                 --style-border-radius-sm: 0.6rem
--border-radius-sm: 0.25rem            --style-border-radius-md: 0.8rem
--border-color: foreground al 50 %     --style-border-radius-lg: 1rem
                                       --style-border-radius-50: 50%
```

Configurados en la tienda (`settings_data.json`):

| componente | radio | borde |
|---|---|---|
| botón primario | **0** (`button_border_radius_primary`) | **0** (`primary_button_border_width`) |
| botón secundario | **0** | **1px** |
| inputs | **4px** | **1px** |
| pills | **0** | — |
| popover | **14px** | 0 |
| tarjeta de producto | `card_corner_radius` **4px** · imagen `product_corner_radius` **0** | — |
| badges | **0** · texto en **uppercase** · posición top-left | — |
| swatch de variante | **34 × 34 px**, radio **32** (círculo) | 1px solid, opacidad 10 % |
| botón de variante | radio **0**, borde **1px**, ancho igual entre botones | — |
| checkbox | 22px / radio 7px (16px / 5px ≥ 750) | 1px, `foreground` al 35–55 % |

Logo: **70 px** de alto en escritorio, **36 px** en móvil. `logo` = `ona_logo_dark.svg`, `logo_inverse` = `ona_logo_white.svg` (header transparente).

---

## 7. Sombras y gradientes

```
--shadow-button:  0 2px 3px rgb(0 0 0 / 20%)
--shadow-popover: 0 4px 20px rgb(popover_shadow_color / 0.15)      (popover_drop_shadow: on)
--shadow-drawer:  0 4px 20px rgb(drawer_shadow_color / 0.15)       (drawer_drop_shadow: off)
--gradient-image-overlay: linear-gradient(to top, rgb(0 0 0 / 0.5), transparent)
--focus-outline-width: 0.09375rem   --focus-outline-offset: 0.2em
```

Gradiente del wordmark de *Product introduction* (a mano en la sección): `#D9A441 → #B8862B → #F3DDA0`.

---

## 8. Motion

```
--animation-speed-fast:   0.0625s        --ease-out-cubic:  cubic-bezier(0.33, 1, 0.68, 1)
--animation-speed:        0.125s         --ease-out-quad:   cubic-bezier(0.32, 0.72, 0, 1)
--animation-speed-medium: 0.15s          --animation-easing: ease-in-out
--animation-speed-slow:   0.2s           --animation-timing-hover:    cubic-bezier(0.25, 0.46, 0.45, 0.94)
--drawer-animation-speed: 0.2s           --animation-timing-active:   cubic-bezier(0.5, 0, 0.75, 0)
                                         --animation-timing-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1)
                                         --animation-timing-default:  cubic-bezier(0, 0, 0.2, 1)
                                         --animation-timing-fade-in:  cubic-bezier(0.16, 1, 0.3, 1)
                                         --animation-timing-fade-out: cubic-bezier(0.4, 0, 0.2, 1)
```

Springs (curvas `linear()` precalculadas; sufijo = duración percibida en ms y rebote en %):

| token | duración real |
|---|---|
| `--spring-d300-b0` | 0.498s |
| `--spring-d280-b0` | 0.465s |
| `--spring-d220-b0` | 0.382s |
| `--spring-d180-b0` | 0.299s |

Las transiciones de página están **apagadas** (`page_transition_enabled: false`). El hero tiene su propia animación de entrada escalonada (título → descripción → botones), definida en la sección.

---

## 9. Capas (z-index)

```
--layer-section-background: -2    --layer-sticky:          8
--layer-lowest:             -1    --layer-window-overlay: 10
--layer-base:                0    --layer-header-menu:    12
--layer-flat:                1    --layer-overlay:        16
--layer-raised:              2    --layer-menu-drawer:    18
--layer-heightened:          4    --layer-temporary:      20
```

---

## 10. Iconos y objetivos táctiles

```
--icon-size-2xs: 0.6rem   --icon-size-sm: 1.25rem   --icon-size-lg: 1.5rem
--icon-size-xs: 0.85rem   --icon-size-md: 1.375rem
--icon-stroke-width: 1.5px      (icon_stroke: default; thin = 1px, heavy = 2px)
--minimum-touch-target: 44px    --disabled-opacity: 0.5    --skeleton-opacity: 0.025
```

Header: iconos a **27 px** (`header_icon_size`), enlaces rápidos a **16 px** (`quick_link_font_size`).

---

## 11. Semilla de archivo de tokens (formato W3C DTCG)

Los tokens primitivos y los semánticos principales, listos para Style Dictionary / Tokens Studio. Los alias apuntan a los primitivos, igual que hace el tema.

```json
{
  "color": {
    "palette": {
      "background": { "$type": "color", "$value": "#F4F3E9" },
      "foreground": { "$type": "color", "$value": "#470A12" },
      "color1":     { "$type": "color", "$value": "#751132" },
      "color2":     { "$type": "color", "$value": "#D67BA6" },
      "color3":     { "$type": "color", "$value": "#762D0D" }
    },
    "page": {
      "background": { "$type": "color", "$value": "{color.palette.background}" },
      "text":       { "$type": "color", "$value": "{color.palette.foreground}" },
      "border":     { "$type": "color", "$value": "{color.palette.foreground}" }
    },
    "button": {
      "primary":   { "background": { "$type": "color", "$value": "{color.palette.foreground}" },
                     "text":       { "$type": "color", "$value": "{color.palette.background}" },
                     "border":     { "$type": "color", "$value": "{color.palette.background}" } },
      "secondary": { "background": { "$type": "color", "$value": "{color.palette.background}" },
                     "text":       { "$type": "color", "$value": "{color.palette.foreground}" },
                     "border":     { "$type": "color", "$value": "{color.palette.foreground}" } }
    },
    "input":   { "background": { "$type": "color", "$value": "{color.palette.background}" },
                 "text":       { "$type": "color", "$value": "{color.palette.foreground}" },
                 "border":     { "$type": "color", "$value": "{color.palette.color3}" } },
    "variant": { "border":          { "$type": "color", "$value": "{color.palette.color3}" },
                 "selectedBackground": { "$type": "color", "$value": "{color.palette.foreground}" } },
    "badge":   { "soldOutBackground": { "$type": "color", "$value": "{color.palette.color2}" },
                 "saleBackground":    { "$type": "color", "$value": "{color.palette.foreground}" } },
    "status":  { "error":      { "$type": "color", "$value": "#8B0000" },
                 "success":    { "$type": "color", "$value": "#006400" },
                 "inStock":    { "$type": "color", "$value": "#3ED660" },
                 "lowStock":   { "$type": "color", "$value": "#EE9441" },
                 "outOfStock": { "$type": "color", "$value": "#C8C8C8" } }
  },
  "font": {
    "family": {
      "display": { "$type": "fontFamily", "$value": ["Silk Serif", "Georgia", "Times New Roman", "serif"] },
      "text":    { "$type": "fontFamily", "$value": ["Karla", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"] }
    },
    "weight": { "regular": { "$type": "fontWeight", "$value": 400 },
                "medium":  { "$type": "fontWeight", "$value": 500 },
                "bold":    { "$type": "fontWeight", "$value": 700 } },
    "size": {
      "3xs": { "$type": "dimension", "$value": "0.625rem" },
      "2xs": { "$type": "dimension", "$value": "0.75rem" },
      "xs":  { "$type": "dimension", "$value": "0.8125rem" },
      "sm":  { "$type": "dimension", "$value": "0.875rem" },
      "md":  { "$type": "dimension", "$value": "1rem" },
      "lg":  { "$type": "dimension", "$value": "1.125rem" },
      "xl":  { "$type": "dimension", "$value": "1.25rem" },
      "2xl": { "$type": "dimension", "$value": "1.5rem" },
      "3xl": { "$type": "dimension", "$value": "2rem" },
      "4xl": { "$type": "dimension", "$value": "2.5rem" },
      "5xl": { "$type": "dimension", "$value": "3rem" },
      "6xl": { "$type": "dimension", "$value": "3.5rem" }
    },
    "lineHeight": {
      "display": { "tight": { "$type": "number", "$value": 1 },    "normal": { "$type": "number", "$value": 1.1 },  "loose": { "$type": "number", "$value": 1.2 } },
      "heading": { "tight": { "$type": "number", "$value": 1.15 }, "normal": { "$type": "number", "$value": 1.25 }, "loose": { "$type": "number", "$value": 1.35 } },
      "body":    { "tight": { "$type": "number", "$value": 1.2 },  "normal": { "$type": "number", "$value": 1.4 },  "loose": { "$type": "number", "$value": 1.6 } }
    },
    "letterSpacing": { "tight": { "$type": "dimension", "$value": "-0.03em" },
                       "normal": { "$type": "dimension", "$value": "0em" },
                       "loose": { "$type": "dimension", "$value": "0.03em" },
                       "label": { "$type": "dimension", "$value": "0.06em" } }
  },
  "typography": {
    "h1": { "$type": "typography", "$value": { "fontFamily": "{font.family.display}", "fontWeight": "{font.weight.regular}", "fontSize": "clamp(3rem, 5.6vw, 3.5rem)", "lineHeight": "{font.lineHeight.display.tight}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "h2": { "$type": "typography", "$value": { "fontFamily": "{font.family.display}", "fontWeight": "{font.weight.regular}", "fontSize": "clamp(2.25rem, 4.8vw, 3rem)", "lineHeight": "{font.lineHeight.display.tight}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "h3": { "$type": "typography", "$value": { "fontFamily": "{font.family.display}", "fontWeight": "{font.weight.regular}", "fontSize": "{font.size.3xl}", "lineHeight": "{font.lineHeight.display.normal}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "h4": { "$type": "typography", "$value": { "fontFamily": "{font.family.display}", "fontWeight": "{font.weight.regular}", "fontSize": "{font.size.2xl}", "lineHeight": "{font.lineHeight.display.tight}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "h5": { "$type": "typography", "$value": { "fontFamily": "{font.family.text}", "fontWeight": "{font.weight.regular}", "fontSize": "{font.size.sm}", "lineHeight": "{font.lineHeight.display.loose}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "h6": { "$type": "typography", "$value": { "fontFamily": "{font.family.text}", "fontWeight": "{font.weight.regular}", "fontSize": "{font.size.2xs}", "lineHeight": "{font.lineHeight.display.loose}", "letterSpacing": "{font.letterSpacing.normal}" } },
    "paragraph": { "$type": "typography", "$value": { "fontFamily": "{font.family.text}", "fontWeight": "{font.weight.regular}", "fontSize": "{font.size.sm}", "lineHeight": "{font.lineHeight.body.loose}" } }
  },
  "space": {
    "3xs": { "$type": "dimension", "$value": "0.125rem" },
    "2xs": { "$type": "dimension", "$value": "0.25rem" },
    "xs":  { "$type": "dimension", "$value": "0.5rem" },
    "sm":  { "$type": "dimension", "$value": "0.7rem" },
    "md":  { "$type": "dimension", "$value": "0.8rem" },
    "lg":  { "$type": "dimension", "$value": "1rem" },
    "xl":  { "$type": "dimension", "$value": "1.25rem" },
    "2xl": { "$type": "dimension", "$value": "1.5rem" },
    "3xl": { "$type": "dimension", "$value": "1.75rem" },
    "4xl": { "$type": "dimension", "$value": "2rem" },
    "5xl": { "$type": "dimension", "$value": "3rem" },
    "6xl": { "$type": "dimension", "$value": "4rem" }
  },
  "layout": {
    "pageMargin": { "mobile": { "$type": "dimension", "$value": "16px" }, "desktop": { "$type": "dimension", "$value": "40px" } },
    "pageWidth":  { "narrow": { "$type": "dimension", "$value": "90rem" }, "normal": { "$type": "dimension", "$value": "120rem" }, "wide": { "$type": "dimension", "$value": "150rem" } },
    "carouselMaxWidth": { "$type": "dimension", "$value": "1360px" },
    "breakpoint": { "md": { "$type": "dimension", "$value": "750px" }, "lg": { "$type": "dimension", "$value": "990px" } },
    "spacingScale": { "mobile": { "$type": "number", "$value": 0.7 }, "desktop": { "$type": "number", "$value": 1 } }
  },
  "radius": {
    "none": { "$type": "dimension", "$value": "0" },
    "xs":   { "$type": "dimension", "$value": "0.2rem" },
    "sm":   { "$type": "dimension", "$value": "0.6rem" },
    "md":   { "$type": "dimension", "$value": "0.8rem" },
    "lg":   { "$type": "dimension", "$value": "1rem" },
    "full": { "$type": "dimension", "$value": "50%" },
    "button": { "$type": "dimension", "$value": "0" },
    "input":  { "$type": "dimension", "$value": "4px" },
    "card":   { "$type": "dimension", "$value": "4px" },
    "popover": { "$type": "dimension", "$value": "14px" }
  },
  "border": { "width": { "sm": { "$type": "dimension", "$value": "1px" } } },
  "shadow": {
    "button":  { "$type": "shadow", "$value": { "offsetX": "0", "offsetY": "2px", "blur": "3px", "color": "rgb(0 0 0 / 0.2)" } },
    "popover": { "$type": "shadow", "$value": { "offsetX": "0", "offsetY": "4px", "blur": "20px", "color": "rgb(71 10 18 / 0.15)" } }
  },
  "motion": {
    "duration": { "fast": { "$type": "duration", "$value": "62.5ms" }, "base": { "$type": "duration", "$value": "125ms" },
                  "medium": { "$type": "duration", "$value": "150ms" }, "slow": { "$type": "duration", "$value": "200ms" } },
    "easing": { "default": { "$type": "cubicBezier", "$value": [0, 0, 0.2, 1] },
                "hover":   { "$type": "cubicBezier", "$value": [0.25, 0.46, 0.45, 0.94] },
                "bounce":  { "$type": "cubicBezier", "$value": [0.34, 1.56, 0.64, 1] },
                "outCubic": { "$type": "cubicBezier", "$value": [0.33, 1, 0.68, 1] } }
  },
  "opacity": {
    "muted": { "$type": "number", "$value": 0.6 }, "subdued": { "$type": "number", "$value": 0.8 },
    "disabled": { "$type": "number", "$value": 0.5 }, "backdrop": { "$type": "number", "$value": 0.15 }
  }
}
```

---

## 12. Cómo mantener este documento

- **Paleta o escala tipográfica**: cambian en el editor de temas → `settings_data.json`. Este documento se actualiza a mano; los valores de §2.1 y §3.2 se comprueban contra `current` de ese archivo.
- **Escalas fijas** (§4, §6, §8, §9): viven en `snippets/theme-styles-variables.liquid`. Si se toca una, se toca aquí.
- **Colores de sección** (§2.4): cada vez que una sección nueva traiga un color por defecto, o entra en la paleta o se lista aquí. El objetivo es que esa tabla se vacíe.
- Para regenerar el inventario de colores en uso:

```bash
grep -rhoi "#[0-9a-f]\{6\}\b" sections blocks snippets | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn
```
