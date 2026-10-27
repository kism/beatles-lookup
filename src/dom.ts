export const $ = (id: string) => document.getElementById(id) as HTMLElement

export const el = (tag: string, className = '', props: object = {}) =>
  Object.assign(document.createElement(tag), { className, ...props })

// As written mid-sentence ("the EP", "Hide albums"); capitalise() for the start of a label
export const typeLabel = (type: string) => (type === 'ep' ? 'EP' : type)

export const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1)

// A button that looks like a link: the release filters, the Contents [hide], the songwriting legend and toggles
export function linkButton(label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = el('button', 'link-button', { type: 'button', textContent: label }) as HTMLButtonElement
  button.addEventListener('click', () => onClick(button))
  return button
}

// A [show …]/[hide …] style toggle: the brackets are text, only the words are the link
export const toggle = (label: string, onClick: (button: HTMLButtonElement) => void) => [
  '[',
  linkButton(label, onClick),
  ']',
]

// A page link that routes without reloading (the data-nav click handler in main.ts)
export function navLink(href: string, ...content: (string | Node)[]): HTMLAnchorElement {
  const link = el('a', '', { href }) as HTMLAnchorElement
  link.setAttribute('data-nav', '')
  link.append(...content)
  return link
}

// A Wikipedia infobox: full-width cells (title, image, header bar) and label/value rows, added in order
export function infobox() {
  const box = el('table', 'infobox') as HTMLTableElement
  const full = (className: string, ...content: (string | Node)[]) => {
    const cell = el('th', className, { colSpan: 2 })
    cell.append(...content)
    box.insertRow().append(cell)
  }
  const row = (label: string, ...value: (string | Node)[]) => {
    const tr = box.insertRow()
    tr.append(el('th', '', { scope: 'row', textContent: label }))
    tr.insertCell().append(...value)
  }
  return { box, full, row }
}

export function section(title: string, ...content: Node[]): Node[] {
  return [el('h2', '', { textContent: title }), ...content]
}

export const listOf = (items: (string | Node)[]) => {
  const ul = document.createElement('ul')
  for (const item of items) {
    const li = document.createElement('li')
    li.append(item)
    ul.append(li)
  }
  return ul
}
