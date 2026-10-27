"""Fetch Wikipedia pages into data/cache/ (only what's missing) and extract data/scraped/*.json.

Run with: uv run scripts/data/scrape.py
"""

import calendar
import html
import itertools
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

from bs4 import BeautifulSoup
from build import norm

DATA = pathlib.Path(__file__).resolve().parents[2] / 'data'
CACHE = DATA / 'cache'
SCRAPED = DATA / 'scraped'
USER_AGENT = 'beatles-lookup/0.1 (https://github.com/kism/beatles-lookup; one-off data pull)'
WIKI = 'https://en.wikipedia.org/wiki/'

# (page, display title, type, which {{Track listing}} blocks are the UK release, multi-disc, date override)
ALBUMS = [
    ('Please_Please_Me', 'Please Please Me', 'album', None, False, None),
    ('With_the_Beatles', 'With the Beatles', 'album', None, False, None),
    ("A_Hard_Day's_Night_(album)", "A Hard Day's Night", 'album', [0, 1], False, None),
    ('Beatles_for_Sale', 'Beatles for Sale', 'album', None, False, None),
    ('Help!_(album)', 'Help!', 'album', [0, 1], False, None),
    ('Rubber_Soul', 'Rubber Soul', 'album', [0, 1], False, None),
    ('Long_Tall_Sally_(EP)', 'Long Tall Sally', 'ep', None, False, None),
    ('Revolver_(Beatles_album)', 'Revolver', 'album', None, False, None),
    ("Sgt._Pepper's_Lonely_Hearts_Club_Band", "Sgt. Pepper's Lonely Hearts Club Band", 'album', None, False, None),
    # The LP, not the UK double EP (the infobox date is the EP's)
    ('Magical_Mystery_Tour', 'Magical Mystery Tour', 'album', [4, 5], False, '1967-11-27'),
    ('The_Beatles_(album)', 'The Beatles ("White Album")', 'album', None, False, None),
    ('Yellow_Submarine_(album)', 'Yellow Submarine', 'album', None, False, None),
    ('Abbey_Road', 'Abbey Road', 'album', None, False, None),
    ('Let_It_Be_(album)', 'Let It Be', 'album', None, False, None),
    ('A_Collection_of_Beatles_Oldies', 'A Collection of Beatles Oldies', 'compilation', None, False, None),
    ('Past_Masters', 'Past Masters', 'compilation', [0, 1], True, None),  # CD volumes one and two
    ('Anthology_1', 'Anthology 1', 'compilation', None, True, None),
    ('Anthology_2', 'Anthology 2', 'compilation', None, True, None),
    ('Anthology_3', 'Anthology 3', 'compilation', None, True, None),
]


# --- Fetching ---------------------------------------------------------------


def api(params, dest):
    # Cached MediaWiki API call; sleeps between real requests to stay inside rate limits
    if not dest.exists():
        q = urllib.parse.urlencode({**params, 'action': 'parse', 'redirects': 1, 'format': 'json', 'formatversion': 2})
        req = urllib.request.Request(f'https://en.wikipedia.org/w/api.php?{q}', headers={'User-Agent': USER_AGENT})
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(urllib.request.urlopen(req).read())
        time.sleep(1.5)
    return json.load(open(dest))['parse']


def page_name(article):
    return urllib.parse.unquote(article.split('#')[0])


def wikitext(article):
    page = page_name(article)
    return api({'page': page, 'prop': 'wikitext'}, CACHE / 'pages' / f'{page.replace("/", "_")}.json')['wikitext']


def rendered(page, name):
    return BeautifulSoup(api({'page': page, 'prop': 'text'}, CACHE / f'{name}.json')['text'], 'html.parser')


# --- Wikitext helpers -------------------------------------------------------


def clean(s):
    s = re.sub(r'\{\{nbsp\}\}', ' ', s, flags=re.I)
    s = re.sub(r'<ref[^>]*/>', '', s)
    s = re.sub(r'<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    for _ in range(3):
        s = re.sub(
            r'\{\{(?:sfn|efn|refn|harvnb|cite|r\b|citation|clarify|which|when|dubious)[^{}]*\}\}',
            '',
            s,
            flags=re.I,
        )
    s = re.sub(r'\{\{(?:nowrap|small)\|([^{}]*)\}\}', r'\1', s, flags=re.I)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'''?", '', s)
    s = re.sub(r'\{\{(?:snd|spaced ndash)\}\}', ' – ', s, flags=re.I)
    s = s.replace('&nbsp;', ' ').replace('{{ndash}}', '–')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def section(wt, *names):
    for name in names:
        m = re.search(r'^(=+)\s*' + name + r'\s*\1\s*$', wt, flags=re.M | re.I)
        if m:
            rest = wt[m.end() :]
            end = re.search(rf'^={{2,{len(m.group(1))}}}[^=].*?=+\s*$', rest, flags=re.M)
            return rest[: end.start() if end else len(rest)]
    return None


KEEP_HEADER = re.compile(r'additional|production|beatles|wind|contributors|participants|musician', re.I)


def personnel(wt, anchor):
    # Covers link to the Beatles section of the article; only look there
    scope = (section(wt, re.escape(anchor)) or wt) if anchor else wt
    pers = section(
        scope,
        r'Personnel(?: and instrumentation)?',
        'Credits',
        r'Personnel \(Beatles version\)',
        'The Beatles version personnel',
        'Beatles version personnel',
    )
    if pers is None and anchor is None:
        pers = section(wt, r'Personnel.*?')
    # Keep all bullets (incl. "Additional musicians"), stop at tables or a header naming another version
    out = []
    for line in (pers or '').splitlines():
        t = line.strip()
        if t.startswith('*'):
            out.append(clean(t.lstrip('*').strip()))
        elif out and (
            t.startswith(('{|', '|', '!', '===')) or (t.startswith(("'''", ';')) and not KEEP_HEADER.search(t))
        ):
            break
    out = [strip_templates(p).strip() for p in out]
    return [p for p in out if p and re.search(r' [–-] |:', p)]


def strip_templates(s):
    # Remove {{...}} innermost-first, so nested footnotes like {{refn|...{{pb}}...}} go entirely
    while (stripped := re.sub(r'\{\{[^{}]*\}\}', '', s)) != s:
        s = stripped
    return s


MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
DATE = re.compile(r'(?P<d1>\d{1,2}) (?P<m1>[A-Za-z]+) (?P<y1>\d{4})|(?P<m2>[A-Za-z]+) (?P<d2>\d{1,2}), (?P<y2>\d{4})')


def released(wt):
    # The infobox "released" date, preferring one marked UK
    value = infobox(wt, 'released') or ''
    dates = []
    for d in DATE.finditer(value):
        month = MONTHS.get((d['m1'] or d['m2']).lower())
        if month:
            uk = 'UK' in value[d.end() :].split(';')[0]
            dates.append((not uk, f'{d["y1"] or d["y2"]}-{month:02}-{int(d["d1"] or d["d2"]):02}'))
    return min(dates)[1] if dates else None


def spelled_date(m):
    y, mo, d = [p.strip() for p in m.group(1).split('|') if '=' not in p][:3]
    return f'{int(d)} {calendar.month_name[int(mo)]} {y}'


def infobox(wt, field):
    # The first infobox's field as one line of text: list items joined with '; ', dates spelled out
    # Refs and comments go first: a multi-line {{cite}} would end the field early, and one inside a list stops the
    # list matching
    wt = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>|<!--.*?-->', '', wt, flags=re.S)
    m = re.search(r'^\s*\|\s*' + field + r'\s*=(.*?)(?=^\s*\||^\}\})', wt, re.M | re.S)
    if not m:
        return None
    value = re.sub(r'\{\{\s*(?:circa|c\.)\s*\|\s*(\d{4})\s*\}\}', r'c. \1', m.group(1), flags=re.I)
    value = re.sub(
        r'\{\{\s*(?:start|release|film|birth) ?date(?: and age)?\s*\|([^{}]*)\}\}', spelled_date, value, flags=re.I
    )
    # Its items are * bullets, and its closing }} on a line of its own already ended the field
    value = re.sub(r'\{\{\s*flatlist\s*\|', '', value, flags=re.I)
    value = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', value)  # links first, so their | doesn't split a list
    value = re.sub(
        r'\{\{\s*(?:hlist|ubl|unbulleted list)\s*\|([^{}]*)\}\}', lambda m: m[1].replace('|', '; '), value, flags=re.I
    )
    items = [clean(x).strip(' ;') for x in re.split(r'<br\s*/?>|^\s*\*', value, flags=re.M)]
    return '; '.join(x for x in items if x) or None


# --- Tidying table cells -------------------------------------------------------


def join(cell):
    # Cells are joined on <br> as ' | '; rejoin as prose
    parts = [p.strip(' †') for p in cell.split(' | ')]
    parts = [p for p in parts if p]
    if not parts:
        return ''
    out = parts[0]
    for prev, p in itertools.pairwise(parts):
        out += (' ' if p[0].islower() or p[0] == '(' or prev.endswith(('/', '.')) else ', ') + p
    return out


def names(s):
    xs = s.split(', ')
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' & ' + xs[-1]


def tidy_quotes(s):
    s = re.sub(r'" (.*?) "', r'"\1"', s)
    return re.sub(r'\( | \)', lambda m: m.group(0).strip(), s)


def text(el):
    for s in el.select('sup'):
        s.decompose()
    for br in el.find_all('br'):
        br.replace_with(' | ')
    return re.sub(r'\s+', ' ', el.get_text(' ', strip=True)).replace(' ,', ',').strip()


# --- Songs ----------------------------------------------------------------


def vocals_of(cell):
    vocals = join(text(cell))
    return vocals.replace(', ', ' and ') if re.fullmatch(r'\w+, \w+', vocals) else vocals


def scrape_songs():
    soup = rendered('List_of_songs_recorded_by_the_Beatles', 'list')
    songs = []
    for tr in soup.select('table.wikitable')[1].select('tr')[1:]:  # table 1 is the core catalogue
        cells = tr.find_all(['th', 'td'])
        a = cells[0].find('a')
        article = a['href'].removeprefix('/wiki/')
        title = re.sub(
            r'\s*" #.*$', '', text(cells[0]).split(' | ')[0].strip('"† ').replace('" †', '').strip('"')
        ).strip()
        vocals = vocals_of(cells[3])
        anchor = article.split('#')[1].replace('_', ' ') if '#' in article else None
        songs.append(
            {
                'title': title,
                'article': article,
                'album': tidy_quotes(join(text(cells[1]))),
                'year': int(text(cells[4])),
                'credit': names(join(text(cells[2]))),
                'vocals': vocals,
                'personnel': personnel(wikitext(article), anchor),
            }
        )
    return songs


# --- Releases ---------------------------------------------------------------


def track_titles(block):
    out = []
    for m in re.finditer(r'^\s*\|\s*title(\d+)\s*=[ \t]*(.*)$', block, re.M):
        t = clean(m.group(2)).strip().strip('"').strip()
        if t and not t.startswith('|'):
            out.append(t)
    return out


def details(wt):
    return {k: infobox(wt, k) for k in ('recorded', 'studio', 'producer')}


def scrape_albums():
    albums = []
    for page, title, kind, which, multi, date in ALBUMS:
        wt = wikitext(page)
        blocks = re.findall(r'\{\{\s*track ?list(?:ing)?\s*\n(.*?)\n\}\}', wt, re.S | re.I)
        tracks, n = [], 0
        for disc, block in enumerate([blocks[i] for i in which] if which else blocks, 1):
            for i, t in enumerate(track_titles(block), 1):
                n += 1
                tracks.append({'side': f'{disc}.{i}' if multi else str(n), 'title': t})
        date = date or released(wt)
        assert date, f'no release date for {title}'
        albums.append(
            {'title': title, 'type': kind, 'year': int(date[:4]), 'date': date} | details(wt) | {'tracks': tracks}
        )
    return albums


def scrape_singles(songs):
    soup = rendered('The_Beatles_singles_discography', 'singles')
    article_of = {norm(s['title']): s['article'] for s in songs}
    singles, year = [], ''
    for tr in soup.select('table.wikitable')[0].select('tr'):
        th = tr.find('th', scope='row')
        if not th:
            continue
        for s in th.select('sup'):
            s.decompose()
        t = re.sub(r'\s+', ' ', th.get_text(' ', strip=True))
        tds = tr.find_all('td')
        # Year cell is row-spanned, so it's only present on the first row of each year
        if tds and re.fullmatch(r'\d{4}', tds[0].get_text(strip=True)):
            year, tds = tds[0].get_text(strip=True), tds[1:]
        uk = tds[0].get_text(strip=True) if tds else ''
        # UK canon: 1962-70 singles that charted in the UK, not foreign/export/Sheridan releases
        if (
            not ('1962' <= year <= '1970')
            or not uk[:1].isdigit()
            or re.search(r'Not released in the UK|single|Tony Sheridan', t)
        ):
            continue
        # Quoted titles, each optionally followed by a (UK)/(US) marker; drop the US-only ones
        titles = [m.group(1).strip() for m in re.finditer(r'"\s*(.*?)\s*"(?:\s*\((UK|US)\))?', t) if m.group(2) != 'US']
        side = 'AA' if 'Double A-side' in t else None
        article = article_of[norm(titles[0])]
        wt = wikitext(article)
        singles.append(
            {
                'title': ' / '.join(titles),
                'type': 'single',
                'year': int(year),
                'date': released(wt),
                **details(wt),
                'tracks': [{'side': side or s, 'title': x} for s, x in zip('AB', titles, strict=False)],
            }
        )
    assert len(singles) == 22, f'expected the 22 UK singles, got {len(singles)}'
    return singles


# Albums whose tracks outside the core catalogue are added as songs (outtakes, covers, early recordings)
EXTRA_SONGS_FROM = ['Anthology_1']
BEATLES = {
    'John Lennon': 'Lennon',
    'Paul McCartney': 'McCartney',
    'George Harrison': 'Harrison',
    'Ringo Starr': 'Starr',
}


def writer_credit(raw, default):
    if not raw:
        return default
    raw = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', raw)  # links first, so their | doesn't split the hlist
    trad = re.match(r'\{\{\s*Trad\.?\s*\}\}\s*\{\{\s*arr\.?\s*\}\}\s*(.*)', raw, re.I)
    if trad:
        return f'Traditional, arr. {clean(trad.group(1))}'
    m = re.search(r'\{\{\s*hlist\s*\|(.*)\}\}', raw, re.I)
    people = [clean(p) for p in m.group(1).split('|')] if m else [clean(raw)]
    return names(', '.join(BEATLES.get(p, p) for p in people))


def scrape_extras(songs):
    known = {norm(s['title']) for s in songs}
    # Lead vocals come from the list page's table of songs outside the core catalogue
    other = rendered('List_of_songs_recorded_by_the_Beatles', 'list').select('table.wikitable')[3]
    vocals = {}
    for tr in other.select('tr')[1:]:
        cells = tr.find_all(['th', 'td'])
        vocals[norm(text(cells[0]).split(' | ')[0].replace('‡', ''))] = vocals_of(cells[3])
    extras = []
    for page in EXTRA_SONGS_FROM:
        wt = wikitext(page)
        album = page.replace('_', ' ')
        year = int(released(wt)[:4])
        for block in re.findall(r'\{\{\s*track ?list(?:ing)?\s*\n(.*?)\n\}\}', wt, re.S | re.I):
            params = dict(re.findall(r'^\s*\|\s*(\w+?)\s*=[ \t]*(.*)$', block, re.M))
            default = 'Lennon–McCartney' if 'Lennon–McCartney' in params.get('all_writing', '') else ''
            for n in sorted({int(k[5:]) for k in params if re.fullmatch(r'title\d+', k)}):
                raw = params[f'title{n}']
                title = clean(raw).strip('"')
                # Spoken-word clips are in italics; catalogue songs already have their own entry
                if raw.startswith("''") or norm(title) in known:
                    continue
                link = re.match(r'\[\[([^|\]]+)', raw)
                article = link.group(1).replace(' ', '_') if link else None
                anchor = article.split('#')[1].replace('_', ' ') if article and '#' in article else None
                recorded = re.sub(r'\{\{\s*c\.\s*\|\s*(\d{4})\s*\}\}', r'c. \1', params.get(f'extra{n}', ''))
                extras.append(
                    {
                        'title': title,
                        'article': article,
                        'album': album,
                        'year': year,
                        'credit': writer_credit(params.get(f'writer{n}'), default),
                        'vocals': vocals[norm(title)],
                        'personnel': personnel(wikitext(article), anchor) if article else [],
                        # The track-listing note, e.g. "by the Quarrymen; mono" (the template splits it on ")(")
                        'note': clean(params.get(f'note{n}', '')).replace(') (', '; ') or None,
                        'recorded': clean(recorded) or None,
                        'listedOn': [WIKI + page, WIKI + 'List_of_songs_recorded_by_the_Beatles'],
                    }
                )
    return extras


def scrape_members():
    # Each Beatle's birth date, birthplace and instruments, from the infobox on their article
    members = {}
    for name, surname in BEATLES.items():
        wt = wikitext(name.replace(' ', '_'))
        instruments = infobox(wt, 'instruments')
        assert instruments, f'no instruments for {name}'
        members[surname.lower()] = {
            'name': name,
            'born': infobox(wt, 'birth_date'),
            'birthPlace': infobox(wt, 'birth_place'),
            'instruments': instruments.split('; '),
        }
    return members


def scrape_band():
    # The band's origin, genres and years active, from the infobox on its article
    wt = wikitext('The Beatles')
    band = {'origin': infobox(wt, 'origin'), 'genres': infobox(wt, 'genre'), 'yearsActive': infobox(wt, 'years_active')}
    assert all(band.values()), f'missing band fields: {band}'
    return band


def write(name, data):
    SCRAPED.mkdir(parents=True, exist_ok=True)
    (SCRAPED / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    songs = scrape_songs()
    extras = scrape_extras(songs)
    write('songs.json', songs + extras)
    write('releases.json', scrape_albums() + scrape_singles(songs))
    write('members.json', scrape_members())
    write('band.json', scrape_band())
    print(f'scraped {len(songs)} catalogue songs and {len(extras)} extra songs')
