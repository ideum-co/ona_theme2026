# Plan — Animaciones modernas para ONA (referente: Onyx Coffee Lab)

Objetivo: hacer el sitio más **moderno y elegante** con movimiento intencional, al nivel de [onyxcoffeelab.com](https://onyxcoffeelab.com/en-int), **sin sacrificar rendimiento** (es una tienda: Core Web Vitals pesan en SEO y conversión). Todo se desarrolla **primero en `staging`**, que hay que **actualizar a `main`** antes de empezar.

---

## 1. Qué hace el referente (Onyx)

Inspeccioné su stack y estilo de movimiento:

- **Librerías:** `ScrollReveal` (reveals al hacer scroll), `anime.js` (micro-animaciones), `Swiper` (carruseles), y un `scroll-ties.js` propio (efectos ligados al scroll / parallax). **No usan GSAP ni Lenis** (sin smooth-scroll). Stack ligero sobre Shopify.
- **Estilo de motion:**
  - Hero con **fondo parallax** (imagen/video fijo) + cue "SCROLL".
  - **Reveals** fade + slide-up al entrar cada sección, a menudo **escalonados** (imagen y luego texto).
  - **Tipografía display** grande como ancla visual (no animada, pero protagonista).
  - **Carruseles** de ofertas/productos (Swiper).
  - **Micro-interacciones** sutiles (hover, contadores, menú) con anime.js.

> Nota de criterio (no copiar el tell): "fade-up en **cada** sección" lee como plantilla. El plan reusa el **vocabulario** de Onyx (reveals, parallax, carruseles) pero lo aplica **selectivo**: un momento hero orquestado + movimiento puntual donde aporta, no en todo.

---

## 2. Qué tenemos hoy (ona_theme2026)

- ✅ **View Transitions API** (`assets/view-transitions.js` + `::view-transition` en base.css) → transiciones de página/sección nativas. Moderno; lo aprovechamos.
- ✅ **`prefers-reduced-motion`** ya respetado en base.css / utilities.js / view-transitions.js.
- ✅ Arquitectura de **web components** (`Component` base, `ona-slider`, `slideshow`) → carruseles ya existen y son accesibles (no necesitamos Swiper).
- ❌ **Ninguna librería de scroll-reveal / scroll-linked.** Las clases `wowo fadeInUp` + `data-wow-delay` en **37 secciones `ona-*`** son **vestigio muerto** del tema viejo (WOW.js no está cargado) → hoy no animan. Hay que reemplazarlas por el sistema nuevo o limpiarlas.

---

## 3. Librería recomendada (enfoque por capas, rendimiento primero)

No una sola librería: un sistema por capas para equilibrar "elegante" con CWV.

| Capa | Qué resuelve | Herramienta | Por qué |
|---|---|---|---|
| **Base (80%)** | Reveals al entrar (fade/clip/slide), stagger, máscaras de imagen | **IntersectionObserver + CSS**, como un web component propio (ej. `reveal-on-scroll`, estilo Horizon) | **Cero dependencias**, mejor CWV, encaja con la arquitectura del tema y reemplaza el `wowo` muerto |
| **Avanzada (puntual)** | Parallax hero, secuencias "pinned"/scrub, timelines orquestadas | **GSAP + ScrollTrigger** (hoy **100% gratis**, incl. plugins), cargada **diferida y solo en páginas que la usan** | Estándar de la industria, robusto y mantenido (ScrollReveal está estancado); da la coreografía "Onyx" sin hand-rolling frágil |
| **Smooth scroll (opcional)** | Sensación "buttery" | **Lenis** (~3KB), **detrás de flag + A/B** | Da el feel moderno, pero el scroll-hijacking puede dañar CWV/accesibilidad; Onyx **no** lo usa → opcional y medido |
| **Carruseles** | Sliders de producto/ofertas | **Los del tema** (`ona-slider`, `slideshow`) | Ya construidos y accesibles; no sumar Swiper |

**Descarto** anime.js (poco mantenido) → GSAP o CSS cubren las micro-animaciones. Todo **gated por `prefers-reduced-motion`** (sin transforms; solo opacidad o nada).

Regla de oro: cada librería JS entra **diferida** y **condicional**. El presupuesto de peso para no tocar el LCP es el criterio de aceptación, no el "wow".

---

## 4. Dirección de movimiento (qué animar, con elegancia)

Gastar la audacia en **un** lugar y mantener el resto disciplinado:

- **Hero (homepage/PDP):** un **momento orquestado de carga** — reveal con máscara/clip de la imagen + tipografía escalonada — y **parallax sutil** del media del hero al hacer scroll. Un solo gran gesto.
- **Reveals editoriales:** **máscara/clip de imagen** (no solo opacity+translate) en secciones clave (no en todas), con stagger imagen→texto. Restraint: si todo revela, nada destaca.
- **Hover de product cards:** escala/parallax leve de la imagen + subrayado "draw" del CTA. Sutil.
- **Scroll-linked:** marquee de marcas (ya lo hicimos en wholesale), **contadores** de números, y **galería sticky con parallax** en PDP (encaja con el fix de scroll que acabamos de hacer).
- **Transiciones de página:** potenciar la **View Transitions API** que ya existe (hoy infrautilizada).
- **Accesibilidad:** `prefers-reduced-motion` desactiva transforms/scrub en todo; foco visible intacto; nada depende solo del movimiento para entenderse.

---

## 5. Plan de ejecución (por fases, todo en `staging` primero)

### Fase 0 — Preparar `staging` *(bloqueante; va primero)*
`staging` está **111 commits detrás de `main`** (`staging-v2`, 63). Antes de animar:
1. **Actualizar `staging` a `main`**: `git checkout staging && git merge origin/main` (o reset si se acepta reescribir), resolver conflictos, push. Quedar `staging == main`.
2. **Conectar el theme de staging** (one-time, pendiente según `docs/branching-and-release.md`): Online Store → Themes → Connect from GitHub → repo `ideum-co/ona_theme2026`, rama **`staging`**, nombrar `ona_theme2026/staging`, **dejar sin publicar**. Queda un **preview URL permanente** para revisar.
3. Desde aquí, **toda** la animación entra por `feat/* → staging` (deploy a main = decisión aparte, cuando el theme de main esté publicado).

> Recordatorio del doc: **merge a `main` = deploy a onacoffee.com.au** en ~5s sin aprobación. Por eso staging existe. No mergear animaciones a main hasta validar en el theme de staging.

### Fase 1 — Fundación de motion *(1 PR a staging)*
- Web component `reveal-on-scroll` (IntersectionObserver + CSS), con tokens de duración/easing/stagger y guard de reduced-motion.
- **Limpiar/reemplazar** las clases `wowo`/`data-wow-*` muertas por el nuevo sistema (o neutralizarlas).
- Utilidades de easing/duración como CSS custom props (un "motion design system").

### Fase 2 — Hero + reveals editoriales *(staging)*
- Momento hero orquestado + parallax hero.
- Reveals con máscara en 3–4 secciones clave del home (no todas).

### Fase 3 — Micro-interacciones *(staging)*
- Hover de cards, draw de CTAs, contadores, marquee.

### Fase 4 — Avanzado selectivo *(staging)*
- GSAP ScrollTrigger (diferido) solo donde haga falta coreografía (p. ej. una sección "pinned" de proceso/origen).
- Evaluar **Lenis** con A/B de CWV; adoptar solo si no daña métricas.

### Fase 5 — QA + promoción
- QA en el preview de staging: Lighthouse/CWV (LCP/CLS/INP), reduced-motion, teclado, móvil.
- Promover a `main` por fases (cada fase su PR a main), cuando el theme de main esté publicado = decisión de deploy.

---

## 6. Guardrails

- **CWV es criterio de aceptación**, no un "nice to have": cada fase se mide (LCP/CLS/INP) antes de promover.
- **JS diferido y condicional**; nada bloquea el render del hero.
- **reduced-motion** respetado en el 100%.
- **Sync-hazard**: al promover a main, confirmar el log de sync con **0 failed** (patrón conocido del repo).
- **No sobre-animar**: antes de cerrar cada fase, "quitar un accesorio" — recortar el movimiento que no aporta.

---

## 7. Siguiente paso inmediato

¿Arranco la **Fase 0** (actualizar `staging` a `main` por PR) y de paso confirmo si el theme de staging ya está conectado? Con eso listo, sigo con la Fase 1 (fundación de motion) en una rama hacia `staging`.
