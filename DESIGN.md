# Design plan

Written before the build. The "check against the avoid list" section is at the end.

## Intent

Calm, confident, executive. The feeling of a well-run office: quiet, warm, nothing out of place. Depth comes from layering and shape, not from effects.

## Palette

Taken from the existing brand files, kept as is.

| Token | Hex | Use |
| --- | --- | --- |
| Linen | `#F6EFE5` | Page background |
| Linen deep | `#EFE3D2` | Quiet sections, inset areas |
| Paper | `#FFFDF9` | Raised sheets (forms, resume) |
| Espresso | `#2B1D14` | Headings, primary buttons, the dark contact section |
| Text | `#3D2E22` | Body copy |
| Text soft | `#6B5847` | Secondary copy (4.5:1 or better on Linen) |
| Dusty Rose | `#C79C92` | Large decorative shapes only, never text |
| Rose ink | `#8A5649` | Rose used for text and small marks |
| Gold | `#B78B4E` | Used only for the current-section marker (nav and demo tabs) |
| Gold ink | `#7D5A1E` | Gold when it has to be text (not used by default) |

Contrast is checked in the build notes in the PR. Dusty Rose and Gold are never used for body text.

## Type

Playfair Display for display and headings, DM Sans for everything else. Both self-hosted (variable, Latin subset) so there is no third-party font request.

Scale (fluid, mobile first):

| Role | Size | Notes |
| --- | --- | --- |
| Name | `clamp(3.4rem, 12vw, 8.5rem)` | Playfair 600, leading 0.92. The loudest thing on the page. |
| Section heading | `clamp(2.1rem, 5vw, 3.4rem)` | Playfair 600 |
| Item heading | `1.35rem` | Playfair 500 |
| Lead (tagline) | `clamp(1.35rem, 2.6vw, 1.9rem)` | Playfair 500 |
| Body | `1.0625rem` / 1.65 | DM Sans 400, max 62ch |
| Small | `0.875rem` | DM Sans |

The jump from the name (up to 8.5rem) to body (17px) is the intended size contrast. Headings are sentence case with no letter-spacing. There is one small eyebrow line (the one in the existing content), set in sentence case.

## Layout concept

Asymmetric, left-aligned, built around the arch.

- Hero: text column on the left (about 7 of 12), a stack of overlapping arch shapes on the right that bleed off the edge. If `images/headshot.jpg` exists the photo sits in the front arch mask; if not, the arches stay as an abstract graphic and no empty frame is shown.
- Numbers strip: an espresso pill that overlaps the bottom of the hero by a few rem, so the hero and the next section are layered rather than stacked.
- Experience: heading and short intro pinned on the left, the list on the right as ruled rows, not cards.
- What I do: a two-column typographic list with an offset start, separated by hairlines.
- Board and education: quiet, small, on a linen-deep block with mixed corner radii (large, small, large, small).
- Contact: a dark espresso section with an arched top edge, the form on a paper sheet with a different radius.
- Resources and writing: ruled lists.

Radii are deliberately varied: arches (top fully round), pills (buttons, the numbers strip), 1.75rem sheets, 0.25rem rules and chips.

Depth: layered shapes with soft, low-opacity shadows and a subtle paper-grain tile (a small committed PNG) over the page.

## The one memorable element

The arch. It appears as the hero composition, echoes in the contact section's top edge and in the favicon and share image, and nowhere else.

## Motion

One orchestrated moment, on load only: the arches rise in a short stagger and the name rises into place. Nothing else animates on scroll. The numbers count up once (a requested feature, not a reveal effect). Everything is off under `prefers-reduced-motion: reduce`.

## Check against the avoid list

| Avoid | Status |
| --- | --- |
| All-caps tracked labels above every heading | None. Headings stand alone. One sentence-case eyebrow, from the existing copy. |
| Numbered markers | None. |
| Rows of identical cards | None. Lists are ruled rows; the numbers strip is a single pill; board and education use different shapes. |
| Gradient washes | None. Flat fills only. |
| Fade-and-slide on every section | None. Load moment only. |
| Hover effects on everything | Only buttons and text links change on hover/focus. |
| Reading text over 70 characters | Body copy is capped at 62ch. |
| Centered reading text | All reading text is left-aligned. |

## Post-build critique

Checked at 390, 768 and 1280px. The composition holds: the name leads, the numbers shelf layers over the hero, and the arch repeats in the contact edge. The thin gold arc over the hero arches was the weakest element: it read as an afterthought and spent gold on decoration, so it was removed (also from the share image). Gold now only marks the current section.
