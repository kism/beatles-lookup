import { linkMembers } from './article'
import { $, navLink, toggle } from './dom'
import songs from './generated/songs.json'
import { filterLinks, goToRelease, yearSections } from './releases'
import { navigate, page, route } from './router'
import { categoryGroups, input, pick, update } from './search'
import { matches } from './songs'
import { chartShown } from './songwriting'

// Typing on another page goes to the search page, keeping what was typed
input.addEventListener('input', () => {
  if (page() !== 'search') {
    const typed = input.value
    navigate('/')
    input.value = typed
  }
  update()
})
$('clear').addEventListener('click', () => {
  input.value = ''
  if (page() === 'search') update()
  else $('clear').hidden = true
  input.focus()
})
input.addEventListener('keydown', (e) => {
  const first = matches(input.value)[0]
  if (e.key === 'Enter' && input.value.trim() && first) pick(first)
})
// Esc from anywhere jumps to the search box with its text selected, ready to type over
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  input.focus()
  input.select()
})

$('intro').append(
  `Look up who wrote, sang and played on any of ${songs.length} Beatles songs. Pick one below, type to narrow the list, or `,
  navLink('/releases', 'browse the releases'),
  '.',
)
$('letters').append(...categoryGroups())
$('releases').append(...yearSections())
linkMembers($('releases'))
$('filters').append(...filterLinks())
// The Contents box's [hide]/[show], as on 2004 Wikipedia: only the word in brackets is the link
$('toc-toggle').append(
  ...toggle('hide', (button) => {
    const list = $('toc-years')
    list.hidden = !list.hidden
    button.textContent = list.hidden ? 'show' : 'hide'
  }),
)

// One click handler for links: page links (data-nav) route without reloading; in-page links (footnotes,
// Contents) scroll without touching the URL, since a hash change would re-run route() and scroll to the top
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest?.('a')
  // Modified clicks (new tab, new window) are left to the browser
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (a.hasAttribute('data-nav')) {
    e.preventDefault()
    // A link to one release ("Appears on"): open the releases page there
    if (a.pathname === '/releases' && a.hash) goToRelease(a.hash.slice(1))
    // Back to the releases page you came from, keeping its scroll position
    else if (a.pathname === '/releases' && history.state?.from === 'releases') history.back()
    // A Beatle's name on the songwriting page keeps the chart as it is and pans down to their songs
    else if (page() === 'songwriting' && a.pathname === '/songwriting' && a.search) {
      const y = window.scrollY
      if (a.search !== location.search) navigate(a.pathname + a.search, { chart: chartShown() })
      window.scrollTo(0, y)
      document.getElementById('songs-by')?.scrollIntoView({ behavior: 'smooth' })
    }
    // Songs opened from the releases page remember it, so the Releases link goes back to where you were
    else if (a.pathname + a.search !== location.pathname + location.search)
      navigate(a.pathname + a.search, page() === 'releases' ? { from: 'releases' } : null)
  } else if (a.getAttribute('href')?.startsWith('#')) {
    e.preventDefault()
    document.getElementById(a.getAttribute('href')?.slice(1) ?? '')?.scrollIntoView()
  }
})
window.addEventListener('popstate', route)

route()
// Ready to type over on load, as after Esc, without undoing route()'s scroll
input.focus({ preventScroll: true })
input.select()
