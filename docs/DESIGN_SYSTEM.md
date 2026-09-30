# Design system

The implementation is `src/app.css`. This document explains the intent behind it.
Change one without the other and they drift — don't.

## Philosophy

**Dark-first.** There is exactly one theme. Tokens are declared once on `:root`,
`<html>` permanently carries the `dark` class (so the `dark:` variants inside
shadcn-svelte primitives resolve), and `color-scheme: dark` is set. There is no
light theme and no theme toggle. Adding one is a product decision, not a
refactor.

**The skin is the hero.** Skin images carry the visual weight of this product. The
interface around them stays restrained: flat surfaces, thin borders, one accent
colour. If a screen feels busy before any skin image is on it, the chrome is wrong.

The target feeling is _dark marketplace intelligence interface_: premium, dense but
readable, technical, modern, clean, data-oriented. Explicitly **not**: gamer,
cyberpunk, neon-soaked, glassmorphic, gradient-heavy.

## Palette

### Base

| Token                          | Value     | Use                               |
| ------------------------------ | --------- | --------------------------------- |
| `background`                   | `#080A0D` | Page background                   |
| `surface` / `card`             | `#0F1217` | Cards, panels, primary containers |
| `surface-elevated` / `popover` | `#151922` | Popovers, dropdowns, raised rows  |
| `surface-hover` / `accent`     | `#1B2029` | Hover and pressed states          |
| `border` / `input`             | `#222833` | All separation                    |
| `foreground`                   | `#F5F7FA` | Primary text                      |
| `muted-foreground`             | `#8D96A5` | Secondary text, labels            |
| `subtle-foreground`            | `#626C7A` | Tertiary text, captions, disabled |

Surfaces are separated by **tone and border**, never by shadow stacks or blur.

### Brand — amber

| Token                | Value     |
| -------------------- | --------- |
| `primary`            | `#F59E0B` |
| `primary-hover`      | `#FBBF24` |
| `primary-active`     | `#D97706` |
| `primary-subtle`     | `#2A1D07` |
| `primary-foreground` | `#080A0D` |

Amber means: primary actions, active navigation, selected state, key highlights,
brand identity.

**Amber never means money saved.** A cheaper price, a discount, a positive delta —
those are success green. Keeping the two semantically separate is the single most
important colour rule in this product.

### Semantic

| Role      | Colour    | Subtle background | Meaning                                      |
| --------- | --------- | ----------------- | -------------------------------------------- |
| `success` | `#22C55E` | `#082C16`         | Savings, best price, positive difference     |
| `warning` | `#EAB308` | `#2B2205`         | Stale data, caution                          |
| `danger`  | `#EF4444` | `#2C0F0F`         | Errors, destructive actions, price increases |
| `info`    | `#3B82F6` | `#0B1E3B`         | Neutral information                          |

`destructive` (the shadcn role) is aliased to `danger` so there is only one red.

Warning yellow and brand amber are close in hue by design constraint — never place
them adjacent as the only difference between two states. Pair colour with an icon or
a label, always (see Accessibility).

### CS2 rarity

| Rarity     | Token               | Value     |
| ---------- | ------------------- | --------- |
| Consumer   | `rarity-consumer`   | `#B0C3D9` |
| Industrial | `rarity-industrial` | `#5E98D9` |
| Mil-Spec   | `rarity-mil-spec`   | `#4B69FF` |
| Restricted | `rarity-restricted` | `#8847FF` |
| Classified | `rarity-classified` | `#D32CE6` |
| Covert     | `rarity-covert`     | `#EB4B4B` |
| Contraband | `rarity-contraband` | `#E4AE39` |

These are Valve's rarity colours and are not ours to redesign. They are reference
data rendered as a token, used for small accents — a rail, a dot, a thin border —
never as a large surface fill. Rarity must always be readable as text too, because
Covert red and danger red are close enough to confuse.

## Typography

| Role                    | Family                      | Loaded via                            |
| ----------------------- | --------------------------- | ------------------------------------- |
| Interface (`font-sans`) | **Inter Variable**          | `@fontsource-variable/inter`          |
| Data (`font-mono`)      | **JetBrains Mono Variable** | `@fontsource-variable/jetbrains-mono` |

Both are self-hosted through Fontsource — no runtime Google Fonts request.

Inter is the default on `html`. JetBrains Mono is for **numeric market data**:
prices, price deltas, percentages, floats, pattern indexes, timestamps, quantities.
Pair it with `tabular-nums` so columns of prices align.

No decorative or gaming display font, anywhere.

## Spacing

Tailwind's default scale. Dense but breathable: tight inside a card (`gap-2`/`gap-3`),
generous between sections (`gap-8`+). Prefer `gap` on a flex/grid parent over margins
on children.

## Radius

Base `--radius: 0.75rem` (12px).

| Token         | Size | Use                          |
| ------------- | ---- | ---------------------------- |
| `rounded-sm`  | 6px  | Chips, tight badges          |
| `rounded-md`  | 8px  | Inputs, small buttons        |
| `rounded-lg`  | 12px | **Cards, panels**            |
| `rounded-xl`  | 16px | Large cards, sheets, dialogs |
| `rounded-2xl` | 24px | Hero surfaces                |

Cards land in the 10–14px band, i.e. `rounded-lg`.

## Borders and shadows

- Borders: 1px, `border` token, and they do most of the separation work.
- Shadows: restrained. A card does not need one; a floating layer (popover, dropdown,
  dialog) may have a soft one. Never a glow.
- No large backdrop blur, no glassmorphism, no decorative gradients. A gradient is
  acceptable only as a functional image scrim.

## Motion

CSS transitions, Tailwind utilities and Svelte transitions handle hover, focus,
fade, dropdowns, modals and simple scale — that is the default, and it covers most
of the product.

**GSAP is reserved for** complex multi-step sequences, hero animation, loadout
composition animation, advanced page transitions, scroll-linked animation and
meaningful visual storytelling.

**GSAP is never for** a hover, an opacity fade, a dropdown, a basic modal, a simple
scale, or a button effect.

GSAP is not initialised globally, is never imported at module scope in SSR-reachable
code, and must check `prefers-reduced-motion` before running. `src/app.css` already
neutralises CSS animation for reduced-motion users; a JS timeline has to opt in
itself.

## Accessibility

- Colour is never the only carrier of meaning. A best-price badge is green **and**
  says "best price". A rarity is a colour **and** a name.
- Every interactive control has a visible focus state. The `ring` token is amber.
- Contrast: `foreground` on `background` and on `surface` clears WCAG AA. Check
  `subtle-foreground` before using it below 14px.
- Semantic HTML always. A `div` is never a button.
- Icon-only controls carry an accessible label.
- Respect `prefers-reduced-motion`.

## Responsive

UX categories (these map onto Tailwind's defaults — do not invent custom
breakpoints):

| Category | Width        | Tailwind |
| -------- | ------------ | -------- |
| Mobile   | `< 768px`    | base     |
| Tablet   | `768–1023px` | `md:`    |
| Desktop  | `>= 1024px`  | `lg:`    |

Filtering uses a persistent sidebar on desktop and a Sheet on mobile. Grids step
down progressively. Mobile is designed, not degraded.

## Application shell

Concrete conventions the shell settled on. They live in code
(`src/lib/components/layout/`, `src/lib/config/site.ts`) — this records the reasoning.

| Convention           | Value                                           |
| -------------------- | ----------------------------------------------- |
| Max content width    | `--container-app`, 90rem / 1440px (`max-w-app`) |
| Gutters              | 16px → 24px (`sm:`) → 32px (`lg:`)              |
| Header height        | 64px (`h-16`), sticky, `z-40`                   |
| Header surface       | Solid `background` with a single `border-b`     |
| Main vertical rhythm | `py-8` → `py-10` (`sm:`) → `py-12` (`lg:`)      |
| Nav breakpoint       | `md:` — desktop nav at and above, Sheet below   |

**The header is solid, not glass.** No backdrop blur and no shadow: one border
separates it from the content more honestly, and the chrome is supposed to
disappear so the skins can carry the page. (The Sheet's overlay keeps shadcn's 2px
`backdrop-blur-xs`, which is within the "subtle" allowance.)

**Active navigation is a thin amber rule**, not a filled block. Desktop nav items
run the full header height so the indicator sits on the header's own bottom border,
the way a tab strip does; the label lifts from `muted-foreground` to `foreground`.
Mobile uses the vertical equivalent: a 2px amber left border plus a `surface-hover`
background. Brand amber marks _where you are_, at the smallest size that reads.

**Hover is a colour change only** — `muted-foreground` to `foreground`. No scale, no
glow, no underline animation. The shell should never be the most active thing on
screen.

The maximum width is wide enough for a dense price-comparison table and short of the
point where a header's left and right edges stop feeling related to each other.

## Domain components

Conventions the skin and market components settled on. Implementation lives in
`src/lib/components/skin/` and `src/lib/components/market/`.

### The card

Image first, at a fixed **4:3** box on `surface-elevated`, letterboxed with
`object-contain` — a knife and a rifle have very different proportions and cropping
either loses the skin. The artwork takes the top of the card and everything below it
is quiet by comparison: weapon in `muted-foreground` at `text-xs`, finish in
`foreground` at `text-sm`, then wear, then price, then rarity.

`rounded-lg` (12px), one `border`, no shadow. Hover strengthens the border and
nudges the image `scale-[1.02]` — no lift, no glow, no scale on the card itself, and
nothing at all under `prefers-reduced-motion`. The card fills its grid cell rather
than setting a width.

### Prices

Prices are **JetBrains Mono with `tabular-nums`** — they are market data, and a
column of them has to align. Labels ("From", "Best price") are small interface type
in `subtle-foreground`, sentence case, never tracked caps.

Money reaches a component as **integer minor units plus a currency** and is
formatted once by `$lib/formatters/currency`. Formatting is `pt-BR`/BRL
(`R$ 128,28`) even while the interface copy is English: the audience and the
currency are Brazilian, the interface language is a separate decision.

An amount that is not a real offer — zero, negative, fractional — renders
`Price unavailable` instead. Zero is upstream noise, not a deal.

### Best price

**Success green, never brand amber.** Amber is navigation and primary actions; green
is a positive economic outcome, which is exactly what a best price is. Keeping them
apart means green reliably signals money saved everywhere in the product. The badge
is `success-subtle` on `success` text, small, and always carries the words "Best
price" — colour alone would be invisible to anyone who cannot separate it from the
surface.

### Rarity

A 6px dot plus the rarity name, in `muted-foreground`. Small on purpose: rarity is a
signal, not the subject — a purple card would fight the skin for attention and lose.

CS2 uses one colour ladder with different names per item class (a weapon's "Mil-Spec
Grade", an agent's "Distinguished" and a collectible's "High Grade" are the same
blue). `$lib/config/rarity` maps every catalog name onto our seven rarity tokens;
components never read the upstream hex. An unrecognised rarity gets a neutral dot and
still shows its name.

### Wear

Neutral bordered badge, no semantic colour. Wear describes the item, it does not
judge it — styling Battle-Scarred as a warning would say something untrue about a
perfectly good skin.

### Provider rows

Logo, name, market type, price, optional best-price badge. The whole row is a link
when the quote carries a tracked redirect, with a small Lucide `ExternalLink` and an
"(opens in a new tab)" note for screen readers; otherwise it stays informational.
A missing logo falls back to the provider's initial in a fixed box, so rows stay
aligned and nothing is invented.

### Skeletons

The shadcn `Skeleton`, arranged to match the real component's box — same border,
same 4:3 image area, same text heights. A skeleton that does not match its component
trades a blank screen for a jumping one. `animate-pulse` only; the global
reduced-motion rule already neutralises it.

## Future card philosophy

Chrome stays quiet so that a grid of cards reads as a grid of _skins_, not a grid of
boxes. See `docs/COMPONENTS.md` for where those components live.
