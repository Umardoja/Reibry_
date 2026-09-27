FINAL REIBRY MOBILE UI POLISH + ENGINEERING-READY CLEANUP

IMPORTANT:
Do NOT redesign REIBRY.
Do NOT introduce a new visual language.
Do NOT replace the existing Stitch-inspired direction.

The current visual design is APPROVED.

Your task is to refine the CURRENT screens so they look like a production-quality
mobile application designed by a senior UI/UX team and can be exported cleanly
for engineering implementation.

I will export the resulting Figma code/files and use them as the visual reference
inside an existing Next.js application.

Therefore this pass must focus on:

- correct proportions
- mobile readability
- spacing discipline
- responsive Auto Layout
- component consistency
- realistic control sizes
- clean export structure
- visual polish

==================================================
1. PRIMARY TARGET
==================================================

Design first for:

390px mobile width

Also verify:

430px mobile width

Everything should feel natural on an actual phone.

Do not scale desktop elements down into mobile.

Do not make individual controls disproportionately large.

No horizontal overflow.

==================================================
2. FIX THE CURRENT SCALE PROBLEMS
==================================================

Several current elements are visually oversized.

Correct them.

LIFE:

The current "Add to Life" action and arrow are far too large.

Replace the giant arrow treatment with a normal premium mobile CTA.

Target approximately:

button height: 48–52px
icon: 18–20px
normal arrow icon after label

Example:

Add to Life   →

Do not use a huge decorative arrow.

The optional secondary Voice action should not visually compete with the main CTA.

The Life composer should remain the hero input, not the button.

--------------------------------------------------

CAPTURE:

The current large grey "Remember this" block is far too tall and visually heavy.

Replace it with a normal premium primary button.

Use approximately:

height: 50–54px
full available width
16–18px label
small arrow icon

"Remember this  →"

Do not use a giant arrow illustration.

Processing stages should sit in a lightweight compact panel, not create another
massive card.

--------------------------------------------------

ASK:

The current Ask screen leaves too much empty vertical space when results have not
loaded yet.

Create a purposeful initial state.

After the Ask composer and suggestion chips, either:

- show a subtle helpful empty state
or
- allow the content area to remain breathable without looking unfinished

Do not leave a large blank canvas that looks like missing content.

==================================================
3. TYPOGRAPHY SCALE
==================================================

Some secondary text and metadata are too small.

Audit every screen at 100% mobile scale.

Use approximately:

Display / hero:
28–32px

Page title:
24–28px

Card title:
17–20px

Body:
15–16px

Secondary body:
13–14px

Metadata / chip:
12–13px minimum

Do NOT use unreadable 9px or 10px metadata.

Avoid excessive letter spacing.

Use sentence case for normal interface copy.

The interface should feel elegant because of hierarchy and spacing, not tiny text.

==================================================
4. SPACING SYSTEM
==================================================

Normalize all spacing to a deliberate system:

4px
8px
12px
16px
24px
32px
48px

Mobile page horizontal padding:

16px minimum
prefer 16–20px consistently

Do not allow one screen to use 12px while another uses 28px arbitrarily.

Section spacing:
24–32px

Card-to-card:
12–16px

Internal card padding:
16px

Compact metadata gaps:
6–8px

Make all screens feel like they were designed from the same grid.

==================================================
5. HEADER CONSISTENCY
==================================================

Use exactly the same authenticated header geometry on:

Today
Memories
Capture
Ask
Life
Memory Detail

Header should contain:

small REIBRY mark/identity
current page
notification/account controls when appropriate

Keep:

same height
same left/right padding
same icon sizes
same vertical alignment

Do not let different screens have differently scaled headers.

==================================================
6. BOTTOM NAVIGATION
==================================================

Keep the current bottom navigation design.

It is approved.

But normalize it precisely.

Use the same:

height
background
safe-area padding
icon dimensions
label typography
spacing
active-state treatment

on every authenticated screen.

Capture remains the raised central button.

Capture FAB:

roughly 48–54px circle

Do not oversize it.

Nothing should be hidden behind the navigation.

==================================================
7. TODAY
==================================================

Today is the signature screen.

Preserve:

Good morning
Here's what matters today
maximum 3 resurfaced cards
Why now
Life connection
primary action
Later
Dismiss
Why this?

Refine card proportions.

The first image card should be visually rich but should not take most of the
screen height.

Use approximately:

image aspect ratio around 16:9 or 3:2

Keep card title, reason and CTA visible without excessive scrolling.

Reduce chip clutter.

Only show information that helps understand:

WHAT is this?
WHY is it useful now?
WHAT can I do?

==================================================
8. MEMORIES
==================================================

The current Memories direction is strong.

Refine it rather than redesigning it.

Search field:
48–52px height

Category chips:
compact
horizontal scroll
single-line

Cards should not feel cramped.

Make title the dominant element.

Then:
summary
source/date
category
1–2 useful tags

Do not display too many hashtags.

Thumbnail should be roughly 72–88px when used as a side image.

If no thumbnail exists, text layout should still look complete.

==================================================
9. CAPTURE
==================================================

Maintain the Stitch visual character.

Header:
Capture

Headline:
Save a thought, link, or plan.

Supporting sentence:
brief and human.

Large composer:
comfortable but not excessively tall.

For 390px mobile:
roughly 140–180px initial composer height is enough.

Detected source preview:
compact card inside/below composer.

Example:

YouTube icon
Red Velvet Cake Tutorial
youtube.com

Helper actions must remain small and secondary.

Do not add multiple giant buttons.

Primary CTA:
Remember this →

Make processing compact:

✓ Reading source
✓ Understanding
• Connecting

Avoid technical terms.

==================================================
10. ASK
==================================================

Headline:
Ask REIBRY

Question:
What do you remember?

Search should be visually important.

Search field:
approximately 52px height.

Suggestion chips:
compact horizontal arrangement or wrapping with good spacing.

When results exist:

Top matches

Cards should use:

thumbnail
title
short summary
source/category
optional Life relationship
Open memory

Do not show engineering metrics.

Ensure the initial screen does not look empty or unfinished.

==================================================
11. LIFE
==================================================

Keep:

What's happening in your world?

Natural-language composer.

Do not overcomplicate the screen.

The current Life controls are too large in places.

Primary input area should receive the most attention.

Primary CTA:
normal 48–52px button.

Life cards should follow:

type
title
date/time
description
optional contextual info

Date should be human-readable.

Example:

Thursday · 2:00 PM

Do not show raw timestamps.

Do not let chips become more visually dominant than the Life item title.

Keep optional Connect Calendar visually secondary.

==================================================
12. MEMORY DETAIL
==================================================

Preserve the current premium layout.

Top:

Back
source/category
image
title
saved information
Open original

Then sections:

Summary

What REIBRY understood

Topics

People & things

Intent & context

Connected to your Life

Source evidence

Do not make every section a large card.

Some sections may sit directly on the canvas.

Use cards only when grouping genuinely helps.

This will make the page feel lighter and more premium.

==================================================
13. AUTH
==================================================

Keep centered clean composition.

Form width should feel natural on 390px.

Input height:
48–52px

Primary button:
50–52px

Password visibility icon:
44px accessible tap target without visually appearing huge.

Current email/password experience must work beautifully without Google/Apple.

Google/Apple may exist as FUTURE component variants.

Do not make them necessary to the composition.

==================================================
14. ONBOARDING
==================================================

No bottom navigation during onboarding.

Keep onboarding focused.

Do not make it look like a normal authenticated screen.

Use progress indicator at top.

Strong headline.

One focused interaction.

Primary CTA near bottom but not hidden.

The user should understand each screen instantly.

==================================================
15. CARDS
==================================================

Standardize cards.

Primary radius:
16px

Large visual cards:
18–20px if needed

Border:
subtle 1px tonal border

Shadow:
extremely soft

Do not use heavy shadows.

Do not make every section float.

Use whitespace and background tonal contrast.

==================================================
16. BUTTON SYSTEM
==================================================

Create reusable Button variants.

Primary:

height 50–52px
forest green background
white label
16px medium/semibold
12–16px radius

Secondary:
soft mint / white
forest label

Tertiary:
text/ghost

Icon button:
44px touch target

Never use enormous arrows or decorative icons as the main button content.

==================================================
17. INPUT SYSTEM
==================================================

Standardize:

TextField
PasswordField
SearchField
Composer

Use consistent:

border
radius
focus state
background
placeholder color
padding

Input controls must look like the same design system across Auth, Ask, Capture,
and Life.

==================================================
18. CHIPS
==================================================

Avoid excessive pill usage.

Use pills only for:

category
source
short contextual relationship
filter

Target:

28–34px height

Readable 12–13px text.

Avoid creating three stacked rows of chips unless truly needed.

==================================================
19. COLOR
==================================================

Preserve the approved REIBRY palette.

Use:

Soft mint canvas
Warm/clean white cards
Deep forest headings
Teal primary actions
Muted teal secondary information

Do not make the whole app green.

White space should balance the brand colors.

Avoid gradients unless extremely subtle and necessary.

==================================================
20. WARMTH
==================================================

Make REIBRY feel personal and welcoming.

Use:

natural content thumbnails
friendly language
comfortable whitespace
soft tonal backgrounds
subtle contextual details

Avoid making it look:

clinical
technical
financial
enterprise
cybersecurity-themed

REIBRY should feel like a private, intelligent memory space.

==================================================
21. AUTO LAYOUT — CRITICAL
==================================================

Rebuild/fix all frames using proper Figma Auto Layout.

Avoid arbitrary absolute positioning.

Use:

Auto Layout
Hug contents
Fill container
min/max widths
consistent gaps
padding tokens

Cards must grow naturally with text.

Long titles must wrap without breaking layout.

Buttons must not move unpredictably.

Images must preserve aspect ratio.

Bottom navigation should remain anchored correctly.

==================================================
22. RESPONSIVE CONSTRAINTS
==================================================

Design components to work at:

390px
430px

without separate hacks.

Use Fill Container where appropriate.

Avoid hard-coded widths that only work at one viewport.

For exported code, layouts should translate naturally into:

flex
grid
max-width
gap
padding

not hundreds of absolute pixel coordinates.

==================================================
23. ENGINEERING-READY EXPORT
==================================================

This is extremely important.

I will export the Figma code and use it as a reference inside an existing
Next.js application.

Structure the design so exported code is clean.

Prefer:

semantic components
flex layouts
grid layouts
Auto Layout
reusable components
variables/tokens

Avoid:

absolute positioning for ordinary layout
huge fixed pixel dimensions
duplicated components
one-off inline styling everywhere
canvas coordinates as layout
unnecessary nested wrappers

Create/reuse components:

AppHeader
BottomNavigation
Button
IconButton
Card
MemoryCard
TodayCard
LifeCard
SearchField
Composer
Chip
SourcePreview
StatePanel
SectionHeader

==================================================
24. CURRENT VS FUTURE FEATURES
==================================================

Current primary frames may use:

Email/password auth
Text Capture
URL Capture
YouTube metadata
Android sharing
Memory organization
Ask
Life natural-language input
relative dates
Today resurfacing

Keep FUTURE variants separately for:

Google Sign In
Apple Sign In
Calendar connection
File/Image/Audio/Video Capture
Transcript evidence
Audio transcription
Video understanding

Do not let future variants clutter the current main screens.

==================================================
25. FINAL PROFESSIONAL QA
==================================================

Review every screen at ACTUAL phone size, not zoomed-out Figma canvas size.

For every screen ask:

Can I read everything comfortably?

Is anything unnecessarily huge?

Is anything too tiny?

Does one obvious primary action exist?

Is there unnecessary empty space?

Does content fit naturally within 390px?

Does the bottom navigation obscure anything?

Does this feel like a real App Store application?

Does every screen clearly belong to REIBRY?

Does this look intentionally designed rather than AI-generated?

Fix any screen that fails those checks.

==================================================
FINAL INSTRUCTION
==================================================

DO NOT create a new design.

Polish the current approved REIBRY design.

The result should look:

cleaner
tighter
warmer
more balanced
more readable
more professional
more consistent

and should be engineered so that the exported Figma code reproduces the design
accurately without fragile positioning.

This is the FINAL design-quality and export-readiness pass.