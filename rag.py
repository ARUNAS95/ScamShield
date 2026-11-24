"""ScamShield guide search: metadata search over the local scam guide.

It is keyword retrieval with metadata rules, written in plain Python like
the rest of the course code (no vector database, no embeddings).

    1. Keyword score: word overlap between the query and each guide entry,
       where rare words count more (a small version of BM25).
    2. Metadata rules:
       * filters the model asks for (org, scam_type) remove other entries
       * entries whose red_flags match warning signs Python found get a boost
       * entries about a different organization get a lower score

Try a search from the command line:
    python rag.py "gift card medicare"
"""

import json
import math
import re
import sys
from pathlib import Path


# ------------------------------------------------------------------------
# 1. Settings
# ------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
GUIDE_FILE = HERE / 'data' / 'scam_guide.json'

TOP_K = 2
MIN_SCORE = 0.12          # below this, a match is too weak to count as evidence
FLAG_BOOST = 0.15         # added per red flag shared with the message
MAX_FLAG_BOOST = 0.30
OTHER_ORG_PENALTY = 0.5   # entry is about a different organization -> score x 0.5

SCAM_TYPES = ['impersonation', 'lookalike_site', 'delivery', 'grandparent', 'account_takeover',
              'prize', 'payment_scam', 'hacked_contact', 'bank', 'ai_manipulation', 'callback',
              'legit_pattern', 'pressure']

# Common words that do not help a search.
STOP_WORDS = set('''a an and are as at be by can do does for from has have i if in is it
its me my no not of on or our so than that the their them then there they this to
up us was we what when will with you your'''.split())


# ------------------------------------------------------------------------
# 2. Loading the guide
# ------------------------------------------------------------------------

def load_guide(path=GUIDE_FILE):
    """Return the list of guide entries. Raises an error if the file is missing."""
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)['entries']


def entry_text(entry):
    # The text we search over: title, body, and the organizations it is about.
    return entry['title'] + '. ' + entry['text'] + ' ' + ' '.join(entry['orgs'])


# ------------------------------------------------------------------------
# 3. Keyword score (a small, simple version of BM25)
# ------------------------------------------------------------------------

def tokenize(text):
    words = re.findall(r'[a-z0-9]+', text.lower())
    kept = []
    for word in words:
        if word not in STOP_WORDS and len(word) > 1:
            # Very small stemming so "cards" matches "card".
            if len(word) > 4 and word.endswith('s'):
                word = word[:-1]
            kept.append(word)
    return kept


def keyword_scores(query, entries):
    """Return {entry_id: score between 0 and 1} using word overlap.

    Rare words count more than common words (that is the BM25 idea)."""
    query_words = set(tokenize(query))
    entry_words = {}
    document_count = {}
    for entry in entries:
        words = set(tokenize(entry_text(entry)))
        entry_words[entry['id']] = words
        for word in words:
            document_count[word] = document_count.get(word, 0) + 1

    total = len(entries)
    raw = {}
    for entry in entries:
        score = 0.0
        for word in query_words:
            if word in entry_words[entry['id']]:
                # Inverse document frequency: rare words are worth more.
                score += math.log(1 + total / document_count[word])
        raw[entry['id']] = score

    best = max(raw.values()) if raw else 0
    scores = {}
    for entry_id in raw:
        scores[entry_id] = raw[entry_id] / best if best > 0 else 0.0
    return scores


# ------------------------------------------------------------------------
# 4. The search used by the agent's search_scam_guide tool
# ------------------------------------------------------------------------

def sort_key(candidate):
    score, entry, why = candidate
    return (-score, entry['id'])


def search(query, entries, filters=None, found_flags=None, claimed_orgs=None):
    """Search the guide and return a list of up to TOP_K matches:
        [{id, title, score, scam_type, orgs, red_flags, severity, advice, why}]

    filters      - metadata filters chosen by the model, e.g. {"org": "Medicare"}
    found_flags  - flag names Python already found in the message
    claimed_orgs - organizations the message claims to be from
    """
    if filters is None:
        filters = {}
    if found_flags is None:
        found_flags = []
    if claimed_orgs is None:
        claimed_orgs = []

    keyword = keyword_scores(query, entries)
    candidates = []
    for entry in entries:
        # Metadata filters requested by the model.
        wanted_org = filters.get('org')
        if wanted_org and entry['orgs'] and wanted_org not in entry['orgs']:
            continue
        wanted_type = filters.get('scam_type')
        if wanted_type and entry['scam_type'] != wanted_type:
            continue

        score = keyword[entry['id']]
        why = ['text match %.2f' % score]

        # Boost entries whose red flags match warning signs Python found.
        shared = []
        for flag in entry['red_flags']:
            if flag in found_flags:
                shared.append(flag)
        if shared:
            score += min(MAX_FLAG_BOOST, FLAG_BOOST * len(shared))
            why.append('shares red flags ' + ', '.join(shared))

        # Lower entries about an organization the message does not claim.
        if entry['orgs'] and claimed_orgs:
            same_org = False
            for org in entry['orgs']:
                if org in claimed_orgs:
                    same_org = True
            if not same_org:
                score *= OTHER_ORG_PENALTY
                why.append('about a different organization')

        candidates.append((score, entry, why))

    # Highest score first; ties broken by entry id so results are repeatable.
    candidates.sort(key=sort_key)

    matches = []
    for score, entry, why in candidates[:TOP_K]:
        if score < MIN_SCORE:
            continue
        matches.append({
            'id': entry['id'],
            'title': entry['title'],
            'score': round(score, 3),
            'scam_type': entry['scam_type'],
            'orgs': entry['orgs'],
            'red_flags': entry['red_flags'],
            'severity': entry['severity'],
            'advice': entry['advice'],
            'why': '; '.join(why),
        })
    return matches


# ------------------------------------------------------------------------
# 5. Command line: try a search
# ------------------------------------------------------------------------

if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(json.dumps(search(' '.join(sys.argv[1:]), load_guide()), indent=2))
    else:
        print('Usage: python rag.py "your search words"')
