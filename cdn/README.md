# cdn.marchjs.com

MarchJS as browser ES modules, served by a Cloudflare Worker's static assets.

| | |
|---|---|
| `npm run build:cdn` | `tools/build-cdn.js`: `cdn/dist/<version>/` (gitignored) |
| `npm run deploy:cdn` | `tools/cdn-deploy.js`: build, keep the versions already out, write `versions.json` and `_headers`, `wrangler deploy` (`--dry-run`: no deploy) |
| `node tools/cdn-version.js` | the version a release is published as (the workflow runs it) |

## What is served

- `/<version>/march.js`, `ui.js`, `app-ui.js`, `behaviors/drag.js`, `icons/lucide.js`… one file per package entry;
  shared code in `_/` chunks.
- `/<version>/march.css`: the tokens, the sx utilities and every component's styles. `/<version>/css/…`: the stylesheets
  the package exports as files (themes).
- `/<version>/importmap.json` (every entry), `/<version>/files.json` (every file), `/versions.json`.
- `/latest/…`: a redirect (302, five minutes) of the Worker to the newest version's file; a module loaded through it
  imports its chunks from the version it landed on.
- A patch no longer kept (see "How many versions stay"): a redirect to the newest kept version of the same minor.

Headers (`_headers`): `Access-Control-Allow-Origin: *` on every file; a version's files `Cache-Control: public,
max-age=31536000, immutable`; `versions.json` and the Worker's redirects five minutes.

## Releases

Every merge to main is a release: `.github/workflows/cdn.yml` runs after `ci` passes on main, picks the version
(`tools/cdn-version.js`), publishes it with `tools/cdn-deploy.js`, checks that `versions.json` shows it as latest and
tags the merge commit `v<version>`.

- The version: `package.json`'s when it is not out yet (a PR raises it for a minor or major release, with its
  CHANGELOG entry), else the next patch of the newest published one (0.3.0 out → 0.3.1, 0.3.2…). The workflow writes
  it into `package.json` and `src/index.ts` of its own checkout only; the tag records which commit it is.
- Secrets of the repository: `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template, for the account that
  holds marchjs.com) and `CLOUDFLARE_ACCOUNT_ID`.
- By hand: `npm run deploy:cdn` (`--dry-run`: everything but the deploy), after `wrangler login`.

A deploy replaces every asset, so `cdn-deploy.js` downloads each kept version (its `files.json`) and publishes it
again with the new one. A version that is out is never published again changed: browsers keep it for a year.

### How many versions stay

Workers Free allows 20,000 static asset files per deploy, and a version is about 1,200 files. So `cdn-deploy.js`:
- always keeps the newest version of each minor (0.1.0, 0.2.0, the newest 0.3.x…);
- then keeps the newest other versions while the total stays under `MAX_FILES` (19,000; `CDN_MAX_FILES` overrides);
- drops the rest.

Dropped versions are listed in `versions.json` (`dropped`) and never published again. The Worker sends a request for one
to the same file of the newest kept version of its minor (same API), so old links keep working. Workers Paid (100,000
files) would let more versions stay.

## Usage notes

The Worker runs only for `/<version>/march.js` (`run_worker_first`). It writes one Analytics Engine point per load:
the site (the `Origin` a module script sends, else the `Referer`'s origin), the version, the country. Every other file
never runs the Worker (static assets: free, no request limit).

Workers Free allows 100,000 Worker requests a day. A version's `march.js` is cached by browsers for a year, so only
first loads per visitor count, not page views. Past that limit the requests that run the Worker fail until the next day
(so `march.js` would not load): before traffic comes near it, move to Workers Paid ($5 a month, 10 million requests), or
drop `run_worker_first` (no usage notes, nothing can fail).

## First deploy

1. marchjs.com in the Cloudflare account (its DNS on Cloudflare).
2. `npx wrangler login` (the account that holds marchjs.com).
3. `npm run deploy:cdn`: the Worker `marchjs-cdn`, the custom domain `cdn.marchjs.com` and the Analytics Engine
   dataset `marchjs_cdn_usage` are created by the deploy.
