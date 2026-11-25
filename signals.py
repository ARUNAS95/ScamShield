"""Text and link handling, and the warning-sign rules used by extract_signals.

No link is ever opened: links are only cleaned up and compared with a local list.
"""

import re
import unicodedata


# ------------------------------------------------------------------------
# 4. Small helpers for links, phone numbers and organizations
# ------------------------------------------------------------------------

# A link is any of these three shapes (upper or lower case):
#   1. anything that starts with http:// or https://
#   2. a number address like 192.168.10.45 (with an optional /path)
#   3. a web address: name.name with a 2 to 24 letter ending (.com, .shop,
#      .online, ...), with an optional /path. Any ending counts, so a new
#      ending is never missed; check_link marks endings it does not know as
#      'unknown', which already blocks likely_safe. Letters from ANY
#      alphabet count ([^\W_] = a letter or digit), so a link written with
#      Cyrillic look-alike letters ("аmazon.com") is still found.
#      An optional "name.com@" in front is kept, because
#      "medicare.gov@evil-login.ru" really goes to evil-login.ru.
# The "not after a letter, digit, dot, @ or -" rule, the "not before @" rule
# and the 2-letter minimum keep ordinary text out: "Dr. Lee",
# "Oak St. store", "$45.20", "8 pm.", "e.g." and e-mail addresses are not
# links. find_links() below also drops "p.m.Love" and "St.Apt".
WEB_LABEL = r'[^\W_](?:[\w-]*[^\W_])?'
COMMON_ENDINGS = ['com', 'net', 'org', 'gov', 'edu', 'co', 'us', 'info', 'biz', 'io', 'app', 'shop',
                  'online', 'site', 'xyz', 'top', 'click', 'link', 'live', 'ru', 'cn']
LINK_PATTERN = re.compile(
    r'https?://[^\s<>"\']+'
    r'|(?<![\w.@-])(?:\d{1,3}\.){3}\d{1,3}\b(?::\d+)?(?:/[^\s]*)?'
    r'|(?<![\w.@-])(?:(?:' + WEB_LABEL + r'\.)+(?:' + '|'.join(COMMON_ENDINGS) + r')@)?'
    r'(?:' + WEB_LABEL + r'\.)+[^\W\d_]{2,24}\b(?!@)(?:/[^\s]*)?',
    re.IGNORECASE)
IP_ADDRESS_PATTERN = re.compile(r'(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})')
PHONE_PATTERN = re.compile(r'(?<!\d)(?:\+?1[-.\s])?(?:\(?\d{3}\)?[-.\s])?\d{3}[-.\s]\d{4}(?!\d)')

# Look-alike characters scammers use to dodge simple word filters
# ("g1ft c@rd"). They are only undone next to a letter, so "$45" and
# "5-digit" stay as they are.
LOOKALIKE_LETTERS = {'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', '$': 's'}
LOOKALIKE_PATTERN = re.compile(r'(?<=[a-z])[01345@$]|[01345@$](?=[a-z])')
# Three or more single letters with single spaces between them ("g i f t").
SPACED_LETTERS_PATTERN = re.compile(r'\b(?:[a-z] ){2,}[a-z]\b')


# Letters from other alphabets that look like Latin letters: Cyrillic
# а е о р с у х і ј ѕ ԁ ӏ and Greek ο α ε ν ρ τ. Scammers mix them in so
# "gіft cаrd" (Cyrillic і and а) dodges a word filter. They are changed to
# Latin ONLY in the copy used for warning-sign matching; links keep their
# real letters, and a link with letters from another alphabet is a strong
# warning sign (lookalike_letters_link).
CONFUSABLES = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j',
    'ѕ': 's', 'ԁ': 'd', 'ӏ': 'l', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ν': 'v', 'ρ': 'p', 'τ': 't',
}

# "Defanged" links are written so they cannot be tapped: medicare[.]gov,
# hxxps://... They are turned back into normal links before links are
# found, so they are still checked.
DEFANGED_DOT_PATTERN = re.compile(r'\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)', re.IGNORECASE)
DEFANGED_SCHEME_PATTERN = re.compile(r'\bhxxp(s?)(://|\[:\]//)', re.IGNORECASE)

# Words with a dot that are not links: "5 p.m.Love you", "Oak St.Apt 4".
ABBREVIATIONS = ['st', 'apt', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'no', 'vs', 'etc', 'ave', 'rd']


def normalize_text(text):
    """Unicode NFKC turns fullwidth and other fancy letters into plain ones:
    'ＧＩＦＴ' -> 'GIFT', '－' -> '-'. Look-alike letters from other
    alphabets (Cyrillic, Greek) are handled by undo_disguises."""
    return unicodedata.normalize('NFKC', text)


def undo_defanging(text):
    """'medicare[.]gov' -> 'medicare.gov', 'hxxps://' -> 'https://'"""
    text = DEFANGED_DOT_PATTERN.sub('.', text)
    return DEFANGED_SCHEME_PATTERN.sub(r'http\1://', text)


def has_scheme(text):
    lower = text.lower()
    return lower.startswith('http://') or lower.startswith('https://') or lower.startswith('www.')


def clean_link(raw):
    """Return the link text, or None when the match is ordinary text such as
    'p.m.Love' or 'St.Apt'."""
    if has_scheme(raw) or IP_ADDRESS_PATTERN.match(raw):
        return raw
    host = raw.split('/')[0]
    if '@' in host:
        return raw   # "medicare.gov@evil-login.ru": always kept (hidden address)
    labels = host.split('.')
    # Skip leading abbreviations: "p.m.love" -> "love", "st.apt" -> "apt".
    if len(labels) >= 2 and labels[0].lower() in ('a', 'p') and labels[1].lower() == 'm':
        labels = labels[2:]
    while len(labels) > 1 and labels[0].lower() in ABBREVIATIONS:
        labels = labels[1:]
    # A capital letter right after a dot (no http:// or www.) starts a new
    # sentence: "dinner at 5 p.m.Love you". A common ending such as ".Com"
    # still counts as a link, so "Medicare-Renew.Com" is not missed.
    index = 1
    while index < len(labels):
        label = labels[index]
        if label[:1].isupper() and label.lower() not in COMMON_ENDINGS:
            labels = labels[:index]
            break
        index += 1
    if len(labels) < 2:
        return None
    if '.'.join(labels) == host:
        return raw
    return '.'.join(labels)


def link_hides_address(raw):
    """True when the link has 'something@' before the real address, e.g.
    'http://user@203.0.113.9/x' or 'medicare.gov@evil-login.ru'."""
    text = raw.lower()
    for prefix in ['https://', 'http://']:
        if text.startswith(prefix):
            text = text[len(prefix):]
    for mark in ['/', '?', '#']:
        text = text.split(mark)[0]
    return '@' in text


def uses_other_alphabet(domain):
    """True when a web address has letters outside plain a-z (for example
    Cyrillic 'а' in 'аmazon.com'), or is written in the 'xn--' form."""
    for character in domain:
        if ord(character) > 127:
            return True
    for label in domain.split('.'):
        if label.startswith('xn--'):
            return True
    return False


def find_links(text):
    """All links in the text, as normalized addresses, plus the raw links
    that hide their real address behind an @ sign."""
    links = []
    hidden = []
    for match in LINK_PATTERN.finditer(undo_defanging(text)):
        raw = clean_link(match.group(0))
        if raw is None:
            continue
        domain = normalize_domain(raw)
        if domain and domain not in links:
            links.append(domain)
        if domain and link_hides_address(raw) and domain not in hidden:
            hidden.append(domain)
    return links, hidden


def to_latin(character):
    return CONFUSABLES.get(character, character)


def undo_one_lookalike(match):
    character = match.group(0)
    return LOOKALIKE_LETTERS.get(character, character)


def join_spaced_letters(match):
    return match.group(0).replace(' ', '')


def undo_disguises(lower_text):
    """A second copy of the (lower-case, NFKC) text used ONLY for warning-sign
    matching: 'g1ft c@rds' -> 'gift cards', 'g i f t' -> 'gift'.
    Links are always taken from the undisguised text."""
    latin = ''
    for character in lower_text:
        latin += to_latin(character)
    text = LOOKALIKE_PATTERN.sub(undo_one_lookalike, latin)
    return SPACED_LETTERS_PATTERN.sub(join_spaced_letters, text)


def is_ip_address(domain):
    match = IP_ADDRESS_PATTERN.fullmatch(domain)
    if match is None:
        return False
    for part in match.groups():
        if int(part) > 255:
            return False
    return True


def normalize_domain(url):
    """'https://www.Medicare-Help.co/renew' -> 'medicare-help.co'
    'medicare[.]gov' -> 'medicare.gov' (defanged), and anything before an
    @ sign is dropped: 'http://user@203.0.113.9/x' -> '203.0.113.9',
    'medicare.gov@evil-login.ru' -> 'evil-login.ru' (the real address)."""
    text = undo_defanging(normalize_text(url.strip())).lower()
    for prefix in ['https://', 'http://']:
        if text.startswith(prefix):
            text = text[len(prefix):]
    for mark in ['/', '?', '#']:
        text = text.split(mark)[0]
    if '@' in text:
        text = text.rsplit('@', 1)[1]
    text = text.split(':')[0]
    if text.startswith('www.'):
        text = text[4:]
    return text.strip('.,;:)(')


def normalize_phone(number):
    """Compare phone numbers by their digits only: '+1-555-0199' -> '15550199'."""
    return re.sub(r'\D', '', str(number))


def phone_key(number):
    """The part of a phone number used to compare two numbers: digits only,
    a leading country code 1 removed, then the last 10 digits.
    '1-800-555-0199' -> '8005550199'; '1-555-0142' and '555-0142' -> '5550142'."""
    digits = normalize_phone(number)
    if len(digits) in (8, 11) and digits.startswith('1'):
        digits = digits[1:]
    return digits[-10:]


def edit_distance(a, b):
    """How many single-letter changes turn a into b (Levenshtein distance)."""
    previous = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        current = [i]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))
        previous = current
    return previous[len(b)]


def classify_domain(domain, data):
    """Return (status, organization). status is official, known_bad,
    ip_address, other_alphabet, shortened, lookalike or unknown.
    Nothing is ever opened."""
    if is_ip_address(domain):
        return 'ip_address', None
    if uses_other_alphabet(domain):
        # 'аmazon.com' with a Cyrillic 'а' looks exactly like amazon.com.
        latin = ''
        for character in domain:
            latin += to_latin(character)
        org = None
        if not uses_other_alphabet(latin):
            status, org = classify_domain(latin, data)
        return 'other_alphabet', org
    if domain in data['domains']['known_bad']:
        return 'known_bad', None
    for org in data['organizations']:
        for official in org['official_domains']:
            if domain == official or domain.endswith('.' + official):
                return 'official', org['name']
    if domain in data['domains']['shorteners']:
        return 'shortened', None

    # Look at the name part without the ending, e.g. "medicare-help" from "medicare-help.co".
    name_part = domain.rsplit('.', 1)[0]
    pieces = re.split(r'[-.]', name_part)
    squashed = name_part.replace('-', '').replace('.', '')
    for org in data['organizations']:
        for token in org['brand_tokens']:
            # Long brand names may appear inside a longer address (medicare-help).
            if len(token) >= 6 and token in squashed:
                return 'lookalike', org['name']
            for piece in pieces:
                # Short brand names must be a whole piece (usps-redelivery), so
                # "irs" does not match inside "first".
                if piece == token:
                    return 'lookalike', org['name']
                # Small spelling tricks: medlcare, arnazon.
                if len(token) >= 5 and len(piece) >= 4 and edit_distance(piece, token) <= 2:
                    return 'lookalike', org['name']
    return 'unknown', None


def find_organization(name, data):
    """Match a name or alias like 'medicare' to the organization record."""
    wanted = str(name).strip().lower()
    for org in data['organizations']:
        if wanted == org['name'].lower():
            return org
        for alias in org['aliases']:
            if wanted == alias:
                return org
    return None


# ------------------------------------------------------------------------
# 5. Warning-sign rules used by extract_signals
#    strong = one is enough for likely_scam; weak = two are needed;
#    info   = useful to know, never counted.
#    fact     = plain words Python uses when it writes explanations.
#    keywords = at least one must appear in the model's explanation
#               for every strong sign (checked by the verdict gate).
#    patterns         = any match counts.
#    guarded_patterns = a match counts UNLESS one of the 'unless' patterns
#                       also matches and the text has no request words
#                       (REQUEST_WORDS). This is how "I'll send you a gift
#                       card for your birthday" stays harmless while
#                       "can you send me a gift card" does not.
#    requested_patterns = a match counts only when the text also has
#                       request words ("I need you to wire 2000").
# ------------------------------------------------------------------------

# Any kind of store or gift card, including brand cards ("Apple cards",
# "Steam cards", "Google Play cards", "Target gift card").
CARD_WORDS = (r'(?:gift\s*-?\s*cards?|prepaid (?:visa |debit )?cards?'
              r'|(?:apple|steam|google play|itunes|target|walmart|amazon|ebay|visa|store|razer gold|sephora'
              r'|best buy|vanilla)\s+(?:gift\s+)?cards?)')
BANK_CARD = r'\b(debit|credit|bank|visa|mastercard|atm|amex|discover) card\b'
REQUEST_WORDS = [r'\bcan you\b', r'\bcould you\b', r'\bwould you\b', r'\bplease\b', r'\bi need\b',
                 r'\bneed you to\b', r'\bgo (buy|get)\b']

SIGNAL_RULES = [
    # Only a REQUEST to buy, send or read out a card counts. A gift card
    # mentioned as a present ("I put a gift card in your birthday card")
    # is not a warning sign.
    {'name': 'gift_card', 'strength': 'strong',
     'patterns': [
         # "... cards ... send me the claim numbers", "read me the numbers on the back"
         r'\b' + CARD_WORDS + r'.{0,100}\b(numbers?|codes?|claim|pins?|back of|scratch)',
         r'\b(numbers?|codes?|pins?)\b.{0,40}\b(on|from|off|of) (the |your |those |these )?' + CARD_WORDS,
         # a gift emoji with numbers or codes
         r'\U0001F381.{0,80}\b(numbers?|codes?)\b', r'\b(numbers?|codes?)\b.{0,80}\U0001F381'],
     'guarded_patterns': [
         r'\b(buy|get|grab|pick up|purchase|send|pay|load)\b.{0,60}\b' + CARD_WORDS],
     'unless': [r"\bi('ll| will| am going to|'m going to) (send|get|buy|mail|give|bring) you\b",
                r'\bi (just )?(sent|got|bought|put|mailed|left|gave) you\b',
                r'\bfor your (birthday|anniversary|christmas)\b', r'\bin your (mailbox|birthday card)\b'],
     'fact': 'asks you to pay with a gift card',
     'keywords': ['gift card', 'prepaid card', 'store card', 'itunes', 'google play', 'apple card', 'steam',
                  'card number', 'claim number', 'gift']},
    {'name': 'crypto', 'strength': 'strong',
     'patterns': [r'\bbitcoin\b', r'\bcrypto', r'\bwire transfer\b', r'\bwestern union\b',
                  # a crypto wallet address, the USDT coin, or "wallet address"
                  r'\b0x[0-9a-f]{40}\b', r'\busdt\b', r'\bwallet address\b'],
     'fact': 'asks for payment by cryptocurrency or wire transfer',
     'keywords': ['bitcoin', 'crypto', 'wire', 'wallet', 'usdt', 'western union']},
    # Money apps and transfer services: money sent this way is very hard to
    # get back. Only a REQUEST to send or pay with one counts, so "I sent
    # you $20 on Venmo" and "I'll pay you back on Venmo" from family are
    # not warning signs.
    {'name': 'payment_app', 'strength': 'strong',
     'patterns': [r'\b(zelle|venmo|cash ?app|paypal|moneygram|remitly)\s+me\b(?! back\b)',
                  r'\bpaypal\b.{0,30}\bfriends (and|&) family\b',
                  r'\bfriends (and|&) family\b.{0,30}\bpaypal\b',
                  r'\bwire (me |us )?(the )?(money|funds|payment|cash)\b'],
     'guarded_patterns': [r'\b(send|pay|transfer|wire)\b.{0,60}\b(zelle|venmo|cash ?app|moneygram|paypal|remitly'
                          r'|google pay|apple pay|western union)\b',
                          r'\b(send|pay|transfer|wire)\b.{0,60}\b(via|through|on|with|by|using) wise\b'],
     # A match here counts only when the text also has request words
     # ("I need you to wire 2000"), so "thanks for the wire, he got 1200"
     # from family is not a warning sign.
     'requested_patterns': [r'\bwire\b.{0,20}\$?\d'],
     'unless': [r'\bpay (you|u) back\b', r"\b(i|we)('ll| will)? (pay|send) (it )?(to )?you\b",
                r'\b(i|we) (just |already )?(sent|paid)\b', r'\bvenmo (you |u )?back\b'],
     'fact': 'asks you to send money through a money app or transfer service, which is very hard to get back',
     'keywords': ['zelle', 'venmo', 'cash app', 'moneygram', 'wire', 'money app', 'payment app', 'transfer',
                  'remitly', 'wise', 'google pay', 'apple pay', 'western union', 'paypal']},
    {'name': 'code_request', 'strength': 'strong',
     'patterns': [r'\b(verification|security|one[- ]time|login) (pass)?code\b', r'\botp\b',
                  # Only a REQUEST for a password or PIN counts, not
                  # "the wifi password is ..." or "Dad's PIN changed".
                  r'\b(send|tell|give|text|share|confirm|verify|enter|type|read|reply with)\b.{0,30}\b(passwords?|pins?)\b',
                  r"\bwhat('s| is) your (\w+ )?(password|pin)\b", r'\byour pin\b',
                  r'\bsocial security number\b', r'\bssn\b', r'\baccount number\b',
                  r'\bsend (me |us )?the code\b',
                  r'\bcodes? (that )?you (just )?(got|received)\b',
                  r'\bcodes? (that )?(we|i) (just )?(sent|texted)( to)?( you)?\b',
                  r'\b(\d|four|five|six|seven|eight)[- ]?(digit|number) (code|number|pin|text|message)\b',
                  r'\bnumbers on (the back of )?your (\w+ ){0,2}card\b',
                  # bank routing and account details, sign-in codes, online
                  # banking logins and Medicare numbers (only when asked for)
                  r'\brouting (and account )?(numbers?|details|info)\b',
                  r'\b(send|tell|give|text|share|forward|confirm|verify|enter|read|reply with)\b.{0,40}'
                  r'\b(account|bank|banking) (details|info|login|password|pin)\b',
                  r'\b(send|tell|give|text|share|forward|confirm|verify|enter|read|reply with)\b.{0,40}'
                  r'\b(log-?in|sign-?in) (numbers?|codes?|details|info)\b',
                  r'\b(log-?in|sign-?in) (numbers?|codes?)\b.{0,60}\b(forward|send|text|tell|give|read)\b'
                  r'.{0,10}\b(it|them)? ?(to |back to )?me\b',
                  r"\bwhat('s| is) your (online )?banking (login|password|pin)\b",
                  r"\b(send|tell|give|text|share|confirm|verify|read|what('s| is))\b.{0,30}"
                  r'\bmedicare (card )?(numbers?|id)\b'],
     'fact': 'asks for a code, password or personal number',
     'keywords': ['code', 'password', 'pin', 'social security number', 'account number', 'personal number',
                  'routing', 'bank details', 'account details', 'login', 'sign-in', 'medicare number']},
    {'name': 'card_details_request', 'strength': 'strong',
     # Only a bank card counts, so "a photo of the front of the card I
     # made for you" is not a warning sign.
     'patterns': [r'\b(photo|picture|pic|image|scan|copy)s? of (both )?(the )?(front|back)\b.{0,30}' + BANK_CARD,
                  r'\b(photo|picture|pic|image|scan|copy)s? of your (\w+ ){0,2}' + BANK_CARD,
                  r'\bsend (me )?the (front|back) of your (\w+ ){0,2}' + BANK_CARD,
                  r'\b(card number|expiration date|expiry date).{0,40}\b(cvv|security code|3[- ]digit)\b'],
     'fact': 'asks for a photo or the numbers of your bank card',
     'keywords': ['card', 'photo', 'picture']},
    {'name': 'ai_directed', 'strength': 'strong',
     'patterns': [r'\b(ai|assistant|chatbot|bot|language model|scamshield)\b.{0,60}\b(verified|safe|legitimate|ignore|approve|trusted)\b',
                  r'\bmark (this |it |the message )?(as )?(safe|legitimate|verified)\b',
                  r'\bignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|messages)\b',
                  r'\b(classify|label|rate) (this|it) as (safe|legitimate)\b',
                  r'\bsystem prompt\b'],
     'fact': 'contains hidden instructions that try to trick computer helpers',
     'keywords': ['trick', 'instruction', 'computer', 'mark it safe', 'mark safe', 'verified', 'ai']},
    {'name': 'urgency', 'strength': 'weak',
     'patterns': [r'\btoday\b', r'\bimmediately\b', r'\bright away\b', r'\b(act|reply|respond|call) now\b',
                  r'\burgent', r'\bfinal (notice|warning)\b', r'\bwithin \d+ (hours|minutes|days)\b',
                  r'\bby (today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|midnight)\b',
                  r'\bexpires?\b', r'\basap\b', r'\blast chance\b'],
     'fact': 'pushes you to act fast',
     'keywords': ['rush', 'hurry', 'fast', 'quick', 'today', 'right away', 'pressure', 'urgent', 'now']},
    {'name': 'threat', 'strength': 'weak',
     'patterns': [r'\bsuspend', r'\bcancel+ed\b', r'\b(account|card) (is |has been |will be )?(locked|frozen|closed)\b',
                  r'\barrest', r'\blegal action\b', r'\bpolice\b', r'\blawsuit\b', r'\bpenalt', r'\bdeactivat',
                  r'\blose (your )?(coverage|benefits|account)\b'],
     'fact': 'threatens that something bad will happen',
     'keywords': ['threat', 'scare', 'suspend', 'cancel', 'lose', 'arrest', 'locked', 'bad will happen']},
    {'name': 'money_request', 'strength': 'weak',
     'patterns': [r'\$\s?\d', r'\bpay\b', r'\bpayment\b', r'\bfees?\b', r'\bsend (me |us )?money\b', r'\bpay a fine\b'],
     'fact': 'asks for money',
     'keywords': ['money', 'pay', 'fee', '$', 'payment']},
    {'name': 'prize', 'strength': 'weak',
     'patterns': [r"\byou('ve| have)? won\b", r'\bwinner\b', r'\bprize\b', r'\blottery\b', r'\bclaim your\b',
                  r'\bcongratulations\b', r'\bcongrats\b',
                  r"\byou('ve| have)? been (selected|chosen|picked)\b", r'\b(reward|prize) draw\b'],
     'fact': 'says you won a prize',
     'keywords': ['prize', 'won', 'winner', 'lottery']},
    {'name': 'new_number', 'strength': 'weak',
     'patterns': [r'\bnew (phone )?number\b', r'\blost my phone\b', r'\bchanged my number\b', r'\bbroke my phone\b'],
     'fact': 'says it is from a new phone number',
     'keywords': ['new number', 'new phone']},
    {'name': 'secrecy', 'strength': 'weak',
     'patterns': [r"\bdon'?t tell\b", r'\bdo not tell\b', r'\bkeep (this|it) (a )?secret\b', r'\bbetween us\b'],
     'fact': 'asks you to keep it secret',
     'keywords': ['secret', "don't tell", 'do not tell']},
    {'name': 'callback_request', 'strength': 'info',
     'patterns': [r'\bcall (us|me) (back|at|now)\b', r'\bcall back\b', r'\bcall us\b', r'\bcall this number\b'],
     'fact': 'asks you to call back',
     'keywords': ['call']},
]

LINK_FLAGS = {
    'lookalike': {'name': 'lookalike_link', 'strength': 'strong',
                  'keywords': ['link', 'website', 'web address', 'fake site']},
    'known_bad': {'name': 'known_bad_link', 'strength': 'strong',
                  'fact': 'has a link to a website known for scams',
                  'keywords': ['link', 'website', 'web address']},
    # A link made only of numbers (192.168.10.45) is STRONG: real companies
    # and agencies use a named website, and a number address hides who runs
    # the site. None of the organizations in our trusted list uses one.
    'ip_address': {'name': 'ip_link', 'strength': 'strong',
                   'fact': 'has a link made only of numbers that hides who runs the website',
                   'keywords': ['link', 'website', 'web address', 'numbers']},
    # Letters from another alphabet in a web address ('аmazon.com' with a
    # Cyrillic 'а') only make sense as a trick to look like a real site.
    'other_alphabet': {'name': 'lookalike_letters_link', 'strength': 'strong',
                       'fact': 'has a link that uses look-alike letters from another alphabet',
                       'keywords': ['link', 'website', 'web address', 'letters', 'fake site']},
    'shortened': {'name': 'shortened_link', 'strength': 'weak',
                  'fact': 'has a short link that hides where it really goes',
                  'keywords': ['link', 'short']},
    'unknown': {'name': 'unknown_link', 'strength': 'info',
                'fact': 'has a link to a website we cannot confirm',
                'keywords': ['link']},
}


# A link with "something@" before the real address hides where it goes.
HIDDEN_ADDRESS_FACT = 'has a link that hides its real address behind an @ sign'


def add_flag(context, name, strength, fact, keywords, evidence_id):
    for flag in context['flags']:
        if flag['name'] == name and flag['fact'] == fact:
            return
    context['flags'].append({'name': name, 'strength': strength, 'fact': fact,
                             'keywords': keywords, 'evidence_id': evidence_id})


def flags_with_strength(context, strength):
    found = []
    for flag in context['flags']:
        if flag['strength'] == strength:
            found.append(flag)
    return found


def readable_sign_names(context, strength):
    """'gift_card', 'urgency' -> 'gift card, urgency' (or 'none') for console lines."""
    names = []
    for flag in flags_with_strength(context, strength):
        names.append(flag['name'].replace('_', ' '))
    if not names:
        return 'none'
    return ', '.join(names)


def flag_names(context):
    names = []
    for flag in context['flags']:
        names.append(flag['name'])
    return names
