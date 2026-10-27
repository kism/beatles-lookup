# Beatles Lookup

[![Lint](https://github.com/kism/beatles-lookup/actions/workflows/lint.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/lint.yml)
[![Lint Python](https://github.com/kism/beatles-lookup/actions/workflows/lint_py.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/lint_py.yml)
[![Type Check](https://github.com/kism/beatles-lookup/actions/workflows/check_types.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/check_types.yml)
[![Build](https://github.com/kism/beatles-lookup/actions/workflows/build.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/build.yml)
[![site](https://img.shields.io/website?url=https%3A%2F%2Fbeatles.autist.network)](https://beatles.autist.network/)

Type a Beatles song, find out who actually wrote it, who sang it, and who played what. Or browse the UK releases from 1962 to 1970 with their track listings, or see how the songwriting splits between the four.

Everything comes from Wikipedia (CC BY-SA), and each song page links the articles it used. For how the data is built and checked, see [README_dev.md](README_dev.md).

## What's in it

- **Songs:** the 213 songs in the core catalogue. Credit, vocals, album and year come from [List of songs recorded by the Beatles](https://en.wikipedia.org/wiki/List_of_songs_recorded_by_the_Beatles). Personnel comes from each song's own article; most Personnel sections there come from Ian MacDonald's _Revolution in the Head_.
- **Extra songs:** the 21 songs on Anthology 1 outside the core catalogue: the Quarrymen, 1960 home demos, the 1961 Hamburg session with Tony Sheridan, the Decca audition, and BBC/TV performances. They come from the [Anthology 1](https://en.wikipedia.org/wiki/Anthology_1) track listing.
- **Who actually wrote it:** as opposed to the official Lennon–McCartney credit. Each one is backed by a sentence quoted word for word from the song's article, shown as a footnote on the song page.
- **Releases:** the UK canon. That's 13 studio albums (Magical Mystery Tour as the LP), the 22 UK singles from 1962–70, the Long Tall Sally EP, A Collection of Beatles Oldies, Past Masters, and Anthology 1–3, each with its release date, recording dates, studio and producer.
- **Songwriting:** a pie of who wrote the songs, by the main writer in "who actually wrote it". Pick a slice to list its songs; each Beatle's slice has an infobox with their birth date, birthplace and instruments from their own article.

## Prerequisites

- Node, the version in `.nvmrc`. With [nvm](https://github.com/nvm-sh/nvm): `nvm use`
- [pnpm](https://pnpm.io/installation): `npm i -g pnpm`. The version is pinned in `packageManager` in `package.json`
- `python3`, which builds the data during `pnpm dev` and `pnpm build`
- [uv](https://docs.astral.sh/uv/), only for scraping, verifying and linting the Python

## Run

```bash
nvm use
pnpm install
pnpm dev
```

See [README_dev.md](README_dev.md) for the data, building, previewing and deploying.

## TODO

- Revolution, Revolution 1 and Revolution 9 are kinda one song.
