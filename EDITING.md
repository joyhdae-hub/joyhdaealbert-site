# Editing the site

All content lives in `/data` as JSON. You never need to touch HTML, CSS, or JavaScript to change words, add a post, or publish a template. After a change is merged, Netlify rebuilds the site automatically.

**One rule above all:** an empty field never shows on the live page. Leave a field as `""` (or a list as `[]`) and it simply does not appear. JSON is strict: keep the quotes, commas, and brackets exactly as they are, and use a straight `"` quote. If a build fails, the error names the file.

## `data/site.json` (the main page, resume, and settings)

| Field | What it controls |
| --- | --- |
| `title`, `description` | Browser tab title, search result text, and share previews |
| `jobTitle` | Shown on the resume and in the search-engine data |
| `eyebrow`, `tagline`, `intro`, `intro2` | Hero and intro text |
| `email`, `linkedin` | Contact details. The email is hidden from scrapers in the page source |
| `showResources` | `true` or `false`. `false` removes the Resources section, its nav link, and the /toolkit/templates page |
| `showToolkit` | `true` or `false`. Controls the demo link in the Resources section and footer |
| `stats` | The "By the numbers" strip. `qualifier` is the small word above the number ("Nearly"); leave it `""` for none |
| `services` | The "What I do" list |
| `board`, `education` | The quiet sections. `note` is optional |
| `analytics` | See `docs/TRACKING.md` |
| `copy` | Headings, button labels, and short intros |

## `data/experience.json`

One entry per bullet:

```json
{
  "id": "vendor-tracking",
  "summary": "Built a vendor tracking system that streamlined spend and contract management.",
  "context": "",
  "whatIDid": "",
  "result": ""
}
```

Fill in `context`, `whatIDid`, and/or `result` and that item becomes expandable, showing only the parts you filled. If all three are empty the item is a plain line with no expand control. The same text also appears on the resume.

## `data/writing.json`

Add LinkedIn posts to `items`, in any order (the site sorts newest first):

```json
{ "title": "Post title", "date": "2026-11-04", "url": "https://www.linkedin.com/posts/...", "summary": "One line." }
```

`title`, `date` (`YYYY-MM-DD`), and `url` are required; `summary` is optional. While the list is empty, the whole Writing section and its nav link are hidden. Tip: add `?utm_source=...` only to links *you share*, not to these (see `docs/TRACKING.md`).

## `data/templates.json` (templates and resources)

Single source of truth for the Resources section and the /toolkit/templates page.

| Field | Meaning |
| --- | --- |
| `id` | Stable slug, never change it once published (used in tracking) |
| `title`, `description`, `category`, `tags` | Display text |
| `format` | `xlsx`, `docx`, or `pdf` |
| `version`, `updatedAt` | Shown on every template. Update both when the file changes (`updatedAt` as `YYYY-MM-DD`) |
| `license` | Short license text |
| `price` | `0` for free. Any number above 0 shows the price and a "Get it" button |
| `fulfillment` | `"file"` (uses `path`) or `"url"` (uses `url`, for example a Gumroad product) |
| `path` | For files, relative to the repo root, e.g. `downloads/weekly-briefing.docx` |
| `url` | For `"url"` fulfillment, an `https://` link |
| `status` | `"draft"` (hidden) or `"live"` (shown) |
| `alsoAs` | Optional extra formats of the same template, e.g. `[{ "format": "pdf", "path": "downloads/weekly-briefing.pdf" }]` |

### Publish one of the draft templates

1. Add the file to `/downloads` (for example `downloads/weekly-briefing.docx`, and the `.pdf` if you have one).
2. In its entry, set `path` to that file (and the `path` inside `alsoAs` for the PDF).
3. Set `status` to `"live"` and update `version` and `updatedAt`.
4. Run `npm run check-templates`, then commit. It appears on the site after the next build. If a live entry's file is missing, the build skips it and prints a warning rather than showing a broken link.

Draft files are never copied into the published site, so an unfinished file cannot be reached by its URL.

### Switch a template from free to paid

Change only `price` and `fulfillment` (plus `url`), for example:

```json
"price": 12,
"fulfillment": "url",
"url": "https://yourname.gumroad.com/l/vendor-tracker"
```

## `data/demo-hq.json`

The fictional "Northfield Advisory" sample data for the /toolkit demo. Dates are written as days from today so the demo always looks current. Keep it fictional.

## Images

- `images/headshot.jpg`: if this file exists, the hero shows it inside the arch. If it does not exist, the hero shows the abstract arches and no empty frame. Use a portrait crop, about 800 by 1000 pixels, under 150 KB.
- `images/og-image.png`: the 1200 by 630 share image. Regenerate with `node scripts/generate-og.mjs` after editing `scripts/og-source.html` (needs Playwright; optional).

## Regenerating the starter templates

See the README ("Templates").
