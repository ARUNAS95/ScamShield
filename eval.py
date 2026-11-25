"""ScamShield evaluation: is the agent right on labeled messages?

1. Rules-only check (instant, no language model)
       python eval.py --rules --set eval
   Runs extract_signals, check_link on every link, check_sender and
   lookup_official_contact directly (no model) and compares the label the
   evidence supports with OUR label. This tests the warning-sign rules alone.

2. Live agent run (slow, uses Ollama qwen3:8b)
       python eval.py --agent --set eval
   Runs the full agent on every labeled message and compares its final
   label with OUR label (not with what the model claims). Reports accuracy
   with a 95% confidence range, false "safe" answers, false alarms, steps
   and gate rejections.

--set eval      test set 1: 25 labeled messages (data/eval_set.json, default)
--set holdout   test set 2: 12 messages (data/eval_holdout.json), written
                before the round-1 rule fixes, then used to fix rules, so
                it is no longer held out
--set holdout2  test set 3: 14 messages (data/eval_holdout2.json), written
                before the round-2 rule fixes, then used to fix rules, so
                it is no longer held out (BEFORE/AFTER scores in
                evidence/eval/holdout2_rules_BEFORE.txt and _AFTER.txt)
--set large     large blind test set: 614 messages (data/eval_large.json),
                written by a separate AI agent that never saw the rules;
                frozen

Results are saved in evidence/eval/.
"""

import argparse
import contextlib
import hashlib
import io
import json
import math
import time
from pathlib import Path

import rag
import scamshield_agent as agent


HERE = Path(__file__).resolve().parent
EVAL_FILES = {
    'eval': HERE / 'data' / 'eval_set.json',
    'holdout': HERE / 'data' / 'eval_holdout.json',
    'holdout2': HERE / 'data' / 'eval_holdout2.json',
    'large': HERE / 'data' / 'eval_large.json',   # 614 messages written blind by an AI agent, frozen
}
OUT_DIR = HERE / 'evidence' / 'eval'
SOURCE_FILES = ['scamshield_agent.py', 'settings.py', 'signals.py', 'tools.py', 'gate.py', 'rag.py',
                'eval.py', 'data/scam_guide.json', 'data/organizations.json',
                'data/domains.json', 'data/trusted_contacts.json', 'data/eval_set.json',
                'data/eval_holdout.json', 'data/eval_holdout2.json', 'data/eval_large.json']


def write_source_checksums():
    """Record exactly which code and data produced the saved results."""
    lines = []
    for path in SOURCE_FILES:
        lines.append(hashlib.sha256((HERE / path).read_bytes()).hexdigest() + '  ' + path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'source_checksums.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def load_eval_set(set_name='eval'):
    return agent.load_json(EVAL_FILES[set_name])['messages']


def run_prefix(set_name):
    """File names for results: the main set has no prefix, the other sets
    get their name in front (holdout_, holdout2_, large_)."""
    if set_name == 'eval':
        return ''
    return set_name + '_'


def deterministic_context(item, data):
    """Run the lookup tools directly (no model) to get the evidence a careful
    agent would collect: warning signs, link results, the sender check and
    the official number of every organization the message claims."""
    message = {'sender': item['sender'], 'text': item['text']}
    context = agent.new_context(message, rag.GUIDE_FILE)
    runtime = {'data': data, 'consent_fn': agent.consent_no, 'alert_log': OUT_DIR / 'unused.log'}
    agent.run_requested_tool('extract_signals', {}, context, runtime)
    for link in list(context['links']):
        agent.run_requested_tool('check_link', {'url': link}, context, runtime)
    agent.run_requested_tool('check_sender', {'sender': item['sender']}, context, runtime)
    for org in list(context['claimed_orgs']):
        agent.run_requested_tool('lookup_official_contact', {'org': org}, context, runtime)
    return context


# ------------------------------------------------------------------------
# 1. Rules-only check: the warning-sign rules without any model
# ------------------------------------------------------------------------

def evaluate_rules(set_name='eval'):
    """Run the lookup tools directly (like deterministic_context) and compare
    the label the recorded evidence supports with OUR expected label."""
    data = agent.load_data()
    items = load_eval_set(set_name)
    correct = 0
    false_safe = 0
    false_alarm = 0
    print('RULES ONLY (no model), set = %s, %d messages' % (set_name, len(items)))
    print('%-4s %-10s %-12s %-12s %-5s %s' % ('id', 'category', 'expected', 'supported', '', 'evidence'))
    for item in items:
        context = deterministic_context(item, data)
        supported = agent.supported_label(context)
        ok = supported == item['expected_label']
        if ok:
            correct += 1
        if supported == 'likely_safe' and item['expected_label'] != 'likely_safe':
            false_safe += 1
        if supported == 'likely_scam' and item['expected_label'] == 'likely_safe':
            false_alarm += 1
        signs = []
        for flag in context['flags']:
            if flag['strength'] != 'info':
                signs.append(flag['name'] + '(' + flag['strength'] + ')')
        links = []
        for link in context['links']:
            links.append(link + '=' + str(context['link_results'].get(link)))
        details = 'signs: ' + (', '.join(signs) or 'none')
        details += ' | links: ' + (', '.join(links) or 'none')
        details += ' | saved contact: ' + str(context['sender_trusted'])
        print('%-4s %-10s %-12s %-12s %-5s %s' % (item['id'], item['category'], item['expected_label'],
                                                 supported, 'OK' if ok else 'WRONG', details))
    print('\nRULES ONLY (%s): %d/%d supported labels match the expected label' % (set_name, correct, len(items)))
    print('  false "safe": %d   false alarms (scam on a safe message): %d' % (false_safe, false_alarm))
    return correct, len(items)


# ------------------------------------------------------------------------
# 2. Live agent run
# ------------------------------------------------------------------------

def guide_ids_used(record):
    ids = []
    for item in record['evidence']:
        if item['tool'] == 'search_scam_guide':
            for fact in item['facts']:
                ids.append(fact.split(':')[0].replace('guide ', '').strip())
    return ids


def evaluate_agent(limit=None, ids=None, set_name='eval'):
    items = load_eval_set(set_name)
    if ids:
        chosen = []
        for item in items:
            if item['id'] in ids:
                chosen.append(item)
        items = chosen
    if limit:
        items = items[:limit]
    data = agent.load_data()
    run_dir = OUT_DIR / (run_prefix(set_name) + 'agent')
    rows = []

    for item in items:
        message = {'sender': item['sender'], 'text': item['text']}
        started = time.time()
        with contextlib.redirect_stdout(io.StringIO()):
            record = agent.run_agent(message, consent_fn=agent.consent_yes, consent_mode='yes',
                                     verbose=False, case_name='eval_' + item['id'],
                                     trace_path=run_dir / (item['id'] + '_trace.json'),
                                     alert_log=run_dir / 'family_alerts.log', data=data)
        used = guide_ids_used(record)
        guide_hit = None
        if item['expected_guide'] and used:
            guide_hit = False
            for entry_id in used:
                if entry_id in item['expected_guide']:
                    guide_hit = True
        row = {
            'id': item['id'], 'category': item['category'], 'expected': item['expected_label'],
            'final_label': record['final_label'], 'correct': record['final_label'] == item['expected_label'],
            'model_label': record['model_label'], 'gate_overrode_model': record['gate_overrode_model'],
            'stop_reason': record['stop_reason'], 'steps': record['steps'],
            'tools': record['tool_sequence'], 'gate_rejections': record['gate_rejections'],
            'rejected_proposals': record['rejected_proposals'], 'searched': len(used) > 0 or
            'search_scam_guide' in record['tool_sequence'], 'guide_ids': used, 'guide_hit': guide_hit,
            'helper_offered_by': record['helper_offered_by'], 'seconds': round(time.time() - started, 1),
        }
        rows.append(row)
        print('%-4s %-12s -> %-12s %-5s %-15s steps=%-2d gate_rej=%d tools=%s' % (
            row['id'], row['expected'], row['final_label'], 'OK' if row['correct'] else 'WRONG',
            row['stop_reason'], row['steps'], row['gate_rejections'], ' > '.join(row['tools'])), flush=True)

    summary = summarize_agent(rows)
    out_file = OUT_DIR / (run_prefix(set_name) + 'agent_results.json')
    agent.save_json(out_file, {'summary': summary, 'rows': rows})
    print_agent_summary(summary)
    print('Saved:', out_file.relative_to(HERE))
    return summary


def wilson(hits, total):
    """95% confidence range for a proportion (Wilson score interval).
    With few messages the range is wide; with many it is narrow."""
    if total == 0:
        return None
    z = 1.96
    p = hits / total
    centre = (p + z * z / (2 * total)) / (1 + z * z / total)
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / (1 + z * z / total)
    return [round(max(0.0, centre - half), 3), round(min(1.0, centre + half), 3)]


def summarize_agent(rows):
    count = len(rows)
    correct = 0
    false_safe = 0
    false_alarm = 0
    uncertain = 0
    overrides = 0
    gate_rejections = 0
    steps = 0
    searched = 0
    guide_scored = 0
    guide_hits = 0
    model_correct = 0
    helper_by = {}
    not_safe_total = 0
    safe_total = 0
    per_category = {}
    sequences = []
    for row in rows:
        if row['correct']:
            correct += 1
        if row['model_label'] == row['expected']:
            model_correct += 1
        if row['expected'] != 'likely_safe':
            not_safe_total += 1
            if row['final_label'] == 'likely_safe':
                false_safe += 1
        else:
            safe_total += 1
            if row['final_label'] == 'likely_scam':
                false_alarm += 1
        if row['final_label'] == 'uncertain':
            uncertain += 1
        if row['gate_overrode_model']:
            overrides += 1
        gate_rejections += row['gate_rejections']
        steps += row['steps']
        if row['searched']:
            searched += 1
        if row['guide_hit'] is not None:
            guide_scored += 1
            if row['guide_hit']:
                guide_hits += 1
        cat = per_category.setdefault(row['category'], {'correct': 0, 'total': 0})
        cat['total'] += 1
        if row['correct']:
            cat['correct'] += 1
        sequence = ' > '.join(row['tools'])
        if sequence not in sequences:
            sequences.append(sequence)
        # model / python / None (no help offered)
        who = str(row['helper_offered_by'])
        helper_by[who] = helper_by.get(who, 0) + 1
    return {
        'messages': count,
        'accuracy': round(correct / count, 3) if count else None, 'correct': correct,
        'accuracy_ci95': wilson(correct, count),
        'false_safe_rate_ci95': wilson(false_safe, not_safe_total),
        'false_alarm_rate_ci95': wilson(false_alarm, safe_total),
        'model_last_label_accuracy': round(model_correct / count, 3) if count else None,
        'false_safe': false_safe, 'not_safe_messages': not_safe_total,
        'false_alarm': false_alarm, 'safe_messages': safe_total,
        'uncertain_answers': uncertain, 'gate_overrides': overrides,
        'gate_rejections_total': gate_rejections, 'average_steps': round(steps / count, 2) if count else None,
        'messages_where_guide_was_searched': searched,
        'guide_hit_when_searched': '%d/%d' % (guide_hits, guide_scored),
        'distinct_tool_sequences': len(sequences),
        'helper_offered_by': helper_by,
        'per_category': per_category,
    }


def print_agent_summary(s):
    print('\nAGENT: %d/%d correct = %.0f%%' % (s['correct'], s['messages'], 100 * s['accuracy']))
    if s.get('accuracy_ci95'):
        print('  95%% confidence range for accuracy: %.1f%% to %.1f%%' % (100 * s['accuracy_ci95'][0], 100 * s['accuracy_ci95'][1]))
    print('  false "safe" answers : %d of %d messages that are not safe' % (s['false_safe'], s['not_safe_messages']))
    print('  false alarms (scam)  : %d of %d safe messages' % (s['false_alarm'], s['safe_messages']))
    print('  uncertain answers    : %d' % s['uncertain_answers'])
    print('  model last label right: %.0f%%   gate overrides: %d   gate rejections: %d'
          % (100 * s['model_last_label_accuracy'], s['gate_overrides'], s['gate_rejections_total']))
    print('  average steps        : %s   distinct tool sequences: %d' % (s['average_steps'], s['distinct_tool_sequences']))
    print('  guide searched in %d messages; correct guide entry used: %s'
          % (s['messages_where_guide_was_searched'], s['guide_hit_when_searched']))
    print('  human help offered by: ' + json.dumps(s['helper_offered_by']))
    for cat in s['per_category']:
        c = s['per_category'][cat]
        print('  %-13s %d/%d' % (cat, c['correct'], c['total']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Evaluate ScamShield on the labeled message set.')
    parser.add_argument('--agent', action='store_true', help='run the live agent on every message')
    parser.add_argument('--limit', type=int, help='only the first N messages')
    parser.add_argument('--ids', nargs='*', help='only these message ids, e.g. S01 U02')
    parser.add_argument('--rules', action='store_true',
                        help='check the warning-sign rules alone (instant, no model)')
    parser.add_argument('--set', choices=list(EVAL_FILES), default='eval',
                        help='which labeled set: eval (25 messages), holdout (test set 2, 12), holdout2 (test set 3, '
                             '14) or large (614, written blind by a separate AI agent)')
    args = parser.parse_args()
    if not args.agent and not args.rules:
        parser.print_help()
    else:
        write_source_checksums()
    if args.rules:
        evaluate_rules(args.set)
    if args.agent:
        evaluate_agent(args.limit, args.ids, args.set)
