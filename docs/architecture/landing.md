# Landing page architecture

Phase 2 of Gixxer.ai. Written for engineers working on this codebase.

## Shape

One route, `app/page.tsx`, a server component that reads the session and renders
`components/landing/landing-page.tsx`. The page is public: signed-in visitors see the same
content with every call to action pointed at their workspace instead of the sign-up form.

Nine blocks, in order: navigation, hero, workspace showcase (a laptop mockup of the app),
capabilities (a full-screen robot stage with a live demo of each capability and an integrations rail), the Chatbot
Pro setup guide, knowledge and memory, FAQ, final call to action, footer. A credibility strip
sits after the hero in the code but currently renders nothing. Each block lives in its own
file under `components/landing/sections/`; `landing-page.tsx` only decides the order.

All copy lives in `lib/landing/content.ts`. Components handle layout and motion; they do not
hold sentences. Changing a headline never means opening a component. Every figure in the
copy is a property of the product (three providers, six file formats, one script tag). There
are no invented customer counts, latency claims or uptime numbers, and the sample data inside
mockups is labelled as a preview in the interface.

```
components/landing/
  landing-page.tsx      Order of the sections, skip link, landmarks
  landing-nav.tsx       Floating capsule nav, reading progress, active section, mobile sheet
  landing-footer.tsx    Columns, theme toggle, outlined wordmark watermark
  hero/                 Server-rendered copy, WebGL dot field, static dot fallback
  sections/             One file per section
  primitives/           The shared vocabulary every section is built from
```

## The visual system

Two colours and the greys between them. Dark mode runs from glossy black `#030000` to white;
light mode runs the same ramp the other way. Tokens are semantic (`ink-950` is always the
furthest back, `ink-50` always the furthest forward), so every component works in both
themes without a `dark:` utility. The one deliberate inversion is the numbers section, which
uses the ramp backwards to become the page's contrast beat.

Type is three faces with three jobs. Geist carries everything readable. Instrument Serif
italic finishes each headline with one phrase, never body copy (`accent-serif`). Exo 2 is the
wordmark and nothing else.

"Glossy" is a small set of utilities in `globals.css`, all theme-aware through custom
properties: `plate` (a surface with a specular top edge), `glass` (backdrop blur, used
sparingly because the blur is not free), `edge-lit` (a hairline that brightens toward the
light), `light-beam`, `grain`, `spotlight` (cursor-following highlight, fed by
`useSpotlight`) and `btn-sheen` (the highlight that sweeps a button on hover).

## Primitives

| Primitive | What it is for |
| --- | --- |
| `SectionHeading` | Numbered eyebrow, headline with serif accent, one line of context. Sections differ in what follows, never in this. |
| `Reveal`, `RevealGroup`, `RevealItem` | Enter once on scroll. Opacity and a short rise only: no blur filter, which is the most expensive thing a landing page can do to a mid-range phone. |
| `Magnetic` | Pointer-following pull on the primary buttons. Off on touch devices and under reduced motion. |
| `Sparkline` | Single-series line with a hover crosshair, monochrome, 2px, latest point marked. |
| `Chip`, `Caret` | Small vocabulary. |

## Which animation library, and why

Three are in play, each doing the one thing it is best at.

| Tool | Used for | Why not the others |
| --- | --- | --- |
| CSS | The hero entrance and hover effects | It runs at first paint, with no JavaScript. This is the whole reason Largest Contentful Paint is fast. |
| Motion | Reveals on scroll, tab and persona switches, layout-animated highlights, accordions, the mobile menu | Declarative enter and exit, `AnimatePresence` for elements that leave, `layoutId` for a highlight that slides between options. |
| GSAP ScrollTrigger | Scrubbed, scroll-linked effects: the hero parallax, the settling laptop, the growing CTA headline | Motion has no good equivalent for tying a tween to scroll position with a scrub, or for pinning. |
| React Three Fiber | The hero visual | A particle field belongs on the GPU. |

`lib/motion/gsap.ts` scopes every GSAP effect to an element with `gsap.context` and reverts
it on unmount, including ScrollTriggers. A setup may return its own cleanup for anything
GSAP does not track, such as a `matchMedia` or an event listener.

### The hero entrance is CSS on purpose

An earlier version animated the hero copy with Motion. Because `initial: { opacity: 0 }`
hides the text until hydration runs, the headline is the largest element on the page, and
Largest Contentful Paint measured over three seconds on desktop. Moving the same entrance to
a CSS keyframe (`--animate-rise` in `globals.css`) put the text in the server HTML and started
the animation at first paint.

The rule that follows: never gate above-the-fold content behind a JavaScript animation. Use
Motion below the fold, where the element is not the LCP candidate.

### No animation loops

Nothing on the page animates on a timer or an infinite keyframe except the hero's dot field,
and that stops whenever the hero is off screen or the tab is hidden. Every other animation is
one of three kinds: a one-time entrance when something scrolls into view, a scroll-scrubbed
tween (which costs nothing while the page is still), or a response to the visitor (hover,
click, typing). The workspace laptop tours its four views once and then rests; the Chatbot
Pro guide only moves when the visitor clicks. GSAP work is scoped with `gsap.context` and
reverted on unmount, and the Three.js geometries are disposed explicitly.

## The hero visual

`hero/hero-visual.tsx` decides what to render and `hero/hero-scene.tsx` holds the Three.js scene.

The scene is one cloud of 12,000 points (6,000 on small or low-core devices) that keeps
re-forming out of dots and nothing but dots: a Fibonacci sphere, the word "Gixxer", a
rippling sheet, the surface of a torus, and a cube. There are no rings, threads or spirals.
The word is sampled at start-up from an offscreen canvas drawn in the wordmark face (Exo 2
heavy italic), so it always matches the brand; while it is on screen the cloud stops
spinning, faces the camera and calms its noise so the letters read cleanly. Every point carries
all four positions as vertex attributes and the shader interpolates between them, so a morph
costs the same as standing still. Two octaves of simplex noise loosen the cloud mid-morph and
settle it as it arrives. Per frame the CPU writes a handful of uniforms and lerps two
rotations; everything else is on the GPU. A sparse dust shell completes it.

Four gates decide whether it runs at all, in `lib/motion/capabilities.ts`:

- reduced motion or reduced data requested
- two or fewer logical cores, or under 2 GB of device memory
- no WebGL context available, or a software rasteriser (SwiftShader, llvmpipe)
- the browser has not reached an idle moment yet

If any gate fails, `hero/hero-static.tsx` renders instead: a sphere of dots in plain CSS.
It is not a grey box. It is a finished image that happens to cost nothing, and it
is also what shows during the moment before the scene's first frame.

Once running, the scene still stops itself. An `IntersectionObserver` and a
`visibilitychange` listener drive R3F's `frameloop`, so scrolling past the hero or switching
tabs halts rendering rather than burning battery on an invisible canvas. A GSAP scrub drifts
the whole visual upward and fades it as the next section arrives.

Three.js and React Three Fiber are a `next/dynamic` import with `ssr: false`, a separate
chunk that loads after `load`. A visitor who never qualifies for the scene never downloads it.

## Reduced motion

Handled in three layers, because the three tools need different treatment.

1. **CSS**: the `prefers-reduced-motion` block in `globals.css` collapses every animation and
   transition to 0.01 ms and disables smooth scrolling.
2. **Motion**: `components/motion-provider.tsx` wraps the app in `MotionConfig reducedMotion="user"`.
   Transform and layout animations become instant while opacity still fades, which is what
   WCAG asks for.
3. **Content that differs**: some demos are a sequence rather than a decoration, such as the
   typewriters, the failover timelines and the phase-driven security walkthrough. These read
   the preference through `lib/motion/use-prefers-reduced-motion.ts` and render their
   **final state immediately**, so a visitor who opted out of motion still sees the whole
   message.

That last hook uses `useSyncExternalStore` with a server snapshot of `false`. Motion's own
`useReducedMotion` reads the media query during the first client render, which does not
match the server and threw React hydration error #418 in production. The rule: anything
that changes rendered markup based on a device preference must go through
`useSyncExternalStore`, never a direct media-query read. `lib/motion/use-media-query.ts`
generalises it for hover capability.

## Interactivity that stays honest

Every interactive demo does what the product does, with canned data and no network:

- the workspace laptop is a real tablist with roving focus,
- the capability tiles each show a real piece of the product, playing once as they arrive,
- the Chatbot Pro guide walks through the dashboard's real order (settings, knowledge,
  test and go live, embed), carries the visitor's bot name through every step, and shows
  the per-platform install instructions and how the widget looks on a site.

Decorative pieces (the dot field, the laptop chrome, the assistant panel) are `aria-hidden` and
never carry information that is not also readable elsewhere on the page.

## Integrations, honestly

The capabilities stage shows two groups of brand marks. WordPress, Shopify and Webflow are
places the Chatbot Pro widget embeds today. Slack, Google Calendar, Cloudflare and n8n are
labelled as coming with Plugins, because the Plugins area is not built yet. The marks are
monochrome paths from Simple Icons (CC0) in `primitives/brand-marks.tsx`; the Slack mark
comes from simple-icons 13.21.0, the last release that shipped it. The robot portraits in
`public/` were generated with Hugging Face FLUX.1-schnell, the model Gixxer itself uses.

## Constraints worth keeping

**The Content Security Policy still applies.** Every script is bundled and served from the
same origin with the request nonce. Fonts are self-hosted through `next/font`. Nothing here
loads a third-party script, nothing uses `eval`, and the only `data:` URLs are inline SVG
noise textures, which `img-src` already allows.

**Pages render per request.** The nonce needs a request, so `connection()` in the root layout
keeps the landing page dynamic. If it ever matters, the tradeoff to revisit is nonce-based
CSP, not the page.

**Nothing on this page is wired to a backend.** The mockups are pictures of the product that
move. They are marked `aria-hidden` where they are decorative, and the showcases carry a
visible "Preview" badge so nobody mistakes them for a live console.

**Performance is asserted, not hoped for.** An end-to-end test asserts no main-thread task
exceeds 500 ms while scrolling the page, so a future change that blocks scrolling fails the
build rather than shipping. `tests/e2e/landing.spec.ts` also checks horizontal overflow,
reduced motion, the hero decision, every section's presence and every interactive demo.
