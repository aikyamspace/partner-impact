# partner-impact

Impact sites for aikyam space partners: a partner's activities, clubs and
outcomes, read from the aikyam Strapi CMS (`cms.folktaler.com`) and published
on GitHub Pages. Each activity has a printable PDF report.

One template, one config file per partner in `partners/<slug>.json`:

| Field | Meaning |
| --- | --- |
| `slug` | This config's name; the build picks it with `PARTNER=<slug>` |
| `host` | The partner's slug in Strapi; only activities hosted by it are shown |
| `name` | The partner's name as printed |
| `website` | The partner's own site, linked from the header |
| `primary` | The partner's brand colour. A darker shade of it, checked to 4.5:1 on the page, is used for text |
| `repo` | The GitHub repository that publishes this partner's site |
| `domain` | The custom domain, or `null` while the site is served at `aikyamspace.github.io/<repo>/` |

## Build locally

Needs Node 22 and `typst` 0.15.1. The Strapi key is read from `STRAPI_TOKEN`,
or from `~/_work/strapi-partner-build.json`.

```
npm install
PARTNER=olimalar npm run build
```

## Publish a partner

1. Add `partners/<slug>.json`.
2. Create `aikyamspace/<slug>-impact` (public), and copy `publish/workflow.yml`
   into it as `.github/workflows/publish.yml` with `PARTNER` set.
3. In that repository: add the `STRAPI_TOKEN` secret, and set Pages to
   "GitHub Actions".
4. For a custom domain: the partner adds `CNAME <sub> → aikyamspace.github.io`,
   then set it in the repository's Pages settings and in `domain` here.

## Shared with aikyam.space

`copy-shared.sh` copies the design system, the activity components and the
report template from `~/aikyam-space`. Run it again to pick up changes there.
