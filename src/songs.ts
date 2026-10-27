import songs from './generated/songs.json'

export type Song = (typeof songs)[number]

// Ignore case, quotes and punctuation so "dont let me down" finds "Don't Let Me Down"
export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
export const byTitle = new Map<string, Song>(songs.map((song) => [normalize(song.title), song]))

// Like normalize but keeps spaces, so matches can be anchored to word starts
const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9 ]/g, '')}`

// Titles starting with the query first, then ones with a word starting with it. An empty query matches everything.
export function matches(query: string): Song[] {
  const q = words(query).trimEnd()
  const hits = songs.filter((song) => words(song.title).includes(q))
  return hits.sort((a, b) => +!words(a.title).startsWith(q) - +!words(b.title).startsWith(q))
}

export const songUrl = (title: string) => `/?song=${encodeURIComponent(title)}`

// Release tracks are matched by title; Anthology takes like "Help! (Take 2)" fall back to the bare title
export const songFor = (title: string) =>
  byTitle.get(normalize(title)) ?? byTitle.get(normalize(title.replace(/\s*\([^)]*\)$/, '')))
