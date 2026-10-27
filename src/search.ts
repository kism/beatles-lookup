import { article, linkMembers } from './article'
import { $, el, navLink } from './dom'
import songs from './generated/songs.json'
import { byTitle, matches, normalize, type Song, songUrl } from './songs'

export const input = $('song') as HTMLInputElement

export function pick(song: Song): void {
  input.value = song.title
  update()
  window.scrollTo(0, 0)
}

// The search page as a Wikipedia category: every song under its first letter, in columns
const categoryItems = new Map<Song, HTMLElement>()

export function categoryGroups(): HTMLElement[] {
  const groups = new Map<string, Song[]>()
  for (const song of [...songs].sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)))) {
    const first = normalize(song.title)[0].toUpperCase()
    const letter = /\d/.test(first) ? '0–9' : first
    groups.set(letter, [...(groups.get(letter) ?? []), song])
  }
  return [...groups].map(([letter, inGroup]) => {
    const group = el('div', 'category-group')
    const ul = el('ul')
    for (const song of inGroup) {
      // Real links, as on Wikipedia, so they can be opened in a new tab
      const li = el('li')
      li.append(navLink(songUrl(song.title), song.title))
      categoryItems.set(song, li)
      ul.append(li)
    }
    group.append(el('h3', '', { textContent: letter }), ul)
    return group
  })
}

// Typing hides the songs that don't match, and any letter left empty
function filterCategory(): void {
  const shown = new Set(matches(input.value))
  for (const [song, li] of categoryItems) li.hidden = !shown.has(song)
  for (const group of document.querySelectorAll<HTMLElement>('.category-group')) {
    group.hidden = [...group.querySelectorAll('li')].every((li) => li.hidden)
  }
  const n = shown.size
  $('count').textContent = n
    ? `The following ${n === 1 ? 'page is' : `${n} pages are`} in this category, out of ${songs.length} total.`
    : `No pages in this category match "${input.value}".`
}

// Draw the search page for the current input, returning the song shown, if any
export function render(): Song | undefined {
  const song = byTitle.get(normalize(input.value))
  $('result').hidden = !song
  $('home').hidden = !!song
  $('category').hidden = !!song
  if (song) {
    $('result').replaceChildren(...article(song))
    linkMembers($('result'))
  }
  $('clear').hidden = !input.value
  if (!song) filterCategory()
  return song
}

// Draw, and keep the URL in step with what's typed (keeping any from-releases state)
export function update(): void {
  const song = render()
  history.replaceState(history.state, '', song ? songUrl(song.title) : '/')
}
