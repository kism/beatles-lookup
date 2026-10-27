import { $, capitalise, el, linkButton, navLink, typeLabel } from './dom'
import releases from './generated/releases.json'
import { navigate } from './router'
import { songFor, songUrl } from './songs'

// Each release under its year: its cover (linking to the original) beside the title and type, then the tracks.
// The links above the releases hide a type.
function releaseSection(release: (typeof releases)[number]): HTMLElement {
  const section = el('div', `release ${release.type}`, { id: release.id })

  const header = el('div', 'release-header')
  const caption = el('div', 'release-caption')
  const heading = el('div', 'release-heading')
  heading.append(
    el('h3', 'release-title', { textContent: release.title }),
    el('span', 'release-meta', { textContent: capitalise(typeLabel(release.type)) }),
  )
  caption.append(heading)
  const details = el('dl', 'release-details')
  const released = new Date(release.date).toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })
  for (const [label, value] of [
    ['Released', released],
    ['Recorded', release.recorded],
    ['Studio', release.studio],
    ['Producer', release.producer],
  ]) {
    if (value) details.append(el('dt', '', { textContent: label }), el('dd', '', { textContent: value }))
  }
  caption.append(details)
  // Lazy-loaded, so covers are only fetched as they scroll into view
  if (release.art) {
    const link = el('a', 'cover', { href: release.art.full, target: '_blank' })
    link.append(
      el('img', '', {
        src: release.art.thumb,
        alt: `${release.title} cover (full size)`,
        loading: 'lazy',
        width: 140,
        height: 140,
      }),
    )
    header.append(link)
  }
  header.append(caption)

  const table = el('table', 'wikitable') as HTMLTableElement
  const head = table.createTHead().insertRow()
  for (const label of ['#', 'Song', 'Written by', 'Sung by']) {
    head.append(el('th', '', { scope: 'col', textContent: label }))
  }

  const body = table.createTBody()
  for (const track of release.tracks) {
    const song = songFor(track.title)
    const row = body.insertRow()
    row.insertCell().textContent = track.side
    row.insertCell().append(song ? navLink(songUrl(song.title), track.title) : track.title)
    row.insertCell().textContent = song?.writers ?? ''
    row.insertCell().textContent = song?.vocals ?? ''
  }
  section.append(header, table)
  return section
}

// Open the releases page at one release, showing its type first if that's hidden
export function goToRelease(id: string): void {
  navigate('/releases')
  const release = document.getElementById(id)
  if (!release) return
  if (release.hidden) setTypeHidden(release.className.split(' ')[1], false)
  release.scrollIntoView()
}

// One filter link per group of types: "Hide albums | Hide singles and EPs | Hide compilations"
const FILTERS: [string, string[]][] = [
  ['albums', ['album']],
  ['singles and EPs', ['single', 'ep']],
  ['compilations', ['compilation']],
]

const filterButtons: Record<string, HTMLButtonElement> = {}

// Hide or show every release in a type's group, keeping its "Hide …"/"Show …" link in step
function setTypeHidden(type: string, hide: boolean): void {
  const [label, types] = FILTERS.find(([, ts]) => ts.includes(type)) as (typeof FILTERS)[number]
  for (const d of document.querySelectorAll<HTMLElement>(types.map((t) => `.release.${t}`).join())) d.hidden = hide
  filterButtons[label].textContent = `${hide ? 'Show' : 'Hide'} ${label}`
  hideEmptyYears()
}

// Above the releases, a line of links like 2004 Wikipedia's Recent changes options, each flipping to "Show …"
export function filterLinks(): (string | Node)[] {
  return FILTERS.flatMap(([label, types], i) => {
    filterButtons[label] = linkButton('', (b) => setTypeHidden(types[0], b.textContent?.startsWith('Hide') ?? false))
    // Compilations start hidden
    setTypeHidden(types[0], label === 'compilations')
    return i ? [' | ', filterButtons[label]] : [filterButtons[label]]
  })
}

// The releases page as a discography: a section per year, listed in the Contents box
export function yearSections(): HTMLElement[] {
  const years = new Map<number, typeof releases>()
  for (const r of releases) years.set(r.year, [...(years.get(r.year) ?? []), r])
  return [...years].map(([year, inYear]) => {
    const section = el('section', 'year', { id: `y${year}` })
    section.append(el('h2', '', { textContent: String(year) }), ...inYear.map(releaseSection))
    const li = el('li', '', { id: `toc-${year}` })
    li.append(el('a', '', { href: `#y${year}`, textContent: String(year) }))
    $('toc-years').append(li)
    return section
  })
}

// A year whose releases are all hidden disappears, along with its Contents entry
function hideEmptyYears(): void {
  for (const section of document.querySelectorAll<HTMLElement>('section.year')) {
    const empty = [...section.querySelectorAll<HTMLElement>('.release')].every((d) => d.hidden)
    section.hidden = empty
    $(`toc-${section.id.slice(1)}`).hidden = empty
  }
}
