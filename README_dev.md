# Beatles Lookup: development

## Setup

```sh
nvm use
pnpm install
```

pnpm only runs dependency install scripts that are approved in `pnpm-workspace.yaml` (`allowBuilds`). If a new
dependency needs one, `pnpm install` stops and names it, then approve it with `pnpm approve-builds <package>`.

## Commands

```sh
pnpm dev                     # build the data, then the vite dev server
pnpm lint                    # biome check (pnpm format to fix)
pnpm lint:py                 # ruff and ty over scripts/ (uv run ruff format to fix)
pnpm typecheck               # build the data, then tsc
pnpm build                   # scripts/build.sh: data, tsc, then vite build into dist/
pnpm preview                 # serve dist/ in workerd, as it would run deployed
pnpm data                    # rebuild src/generated/ from data/
pnpm scrape                  # fetch what's missing into data/cache/, rewrite data/scraped/
pnpm verify                  # check the curated quotes against the articles
pnpm art                     # cover art thumbnails
```

`scripts/run-ci-local.sh` runs everything the workflows do, in order, and formats while it's at it.

Vite doesn't typecheck, so `pnpm build` runs `tsc` first.

### Build-time values

`scripts/build.sh` sets `VITE_SOURCE` to `<repo> @ <sha>`, which ends up in an HTML comment at the top of the page.
`.env.development` is the fallback for `pnpm dev`. `VITE_FAVICON` swaps in `favicon-dev.svg` under `pnpm dev`, so dev
tabs stand out.

## Deploying

Link the repo in the Cloudflare dashboard (Workers & Pages → Create → Import a repository) with:

- Build command: `pnpm run build`
- Deploy command: `pnpm wrangler deploy`
- Non-production branch deploy command: `pnpm wrangler preview`

`pnpm build` writes `dist/wrangler.json` and `.wrangler/deploy/config.json`, which point `wrangler deploy` at the built
assets, so there's no `main` or `assets.directory` in `wrangler.jsonc`. To check what would be uploaded without
deploying:

```sh
pnpm build && pnpm wrangler deploy --dry-run
```

Production is served at <https://beatles.autist.network>. Non-production branches get a Preview at
`<branch>.beatles-preview.autist.network`, plus a per-version link at
`<version>-beatles-lookup.<subdomain>.workers.dev`.

### Custom domain

The domains are the `routes` in `wrangler.jsonc`. Deploys replace every custom domain on the Worker with that list,
so add domains there, not in the dashboard.

## Data

The site's data is built from Wikipedia (CC BY-SA) in two stages:

```
data/cache/          raw Wikipedia downloads (gitignored, re-fetched when missing)
data/scraped/        what the scraper extracted, as-is        ← pnpm scrape
data/curated.json    hand edits, keyed by song title
src/generated/       what the site imports (gitignored)       ← pnpm data (also part of dev and build)
```

- `pnpm data` (`scripts/data/build.py`, stdlib Python) merges `data/scraped/` with `data/curated.json` into `src/generated/songs.json` and `src/generated/releases.json`. The front end imports `data/scraped/members.json` and `band.json` directly, as they need no merging. It runs as part of `pnpm dev` and `pnpm build`, so you only need it on its own after editing the data.
- `pnpm scrape` (`scripts/data/scrape.py`, needs [uv](https://docs.astral.sh/uv/); dependencies are in `pyproject.toml`) downloads any pages missing from `data/cache/` and rewrites `data/scraped/`. Delete `data/cache/` first to pull fresh copies from Wikipedia. Review the diff of `data/scraped/` before committing.
- `pnpm verify` (`scripts/data/verify.py`) checks that every curated quote is in its article. See [Verifying the data](#verifying-the-data).

To fix or add something by hand, such as who wrote a song, edit `data/curated.json` instead of the scraped files. That way the edit survives the next scrape.

Cover art: put the original image in `public/art/albums/` (albums, EPs and compilations) or `public/art/singles/`, named after the full release title (e.g. `albums/sgt-peppers-lonely-hearts-club-band.jpg`, `singles/hey-jude-revolution.jpg`), and run `pnpm art`. That writes a 400×400 WebP thumbnail next to it.

### Where each part comes from

- **Songs:** the core catalogue table of [List of songs recorded by the Beatles](https://en.wikipedia.org/wiki/List_of_songs_recorded_by_the_Beatles) gives the title, the song's article, credit, lead vocals, album and year. Personnel comes from each song's own article.
- **Extra songs:** the [Anthology 1](https://en.wikipedia.org/wiki/Anthology_1) track listing gives the credit, recording date and note of each song outside the core catalogue. Lead vocals come from the list page's table of songs outside the core catalogue, and personnel from each song's article where it has one. Spoken-word clips are left out. Add more albums to `EXTRA_SONGS_FROM` in `scrape.py`.
- **Who actually wrote it:** `writers` in `data/curated.json`, with `quote`, the sentence in the song's article it is based on.
- **Releases:** album track listings come from each album's article (the `{{Track listing}}` blocks for the UK release, chosen in `ALBUMS` in `scrape.py`). Singles come from [The Beatles singles discography](https://en.wikipedia.org/wiki/The_Beatles_singles_discography): rows from 1962–70 that charted in the UK, leaving out foreign, export and Tony Sheridan releases. Recording dates, studio and producer come from the infobox of the album's article, or the A-side's article for a single, as does the release date unless `ALBUMS` sets it. Releases are sorted by release date. Tracks link to a song by title, and Anthology takes like "Help! (Take 2)" fall back to the bare title.
- **Members:** each Beatle's birth date, birthplace and instruments come from the infobox of their article (e.g. [John Lennon](https://en.wikipedia.org/wiki/John_Lennon)), into `data/scraped/members.json`.

### How it was grabbed

1. **Song list.** The list page's HTML is fetched through the [MediaWiki API](https://www.mediawiki.org/wiki/API:Parse) (`action=parse`). Its core catalogue table is parsed with BeautifulSoup into one row per song: title, link to the song's article, release, credit, lead vocals and year.
2. **Articles.** The wikitext of each song, album and member article is fetched through the same API, one request every 1.5 seconds to stay inside Wikipedia's rate limits. For covers, the link points at the Beatles section of the article (e.g. `Act_Naturally#The_Beatles_version`), so only that section is used.
3. **Personnel.** The bullet list under each article's `Personnel` heading is extracted and stripped of wiki markup. "Additional musicians" sub-lists are kept. Parsing stops at tables or at a heading for another version, so remixes and other artists' versions are skipped.
4. **Who actually wrote it.** For every song credited to Lennon–McCartney, the sentences about writing in the article were read by hand and `writers` was written from them, e.g. "McCartney, middle eight by Lennon". Harrison and Starr songs and covers use the official credit.
5. **Justification.** `quote` is copied word for word from the article. It started as the first sentence that mentions writing and names Lennon or McCartney. Where that was weak or missing, a better one (sometimes two) was chosen by hand.

## Verifying the data

Everything on the site is either extracted from Wikipedia by a script, or a hand edit in `data/curated.json` that is backed by a quote. Nothing in `data/scraped/` or `src/generated/` is edited by hand.

**On the site.** Each song page has a Sources section linking the Wikipedia articles it used and what each one was used for, e.g. the song's article for the personnel and the list page for the credit and vocals. Where `writers` differs from the official credit, footnote [1] quotes the sentence from the article it is based on, so you can find it there.

**Re-running the scraper.** `data/cache/` holds the raw MediaWiki API responses, and `scrape.py` turns them into `data/scraped/` the same way every time. To check the committed data against Wikipedia as it is today:

```sh
rm -rf data/cache
pnpm scrape
git diff data/scraped
```

An empty diff means Wikipedia still says what the site says. Any lines that do change are either edits on Wikipedia since the last scrape or changes to the scraper, and can be checked against the article history.

**Checking the quotes.** `pnpm verify` looks up each curated `quote` in its article (from `data/cache/`, fetching it if missing) and prints any sentence it can't find, exiting with an error. It compares words only, so quote marks and blockquote formatting don't matter, and a quote made of two sentences from different places is checked one sentence at a time. To check against the live articles, delete `data/cache/` first.

**Checks built into the scripts.**
- `scrape.py` asserts that the singles filter gives exactly the 22 UK singles, that every album has a release date, and that every Beatle has instruments.
- `build.py` exits if `data/curated.json` names a song that isn't in the scraped data (e.g. after a title changes on Wikipedia), or if a song is on none of the releases.

**What isn't checked by a script.**
- Whether `writers` is a fair reading of its quote. That was done by hand; the quote is there so you can judge it.
- Four `writers` edits have no quote: "Komm, gib mir deine Hand", "Sie liebt dich", "Maggie Mae" and "What Goes On".
- Six `personnel` lists are overridden in `data/curated.json`. "Bad Boy", "Dizzy Miss Lizzy", "Twist and Shout" and "You Really Got a Hold on Me" are covers whose article lists the original artist's line-up. "That'll Be the Day" and "Hallelujah, I Love Her So" are Anthology 1 tracks whose article personnel is for another recording.
