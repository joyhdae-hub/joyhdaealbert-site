# Tracking

Analytics are **off by default**. Nothing loads and nothing is sent until you choose a provider in `data/site.json`. There are no cookies, no consent banner, and no personal data is collected.

## Switching it on

In `data/site.json`:

```json
"analytics": {
  "provider": "plausible",
  "plausible": { "domain": "joyhdaealbert.com", "scriptSrc": "https://plausible.io/js/script.tagged-events.js" },
  "cloudflare": { "token": "" }
}
```

| provider | What you get | What you fill in |
| --- | --- | --- |
| `none` | Nothing loads. | Nothing. |
| `plausible` | Page views plus the custom events below. | `plausible.domain`. Use `scriptSrc` only if you self-host. |
| `cloudflare` | Page views only. Custom events are not sent. | `cloudflare.token` (the Web Analytics token). |

If the provider is set but its field is empty, nothing loads. If you self-host Plausible, add your host to `script-src` and `connect-src` in the Content-Security-Policy in `netlify.toml`.

In Plausible, add each event name below as a goal (Site settings, Goals, Custom event) and, to see the properties, add the props under Site settings, Custom properties.

## Events

| Event | Fires when | Properties |
| --- | --- | --- |
| `template_download_click` | Someone clicks Download, Get it, or Open on a template, on the home page or the templates page. | `template_id`, `version`, `source` (`home` or `templates`), `format` for alternate formats |
| `demo_opened` | The /toolkit demo page is opened. | none |
| `demo_tab` | A tab is chosen in the demo. | `tab` (`overview`, `events`, `vendors`, `projects`, `requests`) |
| `demo_export_csv` | Export to CSV is used in the demo. | none |
| `resume_view` | The /resume page is opened. | none |
| `resume_print` | The print dialog opens on the resume (Save as PDF button or Ctrl/Cmd+P). | none |
| `contact_submit` | The contact form is sent successfully. | none |
| `template_request_submit` | The "Request a template" form is sent successfully. | none (the request text and email are never sent to analytics) |

Every event also carries `utm_source`, `utm_medium`, and `utm_campaign` when the visit arrived with them in the URL. They are kept for that browser tab's visit (sessionStorage, not a cookie).

## Reading the results

- **Demand for a template**: downloads per `template_id`, and the `template_request_submit` count. Requests themselves (the text) arrive in Netlify under Forms.
- **Interest in the toolkit**: `demo_opened`, then `demo_tab` for which areas people explore, then `demo_export_csv` as a sign of real use.
- **What brings people in**: top sources and the UTM breakdown for each event.
- **Resume**: `resume_view` against `resume_print`.
- Compare month to month rather than reading single days. Small numbers are noisy.

## UTM convention for LinkedIn links

```
https://joyhdaealbert.com/toolkit/templates/?utm_source=linkedin&utm_medium=post&utm_campaign=<yyyymm-topic>
```

Examples: `utm_campaign=202611-vendor-tracker`, `utm_campaign=202612-move-checklist`. Lowercase, hyphens, no spaces. Use a different `utm_campaign` for each post so each one can be measured.

## Monthly checklist (spreadsheet)

Add one row per month with these columns:

1. Month
2. Page views (total)
3. Top 3 sources
4. `template_download_click` per template (one column each, by `template_id`)
5. `demo_opened`, `demo_export_csv`
6. `resume_view`, `resume_print`
7. `contact_submit`
8. `template_request_submit`, plus the three most common requested templates (from Netlify Forms)
9. Top `utm_campaign` values
10. Decision or note for next month

## Moving a template from free to paid

In `data/templates.json`, change only `price` (for example `12`) and `fulfillment` / `url` (for example `"fulfillment": "url", "url": "https://yourname.gumroad.com/l/vendor-tracker"`). The button label, the price, and the tracking update on their own. Bump `version` and `updatedAt` if the file changed.
