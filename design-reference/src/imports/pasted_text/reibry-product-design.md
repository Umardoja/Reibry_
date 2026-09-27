You are the lead product designer for REIBRY, a consumer AI memory product.

I am providing two product guides and screenshots of the current working application.

Your task is NOT to invent a different product.

Your task is to redesign and polish the existing REIBRY interface into a premium, production-quality mobile-first product that feels as disciplined and refined as work produced by top-tier product design teams at companies such as Apple, Samsung, NVIDIA, Stripe, Notion, Linear, or Airbnb.

Do not copy any of those companies' interfaces.
Use them only as a quality benchmark for:
- hierarchy
- clarity
- spacing
- consistency
- motion restraint
- usability
- visual polish
- interaction quality

==================================================
PRODUCT
==================================================

REIBRY is a personal AI memory engine.

Core idea:

Users save or share things they discover:
- links
- videos
- articles
- notes
- ideas
- tutorials
- recipes
- screenshots/content

REIBRY understands them, organizes them automatically, remembers them, lets the user ask for them later, connects them to things happening in the user's life, and resurfaces them when relevant.

Core product loop:

Discover
→ Capture
→ Understand
→ Remember
→ Connect to Life
→ Resurface
→ Act

REIBRY has two conceptual brains:

1. Memory Brain
   Saved content, notes, links, videos, articles, ideas and knowledge.

2. Life Brain
   Events, goals, deadlines, tasks, trips, projects and things currently happening in the user's life.

The key differentiator is:

"Other apps help you find what you remember saving.
REIBRY helps you remember what you've forgotten."

==================================================
CORE UX PRINCIPLE
==================================================

The universal mental model is:

"Tell REIBRY anything."

The user should not have to:
- organize folders
- manually categorize content
- fill long forms
- understand AI terminology
- manage technical metadata
- decide which internal workflow to use

REIBRY should quietly understand the input and do the structuring work.

The product must feel:
- calm
- intelligent
- personal
- trustworthy
- premium
- effortless
- human
- clear

NOT:
- futuristic AI dashboard
- cyberpunk
- neon
- holographic
- crypto-style
- enterprise admin panel
- overly technical
- overly playful
- cluttered

==================================================
BRAND
==================================================

Product name:

REIBRY

Always spell it exactly:
REIBRY

Primary colors:

Primary Teal:
#0F6B5C

Deep Forest:
#0B3D35

Secondary Teal:
#167D6B

Soft Mint:
#EAF4F1

Accent Mint:
#7CC7B8

Near Black:
#16211F

White:
#FFFFFF

Use the existing REIBRY monogram/logo where appropriate.

The brand should feel like:
calm intelligence + knowledge + memory + trust.

Avoid large gradients.
Avoid excessive glow.
Avoid glassmorphism as the main visual language.

Light mode first.

==================================================
DESIGN SYSTEM
==================================================

Create a complete reusable design system.

Spacing:
4 / 8 / 12 / 16 / 24 / 32 / 48

Radii:
- small controls: 10–12px
- cards: 14–18px
- large panels: 20–24px
- chips/pills: 999px

Touch targets:
minimum 44px where practical.

Typography:
Use a premium modern sans-serif.
Prefer:
- Geist
- Inter
or a similarly clean product typeface.

Typography hierarchy should feel editorial and calm.

Do not overuse bold weight.

Use:
- strong display heading
- section heading
- body
- supporting/meta text
- caption
- label

Use one consistent icon family such as Lucide.

No emoji as primary interface icons.

==================================================
LAYOUT STRATEGY
==================================================

MOBILE FIRST.

Primary design widths:

390 x 844
430 x 932

Also design:

1440 desktop.

Mobile should be the primary product experience.

Desktop should not simply stretch mobile UI.

Desktop should use:
- centered content
- intentional max-width
- stronger whitespace
- optional two-column compositions where useful

No horizontal overflow.

==================================================
APP SHELL
==================================================

Create a refined responsive application shell.

Mobile:
- compact top bar
- REIBRY identity
- optional subtle profile/avatar control
- fixed bottom navigation

Bottom navigation:

Today
Memories
Capture
Ask
Life

Capture should have slightly stronger visual prominence.

Desktop:
use a minimal top navigation or compact horizontal product bar.

Do not make navigation visually heavy.

==================================================
SCREEN 1 — TODAY
==================================================

Today is the emotional and product "wow" screen.

Purpose:

Show the user only the few saved things that matter right now.

Maximum 3 resurfaced items.

Top section:

Greeting / time-aware headline

Example:

"Good morning"
or
"Here’s what may matter today"

Supporting line:

"3 memories may be useful today."

Then show Context Memory Cards.

Each card should include:

- source icon or thumbnail
- memory title
- concise summary
- "Why now" reason
- related Life context
- primary action
- quiet secondary controls
- "Why this?" disclosure

Example:

Red Velvet Cake Tutorial

Why now:
"Mum's birthday is Saturday."

Primary action:
"Create shopping list"

Secondary:
Later
Dismiss

Another example:

Calculus Revision Guide

Why now:
"Your mathematics exam is Friday at 9 AM."

Primary action:
"Start revision"

The user should understand the purpose of REIBRY from Today in under 10 seconds.

Do NOT show:
- similarity scores
- vector values
- model names
- raw confidence
- technical metadata

Empty state:

"Nothing needs your attention right now.
REIBRY is still remembering."

Make this screen feel special but calm.

==================================================
SCREEN 2 — MEMORIES
==================================================

Purpose:

One organized home for everything remembered.

Top:
Page title + supporting copy.

Primary search:
"What do you remember?"

The search control should feel important and intelligent.

Below search:
canonical category filter.

Use these categories exactly:

All
Education & Learning
Technology
Food & Cooking
Finance
Travel
Health & Fitness
Work & Career
Entertainment
Shopping
Personal
Ideas & Inspiration
Other

Design the category system so it works elegantly on mobile:
horizontal scroll / compact chips / filter sheet.

Do not display all categories in a giant wrapped mess.

Memory Cards should show:

- title
- compact summary
- source icon/platform
- date saved
- category
- 1–3 important tags
- optional thumbnail
- subtle status only when partial/failed

Cards must work with:
- missing thumbnails
- long titles
- long summaries
- URLs
- text memories
- YouTube
- different categories

Support:
- newest first
- search
- category filtering
- Load More

Mobile:
single-column feed.

Desktop:
refined grid or adaptive list.

==================================================
SCREEN 3 — MEMORY DETAIL
==================================================

Purpose:

Show what REIBRY understood.

Hierarchy:

1. Back navigation
2. Memory title
3. Summary
4. Source/original content
5. Category
6. Tags/topics/entities
7. Possible intents
8. related Life context if relevant
9. suggested action if relevant

Primary action:
"Open original"

For complete Memories:
keep status visually quiet.

Do NOT show:
"Status: complete"
"Confidence: 95%"
as dominant technical information.

Complete Memories should simply feel complete.

Only expose analysis status prominently when:
- partial
- failed
- low confidence

For partial:

"Remembered with limited understanding."

Trust/evidence disclosure:

"Understood from:
YouTube metadata + shared caption"

or:

"Metadata only"

Use a small disclosure rather than technical debug fields.

==================================================
SCREEN 4 — CAPTURE
==================================================

This is one of the most important screens.

Primary mental model:

"Tell REIBRY anything…"

Use one large, beautiful composer.

It must support:
- text
- URL
- shared content
- notes
- ideas

Do NOT show lots of input modes.

Optional small helper actions:
- Paste link
- Add file

Primary action:
"Remember this"

Processing states should feel intentional.

Sequence examples:

"Reading source…"
"Understanding…"
"Connecting ideas…"
"Remembered."

Successful result:
"Remembered."

Partial:
"Remembered. I couldn’t confidently understand the full source yet."

Failure:
always provide a next step.

Examples:
Retry
Keep link
Edit
Open original

Design shared-from-Android state:

"Shared with REIBRY"

Show:
shared caption/title
URL
Remember this

==================================================
SCREEN 5 — ASK
==================================================

Purpose:

Natural-language recall.

Make this feel closer to an intelligent personal search experience than a chatbot.

Hero question:

"What do you remember?"

Large search/question composer.

Example suggestion chips:

"That cake recipe I saved"
"Show my Python resources"
"What did I save for my maths exam?"
"That video about studying"

Results should look like ranked Memories, not chat bubbles.

Each result:
- title
- short reason/snippet
- source
- category
- relevant tags

Optional disclosure:
"Why this result?"

Do not show similarity percentages.

Zero-result state should be helpful:

"I couldn't find a strong match.
Try describing what it was about, where you saw it, or why you saved it."

==================================================
SCREEN 6 — LIFE
==================================================

Purpose:

Things happening in the user's life that help REIBRY know when memories matter.

Top composer:

"What's happening in your life?"

Example placeholder:

"My exam is next Friday at 9 AM"

Avoid calendar-style multi-field forms.

Life cards should support:

Event
Deadline
Task
Goal
Trip
Project

Each Life card:

- title
- type icon
- resolved date/time when available
- short description
- active/paused state
- quiet edit/pause/delete controls

Use natural conversational confirmation where useful.

Example:

"We understood:
Mathematics exam
Friday · 9:00 AM"

If date is ambiguous:

"Did you mean this Friday?"

Do not expose internal parsing/provider information.

==================================================
SCREEN 7 — AUTH
==================================================

Create premium Sign In and Sign Up screens.

Simple centered composition.

Sign In:
- email
- password
- show/hide password
- primary CTA
- switch to Sign Up

Sign Up:
- email
- password
- confirm password
- show/hide
- primary CTA

Keep it calm and minimal.

No marketing overload.

Optional small product proposition above/below the form.

==================================================
SCREEN 8 — ONBOARDING
==================================================

Design a lightweight 3-step onboarding flow.

Step 1:
Value proposition

"Remember what you discover.
Bring it back when it matters."

Step 2:
Optional Life context

"What's happening in your life right now?"

Single free-text field + example chips.

Include Skip.

Step 3:
Explain sharing.

Visual explanation:

YouTube / browser / another app
→ Share
→ REIBRY
→ remembered

Do not request unnecessary permissions.

Onboarding should complete in under 45 seconds.

==================================================
STATES
==================================================

Design shared reusable states for:

- loading
- understanding
- success
- empty
- no search result
- partial analysis
- failed analysis
- network error
- source blocked
- authentication required
- confirmation required

Every state should provide a next step.

Do not show technical stack traces, model names or provider messages.

==================================================
MOTION
==================================================

Use restrained product motion.

150–250ms typical transitions.

Use:
- subtle card entrance
- button state transitions
- skeleton-to-content transition
- bottom-sheet transition
- chip/filter transition

No bouncing.
No dramatic zoom.
No excessive parallax.
No flashy AI effects.

Respect reduced motion.

==================================================
ACCESSIBILITY
==================================================

Design for:

- WCAG-friendly contrast
- visible keyboard focus
- 44px touch targets
- semantic form labels
- readable body text
- one-handed mobile use
- no information conveyed by color alone

==================================================
COMPONENT LIBRARY
==================================================

Create reusable components and variants for:

AppShell
TopBar
BottomNavigation
Button
IconButton
Card
MemoryCard
ContextMemoryCard
LifeContextCard
SearchField
UniversalComposer
Input
PasswordInput
CategoryChip
TagChip
StatusBadge
SourceBadge
Skeleton
EmptyState
StatePanel
Toast
BottomSheet
Modal
Avatar
SectionHeader
FilterSheet
LoadingState
ProcessingSteps

Create Auto Layout and component variants.

Do not create each screen as isolated one-off styling.

==================================================
VISUAL QUALITY
==================================================

Aim for:

- sophisticated spacing
- restrained shadows
- subtle borders
- very clean typography
- high information clarity
- strong alignment
- generous breathing room
- premium but approachable surfaces
- intentional empty space
- minimal visual noise

Avoid:
- oversized cards everywhere
- random gradients
- generic SaaS dashboard aesthetic
- large blocks of teal
- too many outlines
- excessive pills
- every piece of metadata visible at once
- multiple primary buttons competing for attention

Use progressive disclosure.

==================================================
CURRENT PRODUCT REALITY
==================================================

The backend already supports:

- authentication
- text Capture
- URL Capture
- YouTube enrichment
- Android/PWA sharing
- Gemini-powered understanding
- controlled Memory categories
- tags/entities/intents
- Memories library
- search
- category filters
- pagination
- Memory Detail
- Life parsing
- relative dates
- context matching
- Ask semantic retrieval
- Today contextual resurfacing

The design must reflect a real working product.

Do not design fake unsupported features.

==================================================
OUTPUT REQUIRED
==================================================

Create a complete Figma product design containing:

1. Foundations page
2. Color tokens
3. Typography
4. spacing/radius/shadow tokens
5. component library
6. icons and states
7. mobile Today
8. mobile Memories
9. mobile Memory Detail
10. mobile Capture
11. mobile Ask
12. mobile Life
13. mobile Auth
14. mobile Onboarding
15. desktop adaptations of core screens
16. loading/error/empty/partial variants
17. prototype connections for critical user flows

Prototype these flows:

FLOW 1:
Capture URL
→ Understanding
→ Remembered
→ Memory Detail

FLOW 2:
YouTube share
→ Shared with REIBRY
→ Remember
→ Memory Detail

FLOW 3:
Add Life event
→ confirmation
→ saved Life context

FLOW 4:
Ask vague question
→ Memory result
→ Memory Detail

FLOW 5:
Today
→ Why now
→ relevant Memory
→ suggested action

==================================================
FINAL STANDARD
==================================================

This should look like a real consumer product ready for:
- App Store screenshots
- investor demo
- hackathon judges
- product launch
- professional portfolio review

The design should immediately communicate:
calm intelligence,
trust,
memory,
personal relevance,
and effortless organization.

Do not merely beautify the existing screens.
Improve the hierarchy, flow, states, spacing, component consistency and interaction model while preserving REIBRY's working functionality.