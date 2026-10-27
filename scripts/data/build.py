"""Merge data/scraped/ with the hand edits in data/curated.json into src/generated/*.json.

Stdlib only, so it can run as part of `pnpm build`.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
OUT = ROOT / 'src' / 'generated'
WIKI = 'https://en.wikipedia.org/wiki/'
ART = ROOT / 'public' / 'art'


def load(path):
    return json.loads((DATA / path).read_text())


def write(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def norm(title):
    # Match titles regardless of case and punctuation
    return re.sub(r'[^a-z0-9]', '', title.lower())


def build_songs(scraped, curated, releases):
    unknown = curated.keys() - {s['title'] for s in scraped}
    if unknown:
        sys.exit(f'data/curated.json has titles that are not in data/scraped/songs.json: {sorted(unknown)}')
    on_releases = releases_by_song(releases)

    songs = []
    for s in scraped:
        edits = curated.get(s['title'], {})
        quote = edits.get('quote')
        personnel = edits.get('personnel', s['personnel'])
        on = on_releases.get(norm(s['title']))
        if not on:
            sys.exit(f'{s["title"]} is on none of the releases in data/scraped/releases.json')
        featured = [r for r in on if r['type'] != 'compilation'] or on
        songs.append(
            {
                'title': s['title'],
                'year': s['year'],
                'credit': s['credit'],
                # Who actually wrote it; defaults to the official credit
                'writers': edits.get('writers', s['credit'].replace('Starkey', 'Starr')),
                # The sentence from the song's article that the curated writers is based on
                'writersQuote': quote,
                'vocals': s['vocals'],
                'personnel': personnel,
                # Only songs outside the core catalogue (e.g. Anthology 1 outtakes) have these
                'recorded': s.get('recorded'),
                'note': s.get('note'),
                'sources': sources(s, quote, personnel),
                # For the infobox covers and the lead: the albums and singles it's on, else the compilations
                'releases': featured,
                # Every release it's on, compilations included, for the infobox's "Appears on"
                'appearsOn': [{k: r[k] for k in ('title', 'id', 'type', 'year')} for r in on],
            }
        )
    return songs


def sources(s, quote, personnel):
    out = []
    if s['article']:
        uses = [quote and 'who wrote it', personnel and 'personnel']
        out.append(
            {
                'url': WIKI + s['article'],
                'label': f'Wikipedia: "{s["title"]}"',
                'uses': ', '.join(u for u in uses if u) or 'background',
            }
        )
    if 'listedOn' in s:
        album_page, list_page = s['listedOn']
        out.append({'url': album_page, 'label': f'Wikipedia: {s["album"]}', 'uses': 'credit, recording date'})
        out.append({'url': list_page, 'label': 'Wikipedia: List of songs recorded by the Beatles', 'uses': 'vocals'})
    else:
        out.append(
            {
                'url': WIKI + 'List_of_songs_recorded_by_the_Beatles',
                'label': 'Wikipedia: List of songs recorded by the Beatles',
                'uses': 'official credit, vocals, album, year',
            }
        )
    return out


def slug(title):
    # "Sgt. Pepper's Lonely Hearts Club Band" -> "sgt-peppers-lonely-hearts-club-band"
    return re.sub(r'[^a-z0-9]+', '-', title.lower().replace("'", '')).strip('-')


# The element id on the releases page, for links to one release
def release_id(title):
    return f'release-{slug(title)}'


def art(title, folder):
    # Cover art in public/art/albums/ or public/art/singles/: the original (<slug>.jpg/.png) and the
    # thumbnail from `pnpm art` (<slug>.webp)
    name = slug(title)
    full = next((p for ext in ('jpg', 'jpeg', 'png') if (p := ART / folder / f'{name}.{ext}').exists()), None)
    if not full or not (ART / folder / f'{name}.webp').exists():
        return None
    return {'thumb': f'/art/{folder}/{name}.webp', 'full': f'/art/{folder}/{full.name}'}


FOLDER = {'single': 'singles', 'album': 'albums', 'ep': 'albums', 'compilation': 'albums'}


def releases_by_song(releases):
    # Song (normalised title) -> every release it's on, in release order (releases are built, so already sorted).
    # Anthology takes like "Help! (Take 2)" count for the bare title.
    found = {}
    for r in releases:
        entry = {k: r[k] for k in ('title', 'id', 'type', 'year', 'art')}
        titles = {
            norm(t) for track in r['tracks'] for t in (track['title'], re.sub(r'\s*\([^)]*\)$', '', track['title']))
        }
        for title in titles:
            if entry not in found.setdefault(title, []):
                found[title].append(entry)
    return found


def build_releases(scraped):
    return [
        {
            **r,
            'id': release_id(r['title']),
            'art': art(r['title'], FOLDER[r['type']]),
        }
        for r in sorted(scraped, key=lambda r: r['date'])
    ]


if __name__ == '__main__':
    releases = build_releases(load('scraped/releases.json'))
    write('songs.json', build_songs(load('scraped/songs.json'), load('curated.json'), releases))
    write('releases.json', releases)
