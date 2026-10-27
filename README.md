# Beatles Lookup

[![Lint](https://github.com/kism/beatles-lookup/actions/workflows/lint.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/lint.yml)
[![Lint Python](https://github.com/kism/beatles-lookup/actions/workflows/lint_py.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/lint_py.yml)
[![Type Check](https://github.com/kism/beatles-lookup/actions/workflows/check_types.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/check_types.yml)
[![Build](https://github.com/kism/beatles-lookup/actions/workflows/build.yml/badge.svg)](https://github.com/kism/beatles-lookup/actions/workflows/build.yml)
[![site](https://img.shields.io/website?url=https%3A%2F%2Fbeatles.autist.network)](https://beatles.autist.network/)

Type a Beatles song, find out who actually wrote it, who sang it, and who played what. Browse the UK releases from with their track listings, or see how the songwriting splits between the four.

Everything comes from Wikipedia (CC BY-SA), and each song page links the articles it used. For how the data is built and checked, see [README_dev.md](README_dev.md).

## What's in it

- **Songs:** All the songs that I consider the core catalogue. Credit, vocals, album and year come from [List of songs recorded by the Beatles](https://en.wikipedia.org/wiki/List_of_songs_recorded_by_the_Beatles). Personnel comes from each song's own article; most Personnel sections there come from Ian MacDonald's _Revolution in the Head_.
- **Who actually wrote it:** in the liner notes, Lennon and McCartney were generally combined into the 'Lennon–McCartney' credit. Each song has the 'real writer' and is backed by a sentence quoted word for word from the song's article, shown as a footnote on the song page.

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
