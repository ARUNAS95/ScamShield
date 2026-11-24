"""ScamShield evaluation: is the agent right, and does metadata RAG help?

Two parts:

1. Retrieval comparison (fast, no language model; uses local embeddings)
       python eval.py --retrieval
   For each labeled message, search the guide with the message text and
   check whether a correct guide entry is in the top 2 ("hit@2").
   Compares the three search modes: keyword, rag_no_metadata, rag.

2. Live agent comparison (slow, uses Ollama qwen3:8b)
       python eval.py --agent --mode rag
       python eval.py --agent --mode keyword
   Runs the full agent on every labeled message and compares its final
   label with OUR label (not with what the model claims). Reports
   accuracy, false "safe" answers, false alarms, steps, gate rejections.

3. Rules-only check (instant, no language model, no embeddings)
       python eval.py --rules --set eval
       python eval.py --rules --set holdout
   Runs extract_signals, check_link on every link and check_sender
   directly (no model) and compares the label the evidence supports
   with OUR label. This tests the warning-sign rules by themselves.

--set eval     the 25 labeled messages in data/eval_set.json (default)
--set holdout  12 held-out messages in data/eval_holdout.json, written
               in different wording from the rules BEFORE the round-1
               rule changes (paraphrases, look-alike letters, new web
               address endings, payment apps). They are never tuned.

Results are saved in evidence/eval/.
"""

import argparse
import contextlib
import io
import json
import time
from pathlib import Path

import rag
import scamshield_agent as agent


HERE = Path(__file__).resolve().parent
EVAL_FILES = {
    'eval': HERE / 'data' / 'eval_set.json',
    'holdout': HERE / 'data' / 'eval_holdout.json',
}
OUT_DIR = HERE / 'evidence' / 'eval'


def load_eval_set(set_name='eval'):
    return agent.load_json(EVAL_FILES[set_name])['messages']


def run_prefix(set_name):
    """File names for results: the main set keeps its old names, the
    held-out set gets 'holdout_' in front so nothing is overwritten."""
    if set_name == 'eval':
        return ''
    return set_name + '_'


def deterministic_context(item, data):
    """Run the lookup tools directly (no model) to get the evidence a careful
    agent would collect: warning signs, link results and the sender check."""
    message = {'sender': item['sender'], 'text': item['text']}
    context = agent.new_context(message, rag.GUIDE_FILE, 'keyword')
    runtime = {'data': data, 'consent_fn': agent.consent_no, 'alert_log': OUT_DIR / 'unused.log'}
    agent.run_requested_tool('extract_signals', {}, context, runtime)
    for link in list(context['links']):
        agent.run_requested_tool('check_link', {'url': link}, context, runtime)
    agent.run_requested_tool('check_sender', {'sender': item['sender']}, context, runtime)
    return context


# ------------------------------------------------------------------------
# 1. Retrieval comparison
# ------------------------------------------------------------------------

def evaluate_retrieval(set_name='eval'):
    data = agent.load_data()
    entries = rag.load_guide()
    items = load_eval_set(set_name)
    rows = []
    totals = {}
    for mode in rag.SEARCH_MODES:
        totals[mode] = {'hits': 0, 'scored': 0, 'fallbacks': 0}

    for item in items:
        if not item['expected_guide']:
            continue   # nothing specific to find for this message
        context = deterministic_context(item, data)
        row = {'id': item['id'], 'category': item['category'], 'expected_guide': item['expected_guide']}
        for mode in rag.SEARCH_MODES:
            found = rag.search(item['text'], entries, mode=mode, found_flags=agent.flag_names(context),
                               claimed_orgs=context['claimed_orgs'])
            top = []
            for match in found['matches']:
                top.append(match['id'])
            hit = False
            for entry_id in top:
                if entry_id in item['expected_guide']:
                    hit = True
            row[mode] = {'top2': top, 'hit': hit, 'retrieval_mode': found['retrieval_mode']}
            totals[mode]['scored'] += 1
            if hit:
                totals[mode]['hits'] += 1
            if found['retrieval_mode'] == 'keyword_fallback':
                totals[mode]['fallbacks'] += 1
        rows.append(row)

    summary = {}
    for mode in rag.SEARCH_MODES:
        scored = totals[mode]['scored']
        summary[mode] = {'hit_at_2': round(totals[mode]['hits'] / scored, 3) if scored else None,
                         'hits': totals[mode]['hits'], 'messages': scored,
                         'keyword_fallbacks': totals[mode]['fallbacks']}

    print('\nRETRIEVAL: is a correct guide entry in the top 2? (%d messages with a known answer)' % len(rows))
    print('%-6s %-12s %-22s %-22s %-22s' % ('id', 'expected', 'keyword', 'rag_no_metadata', 'rag'))
    for row in rows:
        cells = []
        for mode in rag.SEARCH_MODES:
            mark = 'HIT ' if row[mode]['hit'] else 'miss'
            cells.append(mark + ' ' + ','.join(row[mode]['top2']))
        print('%-6s %-12s %-22s %-22s %-22s' % (row['id'], ','.join(row['expected_guide']), cells[0], cells[1], cells[2]))
    print()
    for mode in rag.SEARCH_MODES:
        s = summary[mode]
        note = '  (WARNING: %d keyword fallbacks)' % s['keyword_fallbacks'] if s['keyword_fallbacks'] else ''
        print('%-16s hit@2 = %d/%d = %.0f%%%s' % (mode, s['hits'], s['messages'], 100 * s['hit_at_2'], note))

    out_file = OUT_DIR / (run_prefix(set_name) + 'retrieval_results.json')
    agent.save_json(out_file, {'summary': summary, 'rows': rows})
    print('Saved:', out_file.relative_to(HERE))
    return summary


def evaluate_model_queries(trace_mode='rag'):
    """A fairer retrieval test: replay the SHORT queries the model actually
    wrote during a live agent run (e.g. "gift card") through all three
    search modes. Needs a finished `python eval.py --agent` run first."""
    data = agent.load_data()
    entries = rag.load_guide()
    run_dir = OUT_DIR / ('agent_' + trace_mode)
    rows = []
    totals = {}
    for mode in rag.SEARCH_MODES:
        totals[mode] = 0
    for item in load_eval_set():
        if not item['expected_guide']:
            continue
        trace_file = run_dir / (item['id'] + '_trace.json')
        if not trace_file.exists():
            continue
        record = agent.load_json(trace_file)
        context = deterministic_context(item, data)
        for step in record['trace']:
            if step['action'] != 'search_scam_guide' or not step['validation_ok']:
                continue
            query = step['argument'].get('query', '')
            filters = step['argument'].get('filters') or {}
            clean_filters = {}
            if filters.get('org'):
                org = agent.find_organization(filters['org'], data)
                if org:
                    clean_filters['org'] = org['name']
            if filters.get('scam_type'):
                clean_filters['scam_type'] = filters['scam_type']
            row = {'id': item['id'], 'query': query, 'filters': clean_filters, 'expected_guide': item['expected_guide']}
            for mode in rag.SEARCH_MODES:
                found = rag.search(query, entries, mode=mode, filters=clean_filters,
                                   found_flags=agent.flag_names(context), claimed_orgs=context['claimed_orgs'])
                top = []
                hit = False
                for match in found['matches']:
                    top.append(match['id'])
                    if match['id'] in item['expected_guide']:
                        hit = True
                row[mode] = {'top2': top, 'hit': hit}
                if hit:
                    totals[mode] += 1
            rows.append(row)
    if not rows:
        print('No model queries found. Run: python eval.py --agent --mode ' + trace_mode)
        return None
    print('\nRETRIEVAL WITH THE MODEL\'S OWN QUERIES (%d searches from the %s agent run)' % (len(rows), trace_mode))
    for row in rows:
        marks = []
        for mode in rag.SEARCH_MODES:
            marks.append(mode + '=' + ('HIT' if row[mode]['hit'] else 'miss'))
        print('  %-4s "%s" %s  %s' % (row['id'], row['query'][:40], json.dumps(row['filters']) if row['filters'] else '', ' '.join(marks)))
    summary = {}
    for mode in rag.SEARCH_MODES:
        summary[mode] = {'hits': totals[mode], 'searches': len(rows), 'hit_at_2': round(totals[mode] / len(rows), 3)}
        print('%-16s hit@2 = %d/%d = %.0f%%' % (mode, totals[mode], len(rows), 100 * totals[mode] / len(rows)))
    agent.save_json(OUT_DIR / 'model_query_retrieval_results.json', {'summary': summary, 'rows': rows})
    return summary


# ------------------------------------------------------------------------
# 2. Rules-only check: the warning-sign rules without any model
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
# 3. Live agent comparison
# ------------------------------------------------------------------------

def guide_ids_used(record):
    ids = []
    for item in record['evidence']:
        if item['tool'] == 'search_scam_guide':
            for fact in item['facts']:
                ids.append(fact.split(':')[0].replace('guide ', '').strip())
    return ids


def evaluate_agent(mode, limit=None, ids=None, set_name='eval'):
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
    run_dir = OUT_DIR / (run_prefix(set_name) + 'agent_' + mode)
    rows = []

    for item in items:
        message = {'sender': item['sender'], 'text': item['text']}
        started = time.time()
        with contextlib.redirect_stdout(io.StringIO()):
            record = agent.run_agent(message, consent_fn=agent.consent_yes, consent_mode='yes',
                                     search_mode=mode, verbose=False, case_name='eval_' + item['id'],
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

    summary = summarize_agent(rows, mode)
    out_file = OUT_DIR / (run_prefix(set_name) + 'agent_' + mode + '_results.json')
    agent.save_json(out_file, {'summary': summary, 'rows': rows})
    print_agent_summary(summary)
    print('Saved:', out_file.relative_to(HERE))
    return summary


def summarize_agent(rows, mode):
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
    return {
        'search_mode': mode, 'messages': count,
        'accuracy': round(correct / count, 3) if count else None, 'correct': correct,
        'model_last_label_accuracy': round(model_correct / count, 3) if count else None,
        'false_safe': false_safe, 'not_safe_messages': not_safe_total,
        'false_alarm': false_alarm, 'safe_messages': safe_total,
        'uncertain_answers': uncertain, 'gate_overrides': overrides,
        'gate_rejections_total': gate_rejections, 'average_steps': round(steps / count, 2) if count else None,
        'messages_where_guide_was_searched': searched,
        'guide_hit_when_searched': '%d/%d' % (guide_hits, guide_scored),
        'distinct_tool_sequences': len(sequences),
        'per_category': per_category,
    }


def print_agent_summary(s):
    print('\nAGENT (%s search): %d/%d correct = %.0f%%' % (s['search_mode'], s['correct'], s['messages'], 100 * s['accuracy']))
    print('  false "safe" answers : %d of %d messages that are not safe' % (s['false_safe'], s['not_safe_messages']))
    print('  false alarms (scam)  : %d of %d safe messages' % (s['false_alarm'], s['safe_messages']))
    print('  uncertain answers    : %d' % s['uncertain_answers'])
    print('  model last label right: %.0f%%   gate overrides: %d   gate rejections: %d'
          % (100 * s['model_last_label_accuracy'], s['gate_overrides'], s['gate_rejections_total']))
    print('  average steps        : %s   distinct tool sequences: %d' % (s['average_steps'], s['distinct_tool_sequences']))
    print('  guide searched in %d messages; correct guide entry used: %s'
          % (s['messages_where_guide_was_searched'], s['guide_hit_when_searched']))
    for cat in s['per_category']:
        c = s['per_category'][cat]
        print('  %-13s %d/%d' % (cat, c['correct'], c['total']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Evaluate ScamShield on the labeled message set.')
    parser.add_argument('--retrieval', action='store_true', help='compare search modes (fast, no LLM)')
    parser.add_argument('--model-queries', action='store_true',
                        help='replay the queries the model wrote in the live rag run through all search modes')
    parser.add_argument('--agent', action='store_true', help='run the live agent on every message')
    parser.add_argument('--mode', choices=rag.SEARCH_MODES, default='rag', help='search mode for --agent')
    parser.add_argument('--limit', type=int, help='only the first N messages')
    parser.add_argument('--ids', nargs='*', help='only these message ids, e.g. S01 U02')
    parser.add_argument('--rules', action='store_true',
                        help='check the warning-sign rules alone (instant, no model, no embeddings)')
    parser.add_argument('--set', choices=list(EVAL_FILES), default='eval',
                        help='which labeled set: eval (25 messages) or holdout (12 held-out messages)')
    args = parser.parse_args()
    if not args.retrieval and not args.agent and not args.model_queries and not args.rules:
        parser.print_help()
    if args.rules:
        evaluate_rules(args.set)
    if args.retrieval:
        evaluate_retrieval(args.set)
    if args.model_queries:
        evaluate_model_queries()
    if args.agent:
        evaluate_agent(args.mode, args.limit, args.ids, args.set)
