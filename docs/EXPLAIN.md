# ScamShield study guide: explaining the system from memory

Line numbers refer to `scamshield_agent.py` and `rag.py` as committed on branch `aruna/scamshield-agent`
(check with `grep -n "^def " scamshield_agent.py rag.py` if the code changes).

## 1. The loop in 10 lines

1. Python checks the input: an empty or too-long message stops with `invalid_input` (no model call).
2. The model gets the system prompt, the message inside random-tag markers ("untrusted data"), and AVAILABLE ACTIONS.
3. The model replies with ONE JSON action: `{"action": ..., "argument": {...}}`.
4. `parse_action` checks the JSON shape; a bad reply is rejected and sent back.
5. `run_requested_tool` checks the routing precondition (`ROUTING`), grounds the argument in the message, blocks repeats.
6. The tool runs locally (never opens links); `post_check` verifies the state change; a failure is `tool_failure`.
7. The result becomes evidence `E#`; result + full evidence ledger + new AVAILABLE ACTIONS go back to the model.
8. When the model says `done`, `check_verdict` compares its label with `supported_label` (expected vs. actual).
9. Rejected: feedback to the model; after 2 rejections Python uses the supported label (`gate_downgrade`).
10. Accepted: `check_readability` (1 rewrite, then a template); `finish_run` adds Python's "what to do" line and saves the trace.

Stop rules: 10 steps, 3 rejected proposals in a row (`no_progress`), 2 retries of a failed model call (`model_error`).

## 2. Key functions (file:line and two sentences each)

| Function | Where | What it does |
|---|---|---|
| `run_agent` | scamshield_agent.py:1570 | The main loop: input check, then per step ask the model (with up to 2 retries), parse, route `done` to the gate or a tool to `run_requested_tool`, and append the result + ledger + AVAILABLE ACTIONS to `messages`. It saves a checkpoint after every step and ends by calling `finish_run`. |
| `ask_model` | scamshield_agent.py:1167 | Calls Ollama `/api/chat` with `qwen3:8b`, `think=false`, `format=json`, `num_ctx` 8192 and a 180 s timeout. Tests replace it with a scripted model function. |
| `parse_action` | scamshield_agent.py:1186 | Strips think tags and code fences, then requires valid JSON with exactly the keys `action` (text) and `argument` (dictionary). It returns `(proposal, '')` or `(None, reason)`. |
| `ROUTING` | scamshield_agent.py:928 | A table with one plain precondition per action (e.g. `ask_human_helper`: "after check_sender, and only once"). The same text is sent to the model when a proposal is rejected. |
| `precondition_met` | scamshield_agent.py:955 | Checks one ROUTING precondition against the `context` state (links still unchecked, sender checked, searches left, broken tools). This is what makes routing conditional instead of a fixed order. |
| `available_actions` | scamshield_agent.py:978 | Lists every action whose precondition holds right now. It is shown to the model after every step and stored in each trace step. |
| `run_requested_tool` | scamshield_agent.py:1054 | Rejects unknown or not-allowed actions, keeps only declared argument keys, runs the tool's `validate`, blocks repeated calls, runs the tool inside try/except, checks the result shape and runs `post_check`. On success it records evidence `E#`; on failure it records a tool failure and disables that tool. |
| `post_check` | scamshield_agent.py:1011 | After a tool says it worked, confirms the result was recorded consistently (link in `link_results`, sender marked checked). For the local lookup tools there is no outside state to inspect; the simulated alert is the only side effect and is read back from the log file. The independent check of the answer is the verdict gate. |
| `evidence_ledger` | scamshield_agent.py:1000 | One line per evidence item, sent with every tool result and never trimmed. A small model therefore never forgets which `E#` ids exist. |
| `run_extract_signals` | scamshield_agent.py:630 | Regex scan for strong and weak warning signs, links, phone numbers, claimed organizations and text aimed at an AI, on NFKC-normalized text and on a copy with disguises undone (`g1ft`, `g i f t`, Cyrillic/Greek look-alike letters via `CONFUSABLES`, line 146). Links come from `find_links` (line 234), which restores defanged links, keeps `@`-hidden addresses and skips "p.m.Love"; a link in another alphabet or with a hidden address is a strong sign. It must be the first action. |
| `rule_matches` | scamshield_agent.py:609 | One warning-sign rule: any of its `patterns`, or a `guarded_patterns` match that is not cancelled by an `unless` pattern (cancelled only when the text has no request words). This is how "can you send me a gift card" counts and "I'll send you a gift card for your birthday" does not. |
| `run_check_link` | scamshield_agent.py:705 | Classifies a link from the message as official, look-alike, known scam, IP address, other alphabet, short link or unknown, using a local list and edit distance (`classify_domain`, line 321; `normalize_domain`, line 285, drops anything before an `@`). It never opens the link. |
| `run_check_sender` | scamshield_agent.py:740 | Is the real sender a saved contact? "Not saved" is recorded as a note, not a warning sign. |
| `run_lookup_official_contact` | scamshield_agent.py:772 | Returns the real phone number of an organization the message claims to be, from a trusted list. Python later uses it in the "what to do" line. |
| `run_search_scam_guide` | scamshield_agent.py:807 | Calls `rag.search` with the model's query and optional filter plus the warning signs Python found. At most 3 searches; a missing guide file raises and becomes a tool failure. |
| `run_ask_human_helper` | scamshield_agent.py:854 | Asks for consent through the passed-in consent function, then writes a simulated alert to a log file. Nothing is ever sent. |
| `supported_label` | scamshield_agent.py:1210 | The label the recorded evidence supports: scam with 1 strong or 2 weak signs; safe only with a saved contact, at most 1 weak sign, all links official and no tool failure; otherwise uncertain. It ignores what the model says. |
| `check_verdict` | scamshield_agent.py:1268 | The verdict gate: label valid, cited ids exist, explanation given, label matches the supported label (with the uncertain rules), "safe" is refused after the model proposed scam or uncertain earlier in the run, and every strong sign is mentioned. Returns each rule with ok/detail, so feedback shows expected vs. actual. |
| `handle_done` | scamshield_agent.py:1757 | Runs the gate (against the labels proposed before this one), then records the label; on rejection sends feedback or, after 2 rejections, sets `gate_downgraded`. A rejected likely_scam with no recorded sign gets feedback inviting "uncertain" + `ask_human_helper`, and after a concern the feedback never says "Python can support: likely_safe". On acceptance it runs the readability check (one rewrite, then template). |
| `check_readability` | scamshield_agent.py:1364 | Verdict in the first sentence, at most 6 sentences of at most 22 words, no jargon, links or long numbers. Returns the list of problems. |
| `choose_stop_reason` | scamshield_agent.py:1839 | Precedence: invalid_input > model_error > tool_failure > gate_downgrade > no_progress > step_limit > success. A tool failure is reported even if a verdict was accepted. |
| `finish_run` | scamshield_agent.py:1853 | Picks the final label (accepted verdict, or Python's supported label, never "safe" after an unfinished run, and never "safe" when the model raised a concern: `model_was_concerned`, line 1823; this also applies to an accepted "safe" after an earlier concern, as a backstop), offers human help for "uncertain" (post-checked and saved as an extra trace step with `state_update` "offered by Python"), sets `helper_offered_by` (`model_helper_source`, line 1831), writes the "what to do" line and a guide tip that fits the message (`tip_is_relevant`, line 1468: an entry about an organization must name the claimed one, a general entry's first red flag must be a found strong or weak sign, and family-and-friends entries are not shown for a message claiming an organization), saves the JSON trace (with `system_prompt` and `first_request`) and marks the checkpoint finished. Prints the result banner. |
| `rag.search` | rag.py:194 | Scores guide entries 50% embedding cosine + 50% keyword overlap (or keyword only), applies the model's metadata filters, boosts entries whose red flags match the found warning signs and halves entries about another organization. Falls back to keyword search if embeddings are unavailable and says so. |

## 3. The gate rules (say them like this)

- **likely_scam**: at least 1 strong warning sign or at least 2 weak ones.
- **likely_safe**: saved contact AND no strong signs AND at most 1 weak sign AND every link checked and official AND no tool failure.
- **uncertain**: everything else. Rejected if a strong sign was found. Rule "help must be offered before uncertain".
- **No "safe" after a concern**: once the model proposed likely_scam or uncertain, a later likely_safe is rejected
  ("you raised a concern earlier; answer uncertain and use ask_human_helper").
- Always: the label is one of the three, cited evidence ids exist, the explanation is not empty and mentions every strong sign.
- Rejection feedback = the failed rule + expected vs. actual + "with the evidence so far, Python can support: X"
  (except after a concern, when "safe" is never offered).
- 2 rejections: Python uses the supported label (`gate_downgrade`) and its template explanation,
  except that the model's concern only ever makes the answer more careful: if the supported label is
  "safe" but the model said likely_scam or uncertain at any point, the final answer is "not sure" with help offered.
  `finish_run` also turns an accepted "safe" after an earlier concern into "not sure" (backstop).

## 4. Likely professor questions, with short honest answers

1. **If Python decides the label, what does the LLM decide?**
   The investigation: which tool to call next and with which argument, what to search for, when it has
   enough evidence, which label to propose with which evidence, and the wording of the explanation.
   Python only checks. On most runs the model's own label is accepted; the gate matters on the hard cases
   (unknown senders where the model says "safe" too quickly, explanations that skip a strong sign).

2. **Then why not just use the rules without a model?**
   The rules alone can label a message, and `eval.py --rules` measures exactly that. The model adds the
   tool choice per message (different messages need different checks), the guide search queries and
   a plain, specific explanation. The project is honest that the safety comes from the gate.

3. **Why not LangGraph?**
   The rubric makes it optional and gives no credit for complexity. A plain loop keeps every decision
   and check visible in the demo; routing is a small precondition table (`ROUTING`), state is the
   `context` dictionary, and checkpoint/resume is implemented directly.

4. **How is this agentic and not a fixed pipeline?**
   There is no fixed order beyond `extract_signals` first. The model picks the next tool from the actions
   that are available given the evidence so far, and stops when it thinks it has enough. The saved runs
   show different tool sequences for different messages.

5. **What happens if Ollama times out or is down?**
   The call is retried up to 2 times after a short wait; each retry is recorded in the step's
   `model_retries`. If it still fails, the run stops with `model_error` and the answer is "not sure",
   never "safe". Tests: "model unreachable -> model_error" and "model fails once, retry works -> success".

6. **Show me a problem case.** Run `python3 scamshield_agent.py --case guide_missing --consent yes`:
   the guide search fails, the tool is disabled, the stop reason is `tool_failure`, and the answer is
   "not sure" with an offer of human help. Or `--case injection` (see `docs/DEMO_SCRIPT.md`).

7. **How do you stop prompt injection?**
   The message is wrapped in markers with a random tag and labeled untrusted, and text aimed at an AI is
   a strong warning sign. The real defense is the gate: "safe" is only accepted when the recorded evidence
   supports it, no matter what the model was told.

8. **Can the model make up a phone number or a link?**
   No. Tool arguments must come from the message, the "what to do" line is written by Python from the
   trusted list, and the readability check rejects phone numbers and links in the explanation.

9. **How do you know the tests can fail?**
   `python3 tests.py --break-gate` replaces `supported_label` with one that always says "likely_safe"
   and runs all tests; the number that fail is saved in `evidence/eval/break_gate_tests.txt`. The tests
   also use a scripted model that gives deliberately wrong answers.

10. **Isn't the evaluation biased, since you wrote the data?**
    Yes, that is the main limitation. Held-out set 1 was written before the round-1 fixes, but the
    rules were then adjusted after seeing its failures, so its later score is no longer a held-out score.
    Held-out set 2 was written and committed (with its rules-only BEFORE score) before any round-2 fix.
    (Naming: "review round N" is a critic review; the "round-N fixes" are the work done after it. Some
    older commit messages call the round-2 fixes "round-3".)

11. **What does the RAG add?**
    The guide tip in the answer and evidence for unclear messages. The measured gain over keyword search
    is small on this data, and the document says so.

12. **Why are all the commits on Nov 24?**
    Facts to start from: `git log` shows every commit on this branch dated Nov 24 (the first at 09:17);
    `DEVLOG.md` has dated entries for Nov 22, 23 and 24, and the project files were created before the
    first commit. **Answer this in your own words** (what you did on which day, and why you committed when you did).

13. **Which AI tools did you use?**
    Facts to start from (the same facts as the draft authorship statement in section 9 of the PDF): an AI
    coding assistant (Claude Code) wrote most of the code, tests and documentation from your instructions;
    you chose the project and the design (plain-Python course loop, verdict gate, metadata RAG), reviewed and
    directed every change, ran and checked the evaluations, and prepared the demo. Separate AI critic passes
    reviewed the work against the rubric in three review rounds, and the fixes are listed in the "Critic
    review" entries in `DEVLOG.md`; you verified the findings by running the code.
    **Answer this in your own words** (what you decided yourself, what you checked, what you would explain).

14. **Why can the model's concern never produce "safe"?**
    Python can block a label the evidence does not support, but a worried model may be noticing something
    the regex rules missed (a new scam wording). So when the gate gives up or the run ends, and the
    evidence supports "safe" but the model said likely_scam or uncertain at any point, the answer is "not
    sure" with human help offered, and the explanation says the helper thought something looked wrong but
    the checks could not confirm it (`model_concern_kept` in the trace). A later "safe" after a concern
    is also rejected by the gate itself, and `finish_run` repeats the rule as a backstop. Tests: "model
    concern never becomes safe", "scam then safe is never safe", "uncertain then safe is never safe".
    Live demo: `--case model_catches_miss` (a cash-courier text from a saved contact that the rules miss).
    Honest limit: the rule only helps when the model is worried. In 2 of the 6 saved runs (keyword mode)
    the model was not worried, the rules found nothing, and the answer was "safe".

15. **What do the `helper_offered_by` values mean?**
    `model`: the model called `ask_human_helper` before any gate feedback told it to. `model_after_gate_hint`:
    it did so after a gate rejection that mentioned `ask_human_helper`. `python`: Python offered help
    because the final answer was "not sure" and nobody had offered it. `null`: no help was offered (scam or
    safe). `eval.py` and `harness_runs.py` count these values.

16. **How was held-out set 2 protected?**
    `data/eval_holdout2.json` and `evidence/eval/holdout2_rules_BEFORE.txt` were committed together, before
    any round-2 rule change (see `git log -- data/eval_holdout2.json`); the file is never edited after
    that. The AFTER score is in `holdout2_rules_AFTER.txt`. Caveat: the round-2 rules came from the
    critic's probe list, and some probes share wording with holdout2, so BEFORE is the honest held-out number.

17. **Does the post-check really verify anything?**
    For the local lookup tools it confirms the result was recorded consistently; there is no outside
    state to inspect. The simulated alert is the only side effect, and it is read back from the log
    (also when Python makes the help offer). The independent check is the verdict gate.

18. **What is the evidence ledger and why is it never trimmed?**
    The chat history keeps only the last 10 messages, so a small model could forget which `E#` ids exist.
    The ledger lists all evidence with every tool result, so citations stay valid.

19. **What would you do next?**
    Test with real (anonymized) scam texts, ask older adults whether the explanations help, grow the
    website list, and connect a real, consented family alert.

20. **What happens with an empty message?** Python stops before the model is called (`invalid_input`).

21. **What is in a trace?** Per step: step, raw_reply, action, argument, parse_ok, validation_ok,
    available_actions, evidence_id, observation (the exact feedback), check_result (post-check or gate
    rules; a tool that raised an error gets "not run"), state_update, continue_or_stop, model_retries.
    At the top: the exact system_prompt and first_request, the final label, stop reason, evidence,
    helper_offered_by and model_concern_kept.

## 5. Numbers

Do not memorize numbers from this file: read them from `docs/ScamShield_Project_Document.pdf`
(section 6), which is rebuilt from the evidence files with `python3 docs/build_docs.py`.
