"""The verdict gate, the readability check and the plain-language answer templates.

The gate works out which label the recorded evidence supports, so the model
saying "safe" is never enough on its own (like check_goal() in the Airways agent).
"""

import re

from settings import LABELS
from signals import PHONE_PATTERN, find_links, flag_names, flags_with_strength
from tools import evidence_ids, orgs_needing_lookup, unchecked_links


# ------------------------------------------------------------------------
# 10. The verdict gate: Python decides what the evidence supports
#     (ScamShield's version of check_goal in the Airways agent)
# ------------------------------------------------------------------------

def supported_label(context):
    """The label the RECORDED evidence supports, whatever the model says."""
    strong = flags_with_strength(context, 'strong')
    weak = flags_with_strength(context, 'weak')
    if strong or len(weak) >= 2:
        return 'likely_scam'
    all_links_official = True
    for link in context['links']:
        if context['link_results'].get(link) != 'official':
            all_links_official = False
    if (context['sender_trusted'] is True and len(weak) <= 1 and all_links_official
            and not orgs_needing_lookup(context) and not context['tool_failures']):
        return 'likely_safe'
    return 'uncertain'


def why_label_needs(label, context):
    """Expected vs. actual, so a rejection says exactly what is missing
    (lesson from PR #31: the checker's feedback must show both)."""
    strong = flags_with_strength(context, 'strong')
    weak = flags_with_strength(context, 'weak')
    if label == 'likely_scam':
        return ('likely_scam needs at least 1 strong or 2 weak warning signs; found %d strong and %d weak'
                % (len(strong), len(weak)))
    problems = []
    if context['sender_trusted'] is not True:
        if context['sender_checked']:
            problems.append('sender ' + context['message']['sender'] + ' is not a saved contact')
        else:
            problems.append('sender not checked yet (use check_sender)')
    if strong:
        names = []
        for flag in strong:
            names.append(flag['name'])
        problems.append('strong warning signs found: ' + ', '.join(names))
    if len(weak) > 1:
        problems.append('%d weak warning signs found (at most 1 allowed)' % len(weak))
    for link in context['links']:
        status = context['link_results'].get(link)
        if status is None:
            problems.append('link not checked yet (use check_link)')
        elif status != 'official':
            problems.append('a link is ' + status + ', not official')
    for org in orgs_needing_lookup(context):
        problems.append('the message gives a phone number for ' + org
                        + '; check the official number first (use lookup_official_contact)')
    if context['tool_failures']:
        problems.append('a tool failed, so the check is incomplete')
    return ('likely_safe needs a saved contact, no strong signs, at most 1 weak sign, all links official, '
            'and the official number looked up when the message gives a phone number for an organization; actual: '
            + '; '.join(problems))


def unfinished_checks(context):
    """Checks a trusted sender's message still needs before it can be safe."""
    if context['sender_trusted'] is not True or context['tool_failures']:
        return []
    missing = []
    if unchecked_links(context):
        missing.append('check_link')
    if orgs_needing_lookup(context):
        missing.append('lookup_official_contact')
    return missing


CONCERN_FEEDBACK = 'you raised a concern earlier; answer uncertain and use ask_human_helper'


def help_first_note(context):
    if context['sender_checked']:
        return 'use ask_human_helper first'
    return 'use check_sender, then ask_human_helper first'


def check_verdict(argument, context):
    """Return (accepted, checks). checks is a list of {rule, ok, detail}."""
    checks = []
    label = argument.get('label')
    cited = argument.get('evidence')
    explanation = argument.get('explanation')

    checks.append({'rule': 'label is one of ' + '/'.join(LABELS), 'ok': label in LABELS, 'detail': str(label)})
    if label not in LABELS:
        return False, checks

    cited_ok = type(cited) == list and len(cited) > 0
    missing = []
    if cited_ok:
        known = evidence_ids(context)
        for evidence_id in cited:
            if evidence_id not in known:
                missing.append(str(evidence_id))
    checks.append({'rule': 'cited evidence ids exist', 'ok': cited_ok and not missing,
                   'detail': 'missing: ' + ', '.join(missing) if missing else
                   ('cited ' + ', '.join(cited) if cited_ok else 'no evidence list given')})

    checks.append({'rule': 'explanation is given', 'ok': type(explanation) == str and len(explanation.strip()) > 0,
                   'detail': ''})
    if type(explanation) != str:
        explanation = ''

    supported = supported_label(context)
    if label == 'likely_safe':
        ok = supported == 'likely_safe'
        checks.append({'rule': 'evidence supports likely_safe', 'ok': ok,
                       'detail': 'ok' if ok else why_label_needs('likely_safe', context)})
        # The model's concern can only make the answer more careful: after
        # it proposed likely_scam or uncertain, or asked for human help
        # itself, "safe" is never accepted.
        concerned = model_was_concerned(context)
        checks.append({'rule': 'likely_safe is not allowed after you raised a concern', 'ok': not concerned,
                       'detail': CONCERN_FEEDBACK if concerned else 'ok'})
    elif label == 'likely_scam':
        ok = supported == 'likely_scam'
        checks.append({'rule': 'evidence supports likely_scam', 'ok': ok,
                       'detail': 'ok' if ok else why_label_needs('likely_scam', context)})
    else:
        strong = flags_with_strength(context, 'strong')
        if strong:
            # A strong warning sign settles it: "not sure" would hide a clear danger.
            checks.append({'rule': 'uncertain is not allowed when a strong warning sign was found', 'ok': False,
                           'detail': 'strong sign ' + strong[0]['name'] + ' found; the evidence supports likely_scam'})
        else:
            # Weak signs only: being more careful than the evidence requires is allowed.
            checks.append({'rule': 'uncertain is allowed (more careful is fine)', 'ok': True,
                           'detail': 'evidence supports ' + supported})
        checks.append({'rule': 'help must be offered before uncertain', 'ok': context['helper_offered'],
                       'detail': 'ok' if context['helper_offered'] else help_first_note(context)})

    unmentioned = []
    lower = explanation.lower()
    for flag in flags_with_strength(context, 'strong'):
        mentioned = False
        for keyword in flag['keywords']:
            if keyword in lower:
                mentioned = True
        if not mentioned:
            unmentioned.append(flag['fact'])
    checks.append({'rule': 'explanation mentions every strong warning sign', 'ok': not unmentioned,
                   'detail': 'missing: ' + '; '.join(unmentioned) if unmentioned else 'ok'})

    accepted = True
    for check in checks:
        if not check['ok']:
            accepted = False
    return accepted, checks


# ------------------------------------------------------------------------
# 11. Readability check and the plain-language output templates
# ------------------------------------------------------------------------

MAX_SENTENCES = 6
MAX_WORDS_PER_SENTENCE = 22
JARGON = ['phishing', 'smishing', 'domain', 'url', 'credential', 'spoof', 'malicious', 'authenticat',
          'hyperlink', 'impersonat', 'vector', 'payload']
VERDICT_WORDS = {
    'likely_scam': ['scam'],
    'likely_safe': ['safe'],
    'uncertain': ['not sure', 'unsure', 'cannot tell', "can't tell", 'not certain', 'uncertain'],
}


def split_sentences(text):
    sentences = []
    for part in re.split(r'(?<=[.!?])\s+', text.strip()):
        if part.strip():
            sentences.append(part.strip())
    return sentences


def check_readability(text, label):
    """Return a list of problems (empty list = easy to read)."""
    problems = []
    sentences = split_sentences(text)
    if not sentences:
        return ['the explanation is empty']
    if len(sentences) > MAX_SENTENCES:
        problems.append('use at most %d sentences (you used %d)' % (MAX_SENTENCES, len(sentences)))
    for sentence in sentences:
        if len(sentence.split()) > MAX_WORDS_PER_SENTENCE:
            problems.append('shorten this sentence to %d words or fewer: "%s"' % (MAX_WORDS_PER_SENTENCE, sentence))
    lower = text.lower()
    for word in JARGON:
        if re.search(r'\b' + word, lower):
            problems.append('avoid the technical word "' + word + '"')
    if find_links(text)[0]:
        problems.append('do not write links; say "the link in the message"')
    if PHONE_PATTERN.search(text) or re.search(r'\d{4,}', text):
        problems.append('do not write phone numbers or long numbers')
    first = sentences[0].lower()
    found = False
    for word in VERDICT_WORDS.get(label, []):
        if word in first:
            found = True
    if not found:
        problems.append('the first sentence must state the verdict, e.g. "' + verdict_sentence(label) + '"')
    return problems


def verdict_sentence(label):
    if label == 'likely_scam':
        return 'This looks like a scam.'
    if label == 'likely_safe':
        return 'This message looks safe.'
    return 'We are not sure about this message.'


def template_explanation(label, context):
    """Python's own explanation, built only from recorded facts."""
    text = verdict_sentence(label) + ' '
    if label == 'likely_scam':
        facts = []
        for flag in flags_with_strength(context, 'strong') + flags_with_strength(context, 'weak'):
            if len(facts) < 3:
                facts.append(flag['fact'])
        for fact in facts:
            text += 'The message ' + fact + '. '
    elif label == 'likely_safe':
        text += 'It comes from the number you saved for ' + str(context['sender_name']) + '. '
        weak = flags_with_strength(context, 'weak')
        if weak:
            text += 'It only ' + weak[0]['fact'] + ', which is normal for this sender. '
        else:
            text += 'We found no warning signs. '
    else:
        if context['sender_trusted'] is True:
            text += 'It comes from the number you saved for ' + str(context['sender_name']) + '. '
        elif context['sender_checked']:
            text += 'It comes from a number that is not in your contacts. '
        if context['model_concern_kept']:
            text += 'Our helper thought something looked wrong, but the checks could not confirm it. '
        if context['tool_failures']:
            text += 'Part of our check did not work, so we could not finish. '
        if context['sender_trusted'] is True:
            if not context['model_concern_kept'] and not context['tool_failures']:
                text += 'The check could not be finished. '
        else:
            text += 'We could not confirm who really sent it. '
    return text.strip()


def what_to_do(label, context, runtime):
    """The action line is always written by Python from trusted data,
    so the model never makes up a phone number."""
    helper = runtime['data']['contacts']['helper']['name']
    if label == 'likely_scam':
        line = 'Do not reply, do not tap any link, and do not send money or codes. '
        if context['sender_trusted'] is True:
            line += 'Call ' + str(context['sender_name']) + ' on the number you already have and ask if they really sent it.'
        elif context['official_contacts']:
            for org in context['official_contacts']:
                line += 'If you are worried, call ' + org + ' at ' + context['official_contacts'][org] + ' (from our trusted list).'
                break
        elif context['claimed_orgs']:
            line += 'If you are worried, call ' + context['claimed_orgs'][0] + ' using the number on your card or a letter from them.'
        else:
            line += 'You can delete it. If you are worried, talk to ' + helper + '.'
        return line
    if label == 'likely_safe':
        return 'You can reply as usual. If anything feels wrong, call ' + str(context['sender_name']) + ' on the number you saved.'
    line = 'Do not use the number or link in the message. Call them back on a number you already have, '
    if context['helper_consent']:
        line += 'and we have let ' + helper + ' know so they can help.'
    else:
        line += 'or ask ' + helper + ' to help you check.'
    return line


# Guide entries about messages from family or friends ("grandchild in
# trouble", "hacked account of a friend"). They do not fit a message that
# claims to be from an organization.
PERSONAL_SCAM_TYPES = ['grandparent', 'hacked_contact']


def tip_is_relevant(match, label, context):
    """A guide tip is shown only when it fits THIS message, so the USPS
    injection case never shows "call your grandchild".
      safe:      a real-pattern entry for the sender's or claimed organization.
      otherwise: a scam entry for the claimed organization, or a general
                 entry whose MAIN red flag (its first one) is a strong or
                 weak sign we found. Entries about an organization the
                 message does not claim are never shown, and when the
                 message claims an organization, entries about family or
                 friends are not shown either. When no strong or weak sign
                 was found, a shared note is enough."""
    is_legit = match['scam_type'] == 'legit_pattern'
    orgs = match.get('orgs', [])
    claimed = context['claimed_orgs']
    if label == 'likely_safe':
        if not is_legit:
            return False
        for org in orgs:
            if org == context['sender_name'] or org in claimed:
                return True
        return False
    if is_legit:
        return False
    for org in orgs:
        if org in claimed:
            return True
    if orgs:
        return False   # about an organization this message does not claim
    if claimed and match['scam_type'] in PERSONAL_SCAM_TYPES:
        return False
    red_flags = match.get('red_flags', [])
    if not red_flags:
        return False
    counted = []
    for flag in flags_with_strength(context, 'strong') + flags_with_strength(context, 'weak'):
        counted.append(flag['name'])
    if counted:
        return red_flags[0] in counted
    for flag_name in red_flags:
        if flag_name in flag_names(context):
            return True
    return False


def guide_tip(label, context):
    for match in context['guide_matches']:
        if tip_is_relevant(match, label, context):
            return 'Tip from our guide (' + match['id'] + '): ' + match['advice']
    return ''


def model_was_concerned(context):
    """True when the model proposed likely_scam or uncertain at any point,
    or when the MODEL itself asked for human help in this run (asking a
    family member for help and then saying "safe" does not fit together).
    Python's own help offer (helper_offered_by 'python') does not count."""
    for label in context['model_labels']:
        if label in ('likely_scam', 'uncertain'):
            return True
    return context['helper_offered_by'] == 'model'
