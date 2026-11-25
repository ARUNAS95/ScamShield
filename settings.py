"""Settings, data loading and the one result shape every tool returns.
"""

import json
import os
from pathlib import Path


# ------------------------------------------------------------------------
# 1. Settings
# ------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / 'data'
EVIDENCE_DIR = HERE / 'evidence'
MISSING_GUIDE_FILE = DATA_DIR / 'missing_scam_guide.json'   # used by the guide_missing case

# Like the class notebooks: the model server and model name can be changed
# with environment variables, without editing the code.
OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://127.0.0.1:11434/api/chat')
MODEL = os.environ.get('SCAMSHIELD_MODEL', 'qwen3:8b')

MAX_STEPS = 10                 # step budget for one message
MAX_GATE_REJECTIONS = 2        # after this many rejected verdicts, Python decides
MAX_READABILITY_REWRITES = 1   # the model gets one chance to simplify its wording
NO_PROGRESS_LIMIT = 3          # this many rejected proposals in a row -> stop
MAX_SEARCHES = 3               # search_scam_guide calls allowed per message
MAX_ARGUMENT_LENGTH = 300
MAX_MESSAGE_LENGTH = 1000
HISTORY_KEEP = 10              # recent messages kept (the evidence ledger is never trimmed)
MAX_MODEL_RETRIES = 2          # a failed model call is tried again this many times
MODEL_RETRY_WAIT = 2           # seconds to wait before each retry (tests use 0)

LABELS = ['likely_scam', 'likely_safe', 'uncertain']
GOAL = ('Decide whether one text message is likely a scam, likely safe, or uncertain, '
        'and explain why in plain words an older adult can understand.')


# ------------------------------------------------------------------------
# 2. Loading the fictional data files
# ------------------------------------------------------------------------

def load_json(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def load_data():
    return {
        'organizations': load_json(DATA_DIR / 'organizations.json')['organizations'],
        'domains': load_json(DATA_DIR / 'domains.json'),
        'contacts': load_json(DATA_DIR / 'trusted_contacts.json'),
    }


def load_cases():
    return load_json(DATA_DIR / 'messages.json')['cases']


# ------------------------------------------------------------------------
# 3. One shape for every tool result (same as the Airways agent)
# ------------------------------------------------------------------------

def result(ok, message, data=None):
    if data is None:
        data = {}
    return {'ok': ok, 'message': message, 'data': data}
