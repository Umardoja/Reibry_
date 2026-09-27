---
name: Serene Archival Intelligence
colors:
  surface: '#f0fcf8'
  surface-dim: '#d0ddd9'
  surface-bright: '#f0fcf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf6f3'
  surface-container: '#e4f1ed'
  surface-container-high: '#deebe7'
  surface-container-highest: '#d9e5e2'
  on-surface: '#131e1c'
  on-surface-variant: '#3f4946'
  inverse-surface: '#273330'
  inverse-on-surface: '#e7f3f0'
  outline: '#6f7976'
  outline-variant: '#bec9c5'
  surface-tint: '#0e6a5b'
  primary: '#005145'
  on-primary: '#ffffff'
  primary-container: '#0f6b5c'
  on-primary-container: '#99e8d5'
  inverse-primary: '#86d5c3'
  secondary: '#006b5b'
  on-secondary: '#ffffff'
  secondary-container: '#96f0da'
  on-secondary-container: '#00705f'
  tertiary: '#005146'
  on-tertiary: '#ffffff'
  tertiary-container: '#166a5e'
  on-tertiary-container: '#9be7d7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a2f2de'
  primary-fixed-dim: '#86d5c3'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005144'
  secondary-fixed: '#99f3dd'
  secondary-fixed-dim: '#7dd7c1'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005144'
  tertiary-fixed: '#a5f1e1'
  tertiary-fixed-dim: '#89d4c5'
  on-tertiary-fixed: '#00201b'
  on-tertiary-fixed-variant: '#005046'
  background: '#f0fcf8'
  on-background: '#131e1c'
  surface-variant: '#d9e5e2'
typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 3rem
  margin-sm: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies calm intelligence, quiet luxury, and disciplined restraint. Built for an archival AI memory engine, the interface acts as an unobtrusive, high-craft mental sanctuary rather than an overwhelming feed or flashy generative playground.

### Personality & Tone
- **Calm & Discerning:** Free from cognitive clutter, flashing states, or artificial urgency. Everything feels permanent, intentional, and measured.
- **Editorial & Curatorial:** Treats personal memories, thoughts, and documents with gallery-grade elevation and respect.
- **Subtle Precision:** High-craft alignment, typographic sensitivity, and hairline definitions that reward close inspection.

### Target Audience & Emotional Impact
Designed for thinkers, writers, professionals, and lifelong learners who value mental clarity and deep organization. The visual language evokes relief, quiet confidence, and trust—reassuring users that their personal history and contextual thoughts are kept safe in an elegant, structured sanctum.

## Colors

The palette establishes an organic, grounded clarity using rich arboreal teals and soft mint foundations.

### Functional Palette Structure
- **Primary Teal (`#0F6B5C`):** Dedicated to primary action triggers, focal interactive states, and core brand anchors.
- **Deep Forest (`#0B3D35`):** Reserved for high-emphasis editorial titles, critical data readouts, and grounding containers.
- **Secondary Teal (`#167D6B`):** Applied to active toggles, hover states on dark elements, and selected chip indicators.
- **Accent Mint (`#7CC7B8`):** Subtle signal token for memory associations, status indicators, and gentle tag accents.
- **Soft Mint (`#EAF4F1`):** The primary canvas background tint, giving surfaces a soft, glare-reducing parchment feel.
- **Near Black (`#16211F`):** High-legibility neutral for body text, meta annotations, and structural dividing strokes.
- **Pure White (`#FFFFFF`):** Sits cleanly on top of Soft Mint to separate focal memory cards and interactive panels.

### Boundary Definitions
Hairline divisions avoid flat gray borders, relying on contextual tints:
- Structural outlines: `rgba(22, 33, 31, 0.06)`
- Focused/Interactive borders: `rgba(15, 107, 92, 0.12)`

## Typography

The type system is powered by Geist, delivering a balance of geometric precision and humanist warmth.

- **Headlines:** Set tightly tracked with negative letter-spacing and compact line-heights to project quiet confidence and modern editorial craft.
- **Body Text:** Engineered with generous vertical metrics (`line-height` of 1.6x) to facilitate continuous, fatigue-free reading of captured notes, transcripts, and synthesized insights.
- **Labels & Metadata:** Styled with a slight positive track for effortless skimming across data attributes, tags, and timestamps.

## Layout & Spacing

Layouts follow an intentional, fixed-max content envelope centered within dynamic margins, prioritizing reading comfort over wide visual sprawl.

### Grid & Composition
- **Desktop (1200px+):** Max-width 1280px reading container utilizing an asymmetric 12-column layout (e.g., 3-column memory stream navigation paired with a 9-column workspace canvas). Outer margin scales up to `margin: 3rem`.
- **Tablet (768px – 1199px):** 8-column layout with collapsing contextual sidebars into floating drawers; gutters maintain `gutter: 1.5rem`.
- **Mobile (< 768px):** Single-column stacked stream with fixed `margin-sm: 1.25rem` and `gutter-sm: 1rem`.

### Touch Metrics & Spacing Rhythm
Vertical spacing adheres to an 8px base rhythm. Interactive elements maintain an absolute minimum touch zone of 44x44px, ensuring accessibility across mobile and touch-enabled devices without inflating visual bulk.

## Elevation & Depth

Visual hierarchy avoids heavy drop shadows, neon bloom, or loud skeuomorphism. Instead, the interface relies on subtle surface layering and whisper-quiet ambient occlusion.

### Surface Tiers
1. **Base Layer:** Canvas tone rendered in Soft Mint (`#EAF4F1`), providing a soft background matte.
2. **Elevated Cards:** Pure White (`#FFFFFF`) containers floating gently above the base canvas.
3. **Modal & Floating Overlays:** Pure White surfaces bound by deliberate hairline borders.

### Micro-Shadow Metrics
Cards and popovers employ tinted ambient depth rather than muddy black shadows:
- **Card Rest:** `box-shadow: 0 1px 3px rgba(11, 61, 53, 0.03), 0 2px 8px rgba(11, 61, 53, 0.04);`
- **Floating Overlays & Menus:** `box-shadow: 0 4px 16px rgba(11, 61, 53, 0.06), 0 1px 2px rgba(11, 61, 53, 0.02);`

### Hairline Borders
Every elevated element features a crisp, sub-pixel border (`1px solid rgba(22, 33, 31, 0.06)`), providing tactile containment without distracting visual weight.

## Shapes

The design system adopts a refined roundedness language (Level 2), providing warmth while retaining architectural discipline.

### Radius Scale
- **Cards & Primary Containers:** `16px` radius (`rounded-lg`), creating an approachable, pristine surface for memory cards and canvas blocks.
- **Inputs & Interactive Controls:** `8px` to `10px` radius (`rounded`), balancing tactile feel with geometric clarity.
- **Pills, Badges & Chips:** Full pill radius (`rounded-full`), reserved strictly for meta tags, status badges, and semantic filter chips.
- **Modals & Drawers:** `20px` to `24px` radius (`rounded-xl`), framing context switches with soft containment.

## Components

### Buttons
- **Primary:** Filled Primary Teal (`#0F6B5C`) with crisp white label typography. Minimum height of 44px with `padding: 0 1.25rem`. Softened hover state transitions smoothly to Secondary Teal (`#167D6B`).
- **Secondary / Subtle:** Pure White background with hairline border (`rgba(22, 33, 31, 0.08)`) and Near Black (`#16211F`) label. On hover, background shifts to a faint tint of Soft Mint (`#EAF4F1`).
- **Ghost:** Unbordered, transparent background with Primary Teal label; active states trigger a 4% tint wash.

### Cards & Memory Tiles
- Pure White base with `16px` border-radius and ambient teal-tinted micro-shadow (`0 2px 8px rgba(11,61,53,0.04)`).
- Bound by a hairline border (`rgba(22, 33, 31, 0.06)`).
- Padding scales from `1.25rem` on mobile to `1.75rem` on desktop.

### Chips & Filters
- **Default State:** Transparent background, `1px` border of `rgba(22, 33, 31, 0.08)`, text in Near Black.
- **Selected State:** Soft Mint fill (`#EAF4F1`), hairline border of Primary Teal at 20% opacity, text in Deep Forest (`#0B3D35`).
- Height fixed at 32px with full pill curvature (`rounded-full`).

### Input Fields & Memory Query Prompts
- Crisp White surface framed by `1px solid rgba(22, 33, 31, 0.12)` with an 8px radius.
- Minimum tap target height of 44px (48px for global search/query bars).
- Focus state eliminates standard browser rings, applying a disciplined hairline border of Primary Teal (`#0F6B5C`) with an ambient outer ring: `0 0 0 3px rgba(15, 107, 92, 0.1)`.

### Checkboxes & Radio Controls
- Base dimension of 18x18px centered inside a 44x44px touch target.
- Bordered in `rgba(22, 33, 31, 0.2)`. When checked, surfaces fill with Primary Teal (`#0F6B5C`) displaying a white micro-check icon.

### Contextual Memory Timelines & Threads
- Discrete vertical rail lines rendered in `rgba(15, 107, 92, 0.12)`.
- Timeline nodes use small 8px Accent Mint (`#7CC7B8`) discs with white rings, maintaining a clean visual rhythm across archival recall sessions.