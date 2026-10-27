# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A static single-page site: type a Beatles song and see who wrote it, who sang it, and the personnel. Vite, with the Cloudflare Vite plugin (`vite.config.ts`), builds it into an assets-only Worker in `dist/` (`wrangler.jsonc`, served at `beatles.autist.network`). Deployment happens by linking the repo in Cloudflare Workers. Tooling follows `../cloudflare-page-template`. The package manager is pnpm (`packageManager` in `package.json`).

## Commands

- `pnpm dev`: builds the data, then starts the Vite dev server.
- `pnpm build`: runs `scripts/build.sh`. That builds the data, type-checks with tsc (`noEmit`), and then runs `vite build` into `dist/`. That also writes `dist/wrangler.json`, which `wrangler deploy` uses, so `wrangler.jsonc` has no `main` or `assets.directory`.
- `pnpm typecheck`: builds the data, then runs tsc.
- `pnpm preview`: serves `dist/` in workerd, as it would run deployed.
- `pnpm data`: `scripts/data/build.py` merges `data/scraped/` with `data/curated.json` into `src/generated/` (gitignored). It is stdlib Python and runs on the system `python3` (3.14+, hence `requires-python`), so CI and Cloudflare need python3 but not uv.
- `pnpm lint:py`: Ruff (lint and format check) and ty over `scripts/`, configured in `pyproject.toml`. `uv run ruff format` applies formatting. The Python is a uv project: `uv sync` installs bs4, ruff and ty into `.venv/`.
- `pnpm art`: `scripts/art.sh` (ImageMagick 6 `convert`) makes a 400×400 WebP thumbnail (`<release-slug>.webp`) next to each cover art original (`<release-slug>.{jpg,png}`) in `public/art/albums/` and `public/art/singles/`, and one with its shortest side 400 px, keeping the aspect ratio, for each member photo in `public/art/members/` (from `<name>.jpg` or `<name>-full.webp`). Both are committed and deployed: the page shows the thumbnail and links to the original. The slug is the release title, lowercased, with apostrophes dropped and other runs of non-alphanumerics turned into `-`.
- `pnpm scrape`: `scripts/data/scrape.py` (uv, bs4) fetches whatever is missing into `data/cache/` (gitignored) and rewrites `data/scraped/`.
- `pnpm verify`: `scripts/data/verify.py` (uv) checks that every curated `quote` is in its cached article, sentence by sentence, comparing words only.
- `pnpm lint`: `biome check`, which covers both linting and formatting. `pnpm format` applies the fixes.
- CI has one workflow per check in `.github/workflows/`: `lint.yml` (Biome), `lint_py.yml` (Ruff and ty), `check_types.yml` (tsc) and `build.yml`. `scripts/run-ci-local.sh` runs them all in order, formatting as it goes.
- pnpm only runs the dependency install scripts approved in `pnpm-workspace.yaml` (`allowBuilds`). If a new dependency needs one, `pnpm install` stops and names it; approve it with `pnpm approve-builds <package>`.
- There are no tests.

## Deploying

- Production is `beatles.autist.network`. That's the top-level config in `wrangler.jsonc`, deployed by Workers Builds from the linked repo.
- Non-production branches are deployed by Workers Builds with `wrangler preview` (needs the `previews` block) and served at `<branch>.beatles-preview.autist.network` (that route has `enabled: false, previews_enabled: true`) and on a workers.dev preview URL (`preview_urls`). Route changes only take effect after a production deploy.

## Build gotchas

- `scripts/build.sh` passes the git remote URL (with credentials stripped) and the HEAD sha to Vite as `VITE_SOURCE`.
  - Vite fills that into the `<!-- %VITE_SOURCE% -->` comment in `index.html`.
  - Keep the credential stripping if you change the script.
  - `.env.development` is the fallback for `pnpm dev`.
- `VITE_FAVICON` (`.env.development` and `.env.production`) is the SVG icon link in `index.html`: `favicon-dev.svg` (an orange copy) in dev, `favicon.svg` in production.

## Pages

- The front end is plain DOM in `src/`, with no framework: `dom.ts` (helpers), `songs.ts` (lookup and matching), `article.ts` (the song page), `search.ts` (the category list and search), `songwriting.ts` (the songwriting page), `router.ts` (`route`/`navigate`), `releases.ts`, and `main.ts`, which does the one-time setup and event listeners. Imports run one way only, in that order, with no cycles.
- There are three pages in the one `index.html`: `/` (search, with `?song=Title`), `/releases` and `/songwriting`. `route()` in `router.ts` shows the right `<main>` from `location`. It runs on load, on `popstate` and after `navigate()`, which uses `pushState`, so there are no reloads. `wrangler.jsonc` sets `not_found_handling: "single-page-application"` so `/releases` and `/songwriting` serve `index.html`. Vite's dev server already does this.
- A page opened from the releases page (a song, or a Beatle's songwriting page from a name in the track tables) gets history state `{ from: 'releases' }`, so any `a[data-nav]` link to `/releases` without a hash (the Releases tab, or the intro link) does `history.back()` rather than a new navigation. That returns to the same scroll position. Navigation is MonoBook-style tabs on the content box (`#tabs`), and `route()` marks the current one with `aria-current`. A single delegated click handler routes `data-nav` links. It also scrolls in-page `#` links (footnotes, Contents) without changing the URL, because a hash change would re-run `route()` and jump to the top. Before leaving the releases page, `navigate()` saves `scrollY` into its history entry, and `route()` restores it. `history.scrollRestoration` is `manual`.
- `/` without a song is a Wikipedia category page: every song as a link under its first letter, in CSS columns (`categoryGroups` in `search.ts`). Typing hides the songs that don't match (`filterCategory`, using `matches()`) and updates the count line.
- The search box sits in the `<header>` beside the tabs, on every page. Typing on another page first navigates to `/`. Enter opens the first match; Esc from anywhere focuses the box with its text selected.
- The songwriting page (`songwriting.ts`, `/songwriting?writer=<slice>`) is a Wikipedia-style SVG pie of who wrote the songs, with a legend. `sliceOf` takes the main writer (`writers` before a qualifier like ", with …") and gives one slice per Beatle, Lennon & McCartney together, other Beatle combinations, and other writers. Two links in the caption, for this visit only, drop slices and recount the percentages: [Show covers] brings back the other writers slice (`showCovers`) and [Show co-written] the two joint slices (`showCoWritten`). Both start hidden. Picking a slice (`replaceState`, as typing does) lists its songs below in a wikitable (a Beatle's list also has the songs from the joint slices they co-wrote, via `listing`), by year then first release date. A single Beatle's slice also gets an infobox with their picture from `public/art/members/` (a `<first-last>.webp` with its shortest side 400 px, from `pnpm art`, linking to the `.jpg`) and their birth date, birthplace and instruments from `data/scraped/members.json`. From the third time John is shown (a `localStorage` count), there is a 1 in 3 chance of `john-lennon-not-smoking.webp` instead, but not in the two times after it last appeared (`lennonRareVisit`). Opening a songwriting page with a slice (a name link, or a reload) hides the chart (`openSongwritingPage`); picking a slice on the page doesn't. A Beatle's name link on the songwriting page itself (the band infobox, the song tables) keeps the chart as it is (`chartShown`, passed as `chart` in the new history entry) and smooth-scrolls to the `#songs-by` heading (the click handler in `main.ts`). With a slice picked, a [hide chart]/[show chart] link beside the `h1` toggles it (with none, the chart is always shown), and is remembered as `chart` in the history entry, so going back keeps it. A `writer=` whose slice is hidden is dropped from the URL.
- Typing in the search box calls `replaceState`, keeping the current state. Back/forward only redraw (`render()`) and never rewrite history.

## Styling

- `src/style.css` styles the site after 2004 Wikipedia (the MonoBook skin): 12.7px sans-serif, a white bordered content box, headings over grey rules, wikitable-style tables, page links as tabs and orange footer rules. It has no dark mode and uses no Wikimedia images.

## Data

- The data layout and the Wikipedia sources are described in `README_dev.md`. Never hand-edit `data/scraped/` or `src/generated/`. Hand edits go in `data/curated.json`, keyed by the song's exact title. `build.py` exits if a curated title isn't in the scraped songs, or if a song is on none of the releases.
- Each curated entry overrides fields per song: `writers`, `quote` (the sentence from the song's article that `writers` is based on, copied word for word) and `personnel`.

### `src/generated/songs.json`

- `credit` is the official songwriting credit. `writers` is who actually wrote it, from `data/curated.json`; otherwise it is the credit with Starkey shown as Starr. The UI shows the credit only when the two differ.
- `writersQuote` is the curated `quote`, or null. Only Lennon–McCartney songs have one.
- Songs outside the core catalogue (from `EXTRA_SONGS_FROM` in `scrape.py`, currently Anthology 1) can have `recorded` and `note`. These are always null for catalogue songs.
- `sources` is a list of `{url, label, uses}` built in `build.py`. The UI renders it as-is.
- `releases` lists the releases the song is on, in release order, each as `{title, id, type, year, art}` (`releases_by_song` in `build.py`, matching track titles, so Anthology takes like "Help! (Take 2)" count). It has every album and single, and compilations only when the song is on nothing else. `appearsOn` is the full list, compilations included, shown in the infobox's "Appears on" row as `{title, id, type, year}`. Each entry links to `/releases#<id>`; `id` is `release-<slug>` (`release_id` in `build.py`), and each release element has it, and `goToRelease` opens the releases page there, first showing the release's type with `setTypeHidden` if it's hidden. The infobox stacks each cover vertically, with a caption, and the lead sentence names them all.
- The song page is a Wikipedia-style article (`article()` in `article.ts`): the song as `h1`, a right-floated `.infobox`, a lead sentence, then Personnel, References and Sources sections. `writersQuote` becomes footnote [1]. After it's drawn, `linkMembers` (in `article.ts`) turns every Lennon/McCartney/Harrison/Starr (or Starkey) mention outside a link into a link to their slice of the songwriting page, `/songwriting?writer=…`. `main.ts` runs it once over the release tables, and `songwriting.ts` over each song table, skipping the Beatles in the slice being shown (`skip`). The lead and infobox bar name the artist from `note` when it starts `by …`, e.g. the Quarrymen.
- `vocals` is a free-text string copied from Wikipedia, e.g. `McCartney (with Lennon)`.
- `personnel` is a list of plain strings. If the article had no Personnel section, it is empty and the UI hides it.
- `songs.ts` derives the `Song` type from the JSON, so changing a field shows up in tsc.

### `src/generated/releases.json`

- Each release has a `type` (`album`, `single`, `ep` or `compilation`) that sets its colour (`--album-color` etc. in `style.css`) and a list of `tracks` (`side` is the track number, `A`/`B`/`AA` for singles, or `disc.track`).
- `date` is the UK release date (ISO). `recorded`, `studio` and `producer` are the first infobox's fields on the release's article (the A-side's for singles) as one line of text (`infobox()` in `scrape.py`), or null. The release header shows them as a `dl.release-details` under the type tag.
- `art` is `{thumb, full}` (`/art/<folder>/<slug>.webp` and the original `.jpg`/`.png`) when both files exist, otherwise null. The folder is `public/art/singles/` for singles and `public/art/albums/` for albums, EPs and compilations.
- The releases page is a discography: a `section.year` per year (`yearSections`), listed in a Contents box (`#toc`) with a [hide]/[show] link (`#toc-toggle`). A year and its Contents entry are hidden when all its releases are (`hideEmptyYears`). Everything is always shown, with no expand/collapse. Each release (`releaseSection` in `releases.ts`) is its 140 px cover thumbnail, linking to the full-size original, beside the title with a type tag to its right, then the track table. Covers are `loading="lazy"`, so they're fetched as they scroll into view. Above them, `#filters` is a line of text links in the style of 2004 Wikipedia's Recent changes options (`filterLinks`). "Hide albums" (and so on) flips to "Show albums" and sets `hidden` on that type, then `hideEmptyYears`. Singles and EPs share one link ("Hide singles and EPs"); the groups are `FILTERS`. Compilations start hidden (set in `filterLinks`).
- Which album article blocks count as the UK release is set by `ALBUMS` in `scrape.py`. `scrape.py` asserts that the singles filter gives exactly 22, that every album has a release date, and that every Beatle has instruments.
- Tracks hold only a title. `songFor` in `songs.ts` looks each one up in the songs at runtime. Anthology outtakes, speech tracks and other songs outside the catalogue don't match, so they show as plain text.

### `data/scraped/members.json` and `band.json`

- Used as scraped, so `songwriting.ts` imports them straight from `data/scraped/` rather than through `src/generated/`.
- `members.json` is keyed by surname (`lennon`, `mccartney`, `harrison`, `starr`), each `{name, born, birthPlace, instruments}` from the infobox on the Beatle's article (`scrape_members` in `scrape.py`). `instruments` is a list, capitalised as on Wikipedia (only the first item).
- `band.json` is `{origin, genres, yearsActive}` from the infobox on The Beatles' article (`scrape_band` in `scrape.py`), for the band infobox on the songwriting page. `genres` is one `; `-separated string.
