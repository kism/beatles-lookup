import { capitalise, el, infobox, listOf, navLink, section, typeLabel } from './dom'
import type { Song } from './songs'

// "Lennon–McCartney", "McCartney (with Lennon)", "George Harrison – lead guitar", "Harrison & Starkey" (Ringo's
// real surname, in some credits), but not another first name with the surname, like "Linda McCartney",
// "Julia Lennon" or "Maureen Starkey"
const MENTION = /(?<![A-Z][a-z]+ )\b(?:(?:John|Paul|George|Ringo) )?(Lennon|McCartney|Harrison|Starr|Starkey)\b/g

// Link each Beatle mentioned (on a song page, the release tables, the songwriting tables) to their slice of the
// songwriting page, leaving text that's already inside a link alone, and the Beatles in skip (the slice being shown)
export function linkMembers(root: Element, skip: string[] = []): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.search(MENTION) !== -1 && !text.parentElement?.closest('a, button')) texts.push(text)
  }
  for (const text of texts) {
    const fragment = document.createDocumentFragment()
    let last = 0
    for (const m of text.data.matchAll(MENTION)) {
      const member = m[1].toLowerCase().replace('starkey', 'starr')
      if (skip.includes(member)) continue
      fragment.append(text.data.slice(last, m.index), navLink(`/songwriting?writer=${member}`, m[0]))
      last = m.index + m[0].length
    }
    fragment.append(text.data.slice(last))
    text.replaceWith(fragment)
  }
}

// The song page as a Wikipedia-style article: title, infobox, lead, then sections
export function article(song: Song): Node[] {
  // The quote that the writer attribution is based on becomes footnote [1]
  const ref = () => {
    const sup = el('sup', 'reference')
    sup.append(el('a', '', { href: '#cite-1', textContent: '[1]' }))
    return sup
  }
  const italic = (text: string) => el('i', '', { textContent: text })
  // Early recordings note who they were really by, e.g. "by the Quarrymen; mono" or "by Tony Sheridan and the Beat Brothers"
  const artist =
    song.note
      ?.split('; ')
      .find((part) => part.startsWith('by '))
      ?.slice(3) ?? 'the Beatles'
  const writtenBy = song.writers.startsWith('Traditional, ')
    ? `It is a traditional song, ${song.writers.slice('Traditional, '.length).replace(/^arr(\.|anged by) /, 'arranged by ')}.`
    : song.credit === song.writers
      ? `It was written by ${song.writers}.`
      : `Credited to ${song.credit}, it was written by ${song.writers}.`

  const { box, full, row } = infobox()
  full('infobox-title', song.title)
  // The albums and singles it's on (or, failing those, compilations), each cover with a caption
  const covers = el('div', 'infobox-covers')
  for (const release of song.releases) {
    const figure = el('figure')
    if (release.art) {
      const link = el('a', '', { href: release.art.full, target: '_blank' })
      link.append(
        el('img', '', { src: release.art.thumb, alt: `${release.title} cover (full size)`, width: 200, height: 200 }),
      )
      figure.append(link)
    }
    const caption = el('figcaption')
    caption.append(`${capitalise(typeLabel(release.type))}: `, italic(release.title))
    figure.append(caption)
    covers.append(figure)
  }
  full('infobox-image', covers)
  full('infobox-header', `Song by ${artist}`)
  row('Released', String(song.year))
  // Every release it's on, compilations included: "Help! (album, 1965)"
  const appearsOn = el('ul', 'appears-on')
  for (const r of song.appearsOn) {
    const li = el('li')
    li.append(navLink(`/releases#${r.id}`, italic(r.title)), ` (${typeLabel(r.type)}, ${r.year})`)
    appearsOn.append(li)
  }
  row('Appears on', appearsOn)
  if (song.recorded) row('Recorded', song.recorded)
  row('Writer(s)', song.writers, ...(song.writersQuote ? [ref()] : []))
  if (song.credit !== song.writers) row('Credited to', song.credit)
  row('Lead vocals', song.vocals)
  if (song.note) row('Notes', song.note)

  const lead = el('p')
  // "from the album Help! and the single Help! / I'm Down"
  const from = song.releases.flatMap((r, i) => [
    i === 0 ? '' : i === song.releases.length - 1 ? ' and ' : ', ',
    `the ${typeLabel(r.type)} `,
    italic(r.title),
  ])
  lead.append(el('b', '', { textContent: `"${song.title}"` }), ` is a song by ${artist} from `, ...from)
  lead.append(` (${song.year}). `, writtenBy, ...(song.writersQuote ? [ref()] : []))

  const sources = song.sources.map(({ url, label, uses }) => {
    const span = el('span')
    span.append(el('a', '', { href: url, textContent: label }), ` (${uses})`)
    return span
  })
  const references = el('ol', 'references')
  if (song.writersQuote) {
    const li = el('li', '', { id: 'cite-1' })
    li.append(`“${song.writersQuote}” `, el('a', '', { href: song.sources[0].url, textContent: 'Wikipedia' }))
    references.append(li)
  }

  return [
    el('h1', '', { textContent: song.title }),
    box,
    lead,
    ...(song.personnel.length ? section('Personnel', listOf(song.personnel)) : []),
    ...(song.writersQuote ? section('References', references) : []),
    ...section('Sources', listOf(sources)),
  ]
}
