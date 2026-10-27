// The songwriting page: a pie of who wrote the songs. Picking a slice lists its songs chronologically below. A
// Beatle's slice also lists the songs they co-wrote, with an infobox for them.

// Members and band are used as scraped, so they're imported straight from data/scraped/
import band from '../data/scraped/band.json'
import members from '../data/scraped/members.json'
import { linkMembers } from './article'
import { $, el, infobox, linkButton, navLink, toggle } from './dom'
import releases from './generated/releases.json'
import songs from './generated/songs.json'
import { type Song, songUrl } from './songs'

type Member = (typeof members)[keyof typeof members]
const BEATLES = Object.keys(members)

// Pictures in public/art/members/: a .webp (shortest side 400 px, from `pnpm art`) linking to the original .jpg, named after the Beatle
const picture = (name: string) => {
  const slug = name.toLowerCase().replace(' ', '-')
  return { thumb: `/art/members/${slug}.webp`, full: `/art/members/${slug}.jpg` }
}
const NOT_SMOKING = {
  thumb: '/art/members/john-lennon-not-smoking.webp',
  full: '/art/members/john-lennon-not-smoking-full.webp',
}

// The slices, in pie order, each with its colour (checked for colour-blind separation)
const SLICES = [
  { key: 'lennon', label: 'Lennon', color: '#2a78d6' },
  { key: 'mccartney', label: 'McCartney', color: '#eb6834' },
  { key: 'lennon-mccartney', label: 'Lennon & McCartney', color: '#1baf7a' },
  { key: 'harrison', label: 'Harrison', color: '#eda100' },
  { key: 'starr', label: 'Starr', color: '#e87ba4' },
  { key: 'together', label: 'Other Beatle combinations', color: '#008300' },
  { key: 'covers', label: 'Other writers', color: '#a0a0a0' },
]

// The main writer is the part before any qualifier: "Lennon, with McCartney" and "Lennon, McCartney claims the
// melody" are Lennon's, but "Lennon, McCartney, Harrison & Starr" is all four's. "Traditional, …" is a cover.
const mainWriters = (song: Song) => {
  const main = song.writers.split(/, (?=[a-z]|\S+ [a-z])/)[0].toLowerCase()
  return BEATLES.filter((m) => main.includes(m))
}

function sliceOf(song: Song): string {
  const who = mainWriters(song)
  if (who.length === 0) return 'covers'
  if (who.length === 1) return who[0]
  return who.join('-') === 'lennon-mccartney' ? 'lennon-mccartney' : 'together'
}

// Chronological: by year, then the date of its first release (a 1964 song first out on Past Masters goes at the
// end of 1964), then title
const dates = new Map(releases.map((r) => [r.id, r.date]))
const firstDate = (song: Song) => dates.get(song.releases[0]?.id) ?? String(song.year)
const sorted = [...songs].sort(
  (a, b) => a.year - b.year || firstDate(a).localeCompare(firstDate(b)) || a.title.localeCompare(b.title),
)
const bySlice = new Map(SLICES.map((s) => [s.key, [] as Song[]]))
for (const song of sorted) bySlice.get(sliceOf(song))?.push(song)
const count = (key: string) => bySlice.get(key)?.length ?? 0
// A Beatle's listing also has the songs they co-wrote, so those show under each of their writers
const listing = (key: string) =>
  key in members ? sorted.filter((s) => mainWriters(s).includes(key)) : (bySlice.get(key) ?? [])

// The caption's toggles, for this visit: covers (songs by other writers) and the co-written slices start hidden, so
// the pie compares the four
let showCovers = false
let showCoWritten = false
const CO_WRITTEN = ['lennon-mccartney', 'together']
const shownSlices = () =>
  SLICES.filter((s) => (showCovers || s.key !== 'covers') && (showCoWritten || !CO_WRITTEN.includes(s.key)))
const total = () => shownSlices().reduce((n, s) => n + count(s.key), 0)

// The chart starts hidden when the page is opened at a slice (from a name on a song page), so the songs come first.
// [hide chart]/[show chart] is kept in the history entry, so going back to the page keeps it.
let showChart = true

const selected = () => new URLSearchParams(location.search).get('writer') ?? ''
const selectedSlice = () => shownSlices().find((s) => s.key === selected())

function select(key: string): void {
  history.replaceState(history.state, '', `/songwriting?writer=${key}`)
  drawSongwritingPage()
}

// An SVG pie with white gaps between slices, as in Wikipedia's chart images
function pie(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '-1 -1 2 2')
  svg.setAttribute('class', 'pie')
  svg.setAttribute('aria-hidden', 'true')
  let angle = -Math.PI / 2
  for (const { key, label, color } of shownSlices()) {
    const turn = (count(key) / total()) * 2 * Math.PI
    const [x1, y1, x2, y2] = [Math.cos(angle), Math.sin(angle), Math.cos(angle + turn), Math.sin(angle + turn)]
    angle += turn
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', `M0 0L${x1} ${y1}A1 1 0 ${+(turn > Math.PI)} 1 ${x2} ${y2}Z`)
    path.setAttribute('fill', color)
    path.classList.toggle('selected', key === selected())
    const title = document.createElementNS(ns, 'title')
    title.textContent = `${label}: ${count(key)}`
    path.append(title)
    path.addEventListener('click', () => select(key))
    svg.append(path)
  }
  // Drawn last, so the slices after it don't cover its outline
  const chosen = svg.querySelector('.selected')
  if (chosen) svg.append(chosen)
  return svg
}

// The legend doubles as the keyboard way to pick a slice
function legend(): HTMLElement {
  const ul = el('ul', 'legend')
  for (const { key, label, color } of shownSlices()) {
    const n = count(key)
    const li = el('li')
    li.append(
      el('span', 'swatch', { style: `background: ${color}` }),
      linkButton(label, () => select(key)),
      ` – ${n} (${Math.round((n / total()) * 100)}%)`,
    )
    li.toggleAttribute('aria-current', key === selected())
    ul.append(li)
  }
  return ul
}

function memberInfobox(member: Member, key: string): HTMLTableElement {
  let { thumb, full: original } = picture(member.name)
  if (key === 'lennon') {
    // From the third time John is shown (counted per browser), there's a 1 in 3 chance he isn't smoking, and
    // once he isn't, he is for the next two times. With no rare visit yet, `rare` is 0, which also covers the first two
    let visits = 1
    let rare = 0
    try {
      visits = Number(localStorage.getItem('lennonVisits') ?? 0) + 1
      rare = Number(localStorage.getItem('lennonRareVisit') ?? 0)
      localStorage.setItem('lennonVisits', String(visits))
    } catch {}
    if (visits > rare + 2 && Math.random() < 1 / 3) {
      ;({ thumb, full: original } = NOT_SMOKING)
      try {
        localStorage.setItem('lennonRareVisit', String(visits))
      } catch {}
    }
  }
  const { box, full, row } = infobox()
  full('infobox-title', member.name)
  const link = el('a', '', { href: original, target: '_blank' })
  link.append(el('img', '', { src: thumb, alt: `${member.name} (full size)` }))
  full('infobox-image', link)
  full('infobox-header', 'Background information')
  row('Born', `${member.born}, ${member.birthPlace}`)
  row('Instruments', member.instruments.join(', '))
  const alone = count(key)
  row('Songs written', `${alone} alone, ${listing(key).length - alone} co-written`)
  return box
}

// The band's infobox, beside the chart. The group photo is in public/art/ rather than members/, so art.sh doesn't
// square-crop it.
function beatlesInfobox(): HTMLTableElement {
  const { box, full, row } = infobox()
  full('infobox-title', 'The Beatles')
  const link = el('a', '', { href: '/art/the-beatles.jpg', target: '_blank' })
  link.append(el('img', '', { src: '/art/the-beatles.webp', alt: 'The Beatles (full size)' }))
  full('infobox-image', link)
  full('infobox-header', 'Background information')
  row('Origin', band.origin)
  row('Genres', band.genres.split('; ').join(', '))
  row('Years active', band.yearsActive)
  row(
    'Members',
    ...Object.entries(members).flatMap(([key, m], i) => [
      ...(i ? [el('br')] : []),
      navLink(`/songwriting?writer=${key}`, m.name),
    ]),
  )
  row('Songs', String(songs.length))
  return box
}

function songTable(list: Song[]): HTMLTableElement {
  const table = el('table', 'wikitable') as HTMLTableElement
  const head = table.createTHead().insertRow()
  for (const label of ['Year', 'Song', 'Written by', 'First released on']) {
    head.append(el('th', '', { scope: 'col', textContent: label }))
  }
  const body = table.createTBody()
  for (const song of list) {
    const row = body.insertRow()
    row.insertCell().textContent = String(song.year)
    row.insertCell().append(navLink(songUrl(song.title), song.title))
    row.insertCell().textContent = song.writers
    const release = song.releases[0]
    const cell = row.insertCell()
    if (release) cell.append(navLink(`/releases#${release.id}`, el('i', '', { textContent: release.title })))
  }
  return table
}

export function drawSongwritingPage(): void {
  // A slice that's been hidden (or a writer= that names none) is dropped from the URL
  const slice = selectedSlice()
  if (!slice && selected()) history.replaceState(history.state, '', '/songwriting')
  const chart = el('figure', 'thumb')
  const caption = el('figcaption')
  const left = [showCovers ? '' : 'covers', showCoWritten ? '' : 'co-written songs'].filter(Boolean)
  caption.append(
    `Who wrote the ${total()} songs${left.length ? ` (not counting ${left.join(' or ')})` : ''}.`,
    el('br'),
    ...toggle(showCovers ? 'Hide covers' : 'Show covers', () => {
      showCovers = !showCovers
      drawSongwritingPage()
    }),
    ' ',
    ...toggle(showCoWritten ? 'Hide co-written' : 'Show co-written', () => {
      showCoWritten = !showCoWritten
      drawSongwritingPage()
    }),
  )
  chart.append(pie(), legend(), caption)
  // [hide chart]/[show chart] beside the title, like the Contents box's [hide], only with a slice to show instead
  const title = el('h1', '', { textContent: 'Songwriting ' })
  const chartToggle = el('span', 'heading-toggle')
  chartToggle.append(
    ...toggle(showChart ? 'hide chart' : 'show chart', () => {
      showChart = !showChart
      history.replaceState({ ...history.state, chart: showChart }, '')
      drawSongwritingPage()
    }),
  )
  if (slice) title.append(chartToggle)
  const lead = el('p', '', {
    // Always counts every slice, whichever the chart is showing
    textContent:
      `Most of the Beatles' ${songs.length} songs are credited to Lennon–McCartney, but the two mostly wrote ` +
      `apart: Lennon wrote ${count('lennon')}, McCartney ${count('mccartney')}, and ${count('lennon-mccartney')} ` +
      `together. Harrison wrote ${count('harrison')}, Starr ${count('starr')}, and ${count('together')} were ` +
      `written by other combinations of the band. The other ${count('covers')} are covers. Pick a slice or a ` +
      `writer in the legend to list their songs.`,
  })
  const content: Node[] = [title, ...(showChart || !slice ? [beatlesInfobox(), lead, chart] : [])]
  if (slice) {
    const member: Member | undefined = members[slice.key as keyof typeof members]
    content.push(el('h2', '', { id: 'songs-by', textContent: `Songs by ${member?.name ?? slice.label}` }))
    if (member) content.push(memberInfobox(member, slice.key))
    const table = songTable(listing(slice.key))
    // The Beatles in the slice being shown aren't linked: a Beatle's own name, both of Lennon & McCartney, or all
    // four in the other combinations
    linkMembers(table, member ? [slice.key] : slice.key === 'together' ? BEATLES : slice.key.split('-'))
    content.push(table)
  }
  $('songwriting-page').replaceChildren(...content)
}

export const chartShown = () => showChart

// Opening the page (not picking a slice on it) shows the chart only when there's no slice to show, unless this
// history entry remembers it being toggled
export function openSongwritingPage(): void {
  showChart = history.state?.chart ?? !selectedSlice()
  drawSongwritingPage()
}
