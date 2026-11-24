"""ScamShield metadata RAG: search the local scam-prevention guide.

This is the project's "innovation" piece. It is plain Python, like the rest
of the course code. There is no vector database and no numpy.

Three search modes (so eval.py can compare them):
    keyword          - word overlap only (the simple baseline)
    rag_no_metadata  - 50% meaning (embeddings) + 50% word overlap
    rag              - the same, plus metadata rules:
                       * filters the model asks for (org, scam_type)
                       * boost entries whose red_flags match flags Python found
                       * lower entries that are about a different organization

Embeddings come from the free local Ollama model nomic-embed-text.
If Ollama or the embedding cache is not available, the search falls back to
keyword mode and SAYS SO in its result (retrieval_mode = keyword_fallback).

Build the embedding cache once with:
    python rag.py --build
"""

import hashlib
import json
import math
import re
import sys
from pathlib import Path

import requests


# ------------------------------------------------------------------------
# 1. Settings
# ------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
GUIDE_FILE = HERE / 'data' / 'scam_guide.json'
EMBEDDINGS_FILE = HERE / 'data' / 'guide_embeddings.json'
EMBED_URL = 'http://127.0.0.1:11434/api/embed'
EMBED_MODEL = 'nomic-embed-text'

TOP_K = 2
MIN_SCORE = 0.12          # below this, a match is too weak to count as evidence
FLAG_BOOST = 0.15         # added per red flag shared with the message
MAX_FLAG_BOOST = 0.30
OTHER_ORG_PENALTY = 0.5   # entry is about a different organization -> score x 0.5

SEARCH_MODES = ['keyword', 'rag_no_metadata', 'rag']
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
    # The text we search over: title, body, and the readable metadata.
    return entry['title'] + '. ' + entry['text'] + ' ' + ' '.join(entry['orgs'])


def entry_hash(entry):
    # Used to notice when the guide changed but the embeddings were not rebuilt.
    return hashlib.sha256(entry_text(entry).encode('utf-8')).hexdigest()[:16]


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
# 4. Embeddings (meaning-based similarity) from local Ollama
# ------------------------------------------------------------------------

def embed_texts(texts, prefix):
    """Ask Ollama for embedding vectors. nomic-embed-text expects a prefix
    ("search_document: " or "search_query: ")."""
    inputs = []
    for text in texts:
        inputs.append(prefix + text)
    response = requests.post(EMBED_URL, json={'model': EMBED_MODEL, 'input': inputs}, timeout=60)
    response.raise_for_status()
    return response.json()['embeddings']


def cosine(a, b):
    dot = 0.0
    size_a = 0.0
    size_b = 0.0
    for i in range(len(a)):
        dot += a[i] * b[i]
        size_a += a[i] * a[i]
        size_b += b[i] * b[i]
    if size_a == 0 or size_b == 0:
        return 0.0
    return dot / (math.sqrt(size_a) * math.sqrt(size_b))


def build_embeddings(guide_path=GUIDE_FILE, out_path=EMBEDDINGS_FILE):
    entries = load_guide(guide_path)
    texts = []
    for entry in entries:
        texts.append(entry_text(entry))
    vectors = embed_texts(texts, 'search_document: ')
    cache = {'model': EMBED_MODEL, 'entries': {}}
    for i in range(len(entries)):
        cache['entries'][entries[i]['id']] = {'hash': entry_hash(entries[i]), 'vector': vectors[i]}
    with open(out_path, 'w', encoding='utf-8') as handle:
        json.dump(cache, handle)
    return len(entries)


def load_embeddings(entries, path=EMBEDDINGS_FILE):
    """Return ({entry_id: vector}, note). Returns (None, reason) if unusable."""
    try:
        with open(path, encoding='utf-8') as handle:
            cache = json.load(handle)
    except (OSError, ValueError):
        return None, 'embedding cache not found (run: python rag.py --build)'
    vectors = {}
    for entry in entries:
        saved = cache.get('entries', {}).get(entry['id'])
        if saved is None or saved.get('hash') != entry_hash(entry):
            return None, 'embedding cache is out of date (run: python rag.py --build)'
        vectors[entry['id']] = saved['vector']
    return vectors, 'ok'


# ------------------------------------------------------------------------
# 5. The search used by the agent's search_scam_guide tool
# ------------------------------------------------------------------------

def sort_key(candidate):
    score, entry, why = candidate
    return (-score, entry['id'])


def search(query, entries, mode='rag', filters=None, found_flags=None, claimed_orgs=None,
           embed_fn=None, vectors=None):
    """Search the guide and return a dict:
        {retrieval_mode, note, matches:[{id, title, score, scam_type, orgs,
                                          red_flags, severity, advice, why}]}

    filters      - metadata filters chosen by the model, e.g. {"org": "Medicare"}
    found_flags  - flag names Python already found in the message
    claimed_orgs - organizations the message claims to be from
    embed_fn     - function(texts, prefix) -> vectors (tests pass a fake one)
    vectors      - pre-loaded entry vectors (tests pass fake ones)
    """
    if filters is None:
        filters = {}
    if found_flags is None:
        found_flags = []
    if claimed_orgs is None:
        claimed_orgs = []
    if embed_fn is None:
        embed_fn = embed_texts
    if mode not in SEARCH_MODES:
        raise ValueError('unknown search mode: ' + str(mode))

    used_mode = mode
    note = ''
    keyword = keyword_scores(query, entries)

    # Meaning-based similarity, if we can get it.
    similarity = {}
    if mode != 'keyword':
        if vectors is None:
            vectors, cache_note = load_embeddings(entries)
            if vectors is None:
                used_mode = 'keyword_fallback'
                note = cache_note
        if vectors is not None:
            try:
                query_vector = embed_fn([query], 'search_query: ')[0]
                for entry in entries:
                    similarity[entry['id']] = cosine(query_vector, vectors[entry['id']])
            except Exception as error:
                used_mode = 'keyword_fallback'
                note = 'embedding model unavailable: ' + type(error).__name__

    use_metadata = (mode == 'rag')
    candidates = []
    for entry in entries:
        why = []

        # Metadata filters requested by the model (rag mode only).
        if use_metadata:
            wanted_org = filters.get('org')
            if wanted_org and entry['orgs'] and wanted_org not in entry['orgs']:
                continue
            wanted_type = filters.get('scam_type')
            if wanted_type and entry['scam_type'] != wanted_type:
                continue

        if used_mode in ('keyword', 'keyword_fallback'):
            score = keyword[entry['id']]
        else:
            score = 0.5 * similarity[entry['id']] + 0.5 * keyword[entry['id']]
        why.append('text match %.2f' % score)

        if use_metadata:
            shared = []
            for flag in entry['red_flags']:
                if flag in found_flags:
                    shared.append(flag)
            if shared:
                boost = min(MAX_FLAG_BOOST, FLAG_BOOST * len(shared))
                score += boost
                why.append('shares red flags ' + ', '.join(shared))
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
    return {'retrieval_mode': used_mode, 'note': note, 'matches': matches}


# ------------------------------------------------------------------------
# 6. Command line: build the cache or try a search
# ------------------------------------------------------------------------

if __name__ == '__main__':
    if '--build' in sys.argv:
        count = build_embeddings()
        print('Saved embeddings for', count, 'guide entries to', EMBEDDINGS_FILE)
    elif len(sys.argv) > 1:
        words = []
        for arg in sys.argv[1:]:
            if not arg.startswith('--'):
                words.append(arg)
        text = ' '.join(words)
        print(json.dumps(search(text, load_guide()), indent=2))
    else:
        print('Usage: python rag.py --build   |   python rag.py "your search words"')
