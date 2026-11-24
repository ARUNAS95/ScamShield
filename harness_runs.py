"""Repeated-run harness for ScamShield (same idea as the Google harness
extra-credit experiment runner): run each demo case several times with the
live model, save every run's trace and console output, and summarize.

One run proves little with a language model, because its answers can vary.
Repeating each case shows how reliable the agent really is.

    python harness_runs.py --runs 3
    python harness_runs.py --runs 3 --mode keyword
    python harness_runs.py --runs 5 --cases scam uncertain

Consent for the simulated family alert is scripted ("yes"), so runs never
wait for typing. The agent code, prompts and tools are not changed by this
runner; it only calls run_agent() and records what happens.
"""

import argparse
import contextlib
import hashlib
import io
import json
import time
from pathlib import Path

import rag
import scamshield_agent as agent


HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / 'evidence' / 'harness'
DEFAULT_CASES = ['scam', 'ordinary', 'ordinary_urgent', 'uncertain', 'injection', 'trusted_bad_link',
                 'model_catches_miss', 'guide_missing', 'empty']
SOURCE_FILES = ['scamshield_agent.py', 'rag.py', 'harness_runs.py', 'eval.py', 'data/scam_guide.json',
                'data/messages.json', 'data/organizations.json', 'data/domains.json',
                'data/trusted_contacts.json']


def checksum(path):
    return hashlib.sha256((HERE / path).read_bytes()).hexdigest()


def run_once(case_name, case, run_number, mode, out_dir):
    message = {'sender': case['sender'], 'text': case['text']}
    guide_path = agent.MISSING_GUIDE_FILE if case_name == 'guide_missing' else rag.GUIDE_FILE
    stem = 'run_%s_%d' % (case_name, run_number)
    console = io.StringIO()
    started = time.time()
    with contextlib.redirect_stdout(console):
        print('CASE %s  RUN %d  MODE %s' % (case_name, run_number, mode))
        print('SENDER : ' + message['sender'])
        print('MESSAGE: ' + message['text'])
        try:
            record = agent.run_agent(message, consent_fn=agent.consent_yes, consent_mode='yes',
                                     guide_path=guide_path, search_mode=mode, verbose=True,
                                     case_name=case_name, trace_path=out_dir / (stem + '_trace.json'),
                                     alert_log=out_dir / 'family_alerts.log')
        except Exception as error:
            print('HARNESS ERROR: ' + type(error).__name__ + ': ' + str(error))
            record = None
    (out_dir / (stem + '_console.txt')).write_text(console.getvalue(), encoding='utf-8')
    if record is None:
        return {'case': case_name, 'run': run_number, 'error': True}
    return {
        'case': case_name, 'run': run_number, 'expected': case['expected_label'],
        'final_label': record['final_label'], 'correct': record['final_label'] == case['expected_label'],
        'model_label': record['model_label'], 'gate_overrode_model': record['gate_overrode_model'],
        'stop_reason': record['stop_reason'], 'steps': record['steps'],
        'tools': record['tool_sequence'], 'rejected_proposals': record['rejected_proposals'],
        'gate_rejections': record['gate_rejections'], 'explanation_source': record['explanation_source'],
        'helper_offered_by': record['helper_offered_by'], 'seconds': round(time.time() - started, 1),
        'trace': stem + '_trace.json', 'console': stem + '_console.txt',
    }


def summarize(rows, cases):
    summary = {}
    for case_name in cases:
        runs = []
        for row in rows:
            if row['case'] == case_name and not row.get('error'):
                runs.append(row)
        if not runs:
            continue
        correct = 0
        overrides = 0
        rejected = 0
        gate = 0
        steps = 0
        sequences = []
        stop_reasons = {}
        helper_offered_by = {}
        for row in runs:
            correct += 1 if row['correct'] else 0
            overrides += 1 if row['gate_overrode_model'] else 0
            rejected += row['rejected_proposals']
            gate += row['gate_rejections']
            steps += row['steps']
            sequence = ' > '.join(row['tools'])
            if sequence not in sequences:
                sequences.append(sequence)
            stop_reasons[row['stop_reason']] = stop_reasons.get(row['stop_reason'], 0) + 1
            # model / model_after_gate_hint / python / None (no help offered)
            who = str(row['helper_offered_by'])
            helper_offered_by[who] = helper_offered_by.get(who, 0) + 1
        summary[case_name] = {
            'runs': len(runs), 'correct': correct, 'gate_overrides': overrides,
            'rejected_proposals': rejected, 'gate_rejections': gate,
            'average_steps': round(steps / len(runs), 1), 'stop_reasons': stop_reasons,
            'helper_offered_by': helper_offered_by,
            'distinct_tool_sequences': len(sequences), 'tool_sequences': sequences,
        }
    return summary


def main():
    parser = argparse.ArgumentParser(description='Run ScamShield demo cases repeatedly with the live model.')
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--mode', choices=rag.SEARCH_MODES, default='rag')
    parser.add_argument('--cases', nargs='*', default=DEFAULT_CASES)
    args = parser.parse_args()

    all_cases = agent.load_cases()
    out_dir = OUT_DIR / args.mode
    out_dir.mkdir(parents=True, exist_ok=True)
    log = out_dir / 'family_alerts.log'
    if log.exists():
        log.unlink()

    checksums = []
    for path in SOURCE_FILES:
        checksums.append(checksum(path) + '  ' + path)
    (out_dir / 'source_checksums.txt').write_text('\n'.join(checksums) + '\n', encoding='utf-8')

    rows = []
    for case_name in args.cases:
        for run_number in range(1, args.runs + 1):
            row = run_once(case_name, all_cases[case_name], run_number, args.mode, out_dir)
            rows.append(row)
            if row.get('error'):
                print('%-17s run %d: HARNESS ERROR (see console file)' % (case_name, run_number), flush=True)
            else:
                print('%-17s run %d: %-12s %-5s %-15s steps=%-2d gate_rej=%d  %s' % (
                    case_name, run_number, row['final_label'], 'OK' if row['correct'] else 'WRONG',
                    row['stop_reason'], row['steps'], row['gate_rejections'], ' > '.join(row['tools'])), flush=True)
            agent.save_json(out_dir / 'results.json', {'model': agent.MODEL, 'search_mode': args.mode,
                                                       'runs_per_case': args.runs, 'rows': rows,
                                                       'summary': summarize(rows, args.cases)})

    summary = summarize(rows, args.cases)
    total = 0
    total_correct = 0
    print('\nSUMMARY (%s search, %d runs per case)' % (args.mode, args.runs))
    print('%-17s %-8s %-10s %-9s %-9s %s' % ('case', 'correct', 'overrides', 'avg steps', 'paths',
                                             'stop reasons / help offered by'))
    for case_name in summary:
        s = summary[case_name]
        total += s['runs']
        total_correct += s['correct']
        print('%-17s %d/%-6d %-10d %-9s %-9d %s  help: %s' % (case_name, s['correct'], s['runs'], s['gate_overrides'],
                                                             s['average_steps'], s['distinct_tool_sequences'],
                                                             json.dumps(s['stop_reasons']),
                                                             json.dumps(s['helper_offered_by'])))
    print('TOTAL: %d/%d runs ended with the expected label.' % (total_correct, total))
    print('Saved: ' + str((out_dir / 'results.json').relative_to(HERE)))


if __name__ == '__main__':
    main()
