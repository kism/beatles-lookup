// Pages: "/" is the search, "/releases" the release tables, "/songwriting" the songwriting pie
import { $ } from './dom'
import { input, render } from './search'
import { openSongwritingPage } from './songwriting'

history.scrollRestoration = 'manual'
export const page = () =>
  location.pathname === '/releases' ? 'releases' : location.pathname === '/songwriting' ? 'songwriting' : 'search'

export function route(): void {
  const current = page()
  $('search-page').hidden = current !== 'search'
  $('releases-page').hidden = current !== 'releases'
  $('songwriting-page').hidden = current !== 'songwriting'
  for (const tab of document.querySelectorAll<HTMLAnchorElement>('#tabs a')) {
    tab.toggleAttribute('aria-current', tab.dataset.page === current)
  }
  // The search page's title follows the song, so render() sets it
  if (current !== 'search') document.title = `${current === 'releases' ? 'Releases' : 'Songwriting'} - Beatles Lookup`
  // The search box is on every page, but only holds a song on the search page
  input.value = new URLSearchParams(location.search).get('song') ?? ''
  $('clear').hidden = !input.value
  if (current === 'search') render()
  if (current === 'songwriting') openSongwritingPage()
  // Back on the releases page lands where you left it
  window.scrollTo(0, current === 'releases' ? (history.state?.scroll ?? 0) : 0)
}

export function navigate(url: string, state: object | null = null): void {
  if (page() === 'releases') history.replaceState({ ...history.state, scroll: window.scrollY }, '')
  history.pushState(state, '', url)
  route()
}
