"""Check that every curated quote is word for word in its Wikipedia article (as cached in data/cache/).

Run with: uv run scripts/data/verify.py
"""

import json
import re
import sys

from scrape import DATA, clean, wikitext


def words(s):
    # Compare words only: quote marks, punctuation and {{blockquote}} formatting differ between quote and article
    return ' '.join(re.findall(r"[\w'’–-]+", re.sub(r'\{\{\s*blockquote\s*\|', '', s, flags=re.I).replace('’', "'")))


if __name__ == '__main__':
    articles = {s['title']: s['article'] for s in json.loads((DATA / 'scraped' / 'songs.json').read_text())}
    curated = json.loads((DATA / 'curated.json').read_text())
    missing = []
    for title, edits in curated.items():
        if 'quote' not in edits:
            continue
        article = words(clean(wikitext(articles[title])))
        # A quote can be two sentences from different places in the article
        for sentence in re.split(r'[.!?]["”]?\s+(?=["“]?[A-Z])', edits['quote']):
            if words(sentence) not in article:
                missing.append(f'{title}: {sentence}')
    print('\n'.join(missing) or f'all {sum("quote" in e for e in curated.values())} quotes found in their articles')
    sys.exit(1 if missing else 0)
