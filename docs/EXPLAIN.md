# ScamShield study guide: explaining the system from memory

Line numbers refer to `scamshield_agent.py` and `rag.py` after the simplification of Nov 24
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

### The robust browser agent note, section by section

| Note section | Where in `scamshield_agent.py` |
|---|---|
| §1 Controlled, meaningful actions | `TOOLS` (6 tools + `done`) |
| §2 Good observations | `evidence_ledger`, `available_actions` shown after every step |
| §3 Validation before actions | `validate_*` functions, `run_requested_tool`, `precondition_met` / `ROUTING` |
| §4 Checks after actions | `post_check` (lookups: recorded consistently; the alert is read back from the log) |
| §5 Independent success rule | `supported_label`, `check_verdict` (the gate), `finish_run` |
| §6 Errors, recovery, budgets | `MAX_MODEL_RETRIES`, `record_tool_failure`, `MAX_STEPS`, `NO_PROGRESS_LIMIT` |
| §7 State and traces | `new_context`, the per-step trace record saved by `finish_run` |
| §8 Hidden instructions | random-tag markers in `make_request_message`, the `ai_directed` sign, the gate |
| §9 Human approval | `ask_for_consent` / `prompt_consent` (type SEND), simulated alert |

## 2. Key functions (file:line and two sentences each)

| Function | Where | What it does |
|---|---|---|
| `run_agent` | scamshield_agent.py:1638 | The main loop: input check, then per step ask the model (with up to 2 retries), parse, route `done` to the gate or a tool to `run_requested_tool`, and append the result + ledger + AVAILABLE ACTIONS to `messages`. It ends by calling `finish_run`. |
| `ask_model` | scamshield_agent.py:1224 | Calls Ollama `/api/chat` with `qwen3:8b`, `think=false`, `format=json`, `num_ctx` 8192 and a 180 s timeout. Tests replace it with a scripted model function. |
| `parse_action` | scamshield_agent.py:1243 | Strips think tags and code fences, then requires valid JSON with exactly the keys `action` (text) and `argument` (dictionary). It returns `(proposal, '')` or `(None, reason)`. |
| `ROUTING` | scamshield_agent.py:975 | A table with one plain precondition per action (e.g. `ask_human_helper`: "after check_sender, and only once"). The same text is sent to the model when a proposal is rejected. |
| `precondition_met` | scamshield_agent.py:1010 | Checks one ROUTING precondition against the `context` state (links still unchecked, sender checked, searches left, broken tools). This is what makes routing conditional instead of a fixed order. |
| `available_actions` | scamshield_agent.py:1033 | Lists every action whose precondition holds right now. It is shown to the model after every step and stored in each trace step. |
| `run_requested_tool` | scamshield_agent.py:1110 | Rejects unknown or not-allowed actions, keeps only declared argument keys, runs the tool's `validate`, blocks repeated calls, runs the tool inside try/except, checks the result shape and runs `post_check`. On success it records evidence `E#`; on failure it records a tool failure and disables that tool. |
| `post_check` | scamshield_agent.py:1066 | After a tool says it worked, confirms the result was recorded consistently (link in `link_results`, sender marked checked, search query recorded). For the local lookup tools there is no outside state to inspect; the simulated alert is the only side effect and is read back from the log file. The independent check of the answer is the verdict gate. |
| `evidence_ledger` | scamshield_agent.py:1055 | One line per evidence item, sent with every tool result and never trimmed. A small model therefore never forgets which `E#` ids exist. |
| `run_extract_signals` | scamshield_agent.py:640 | Regex scan for strong and weak warning signs, links, phone numbers, claimed organizations and text aimed at an AI, on NFKC-normalized text and on a copy with disguises undone (`g1ft`, `g i f t`, Cyrillic/Greek look-alike letters via `CONFUSABLES`, line 146). Links come from `find_links` (line 234), which restores defanged links, keeps `@`-hidden addresses and skips "p.m.Love"; a link in another alphabet or with a hidden address is a strong sign. It must be the first action. |
| `rule_matches` | scamshield_agent.py:619 | One warning-sign rule: any of its `patterns`, or a `guarded_patterns` match that is not cancelled by an `unless` pattern (cancelled only when the text has no request words). This is how "can you send me a gift card" counts and "I'll send you a gift card for your birthday" does not. |
| `run_check_link` | scamshield_agent.py:715 | Classifies a link from the message as official, look-alike, known scam, IP address, other alphabet, short link or unknown, using a local list and edit distance (`classify_domain`, line 331; `normalize_domain`, line 285, drops anything before an `@`). It never opens the link. |
| `run_check_sender` | scamshield_agent.py:750 | Is the real sender a saved contact? "Not saved" is recorded as a note, not a warning sign. |
| `run_lookup_official_contact` | scamshield_agent.py:817 | Returns the real phone number of an organization the message claims to be, from a trusted list, and compares it with every phone number in the message (`compare_message_numbers`, digits only, last 10 digits). No official number in the message adds the strong sign `unofficial_number`. Python also uses the number in the "what to do" line. |
| `run_search_scam_guide` | scamshield_agent.py:858 | Calls `rag.search` with the model's query and optional filter plus the warning signs Python found, and records the query. At most 3 searches; a missing guide file raises and becomes a tool failure. |
| `run_ask_human_helper` | scamshield_agent.py:901 | Asks for consent through the passed-in consent function, then writes a simulated alert to a log file. Nothing is ever sent. |
| `supported_label` | scamshield_agent.py:1267 | The label the recorded evidence supports: scam with 1 strong or 2 weak signs; safe only with a saved contact, no strong signs, at most 1 weak sign, every link checked and official, the official number looked up whenever the message gives a phone number for an organization it claims (`orgs_needing_lookup`), and no tool failure; otherwise uncertain. It ignores what the model says. |
| `check_verdict` | scamshield_agent.py:1341 | The verdict gate: label valid, cited ids exist, explanation given, label matches the supported label (with the uncertain rules), "safe" is refused after the model proposed scam or uncertain earlier in the run or called `ask_human_helper` itself (`model_was_concerned`, line 1864), and every strong sign is mentioned. Returns each rule with ok/detail, so feedback shows expected vs. actual. This is the one place the concern rule is enforced. |
| `handle_done` | scamshield_agent.py:1795 | Runs the gate (against the labels proposed before this one), then records the label; on rejection sends feedback or, after 2 rejections, sets `gate_downgraded`. A rejected likely_scam with no recorded sign gets feedback inviting "uncertain" + `ask_human_helper`, and after a concern the feedback never says "Python can support: likely_safe". On acceptance it runs the readability check (one rewrite, then template). |
| `check_readability` | scamshield_agent.py:1438 | Verdict in the first sentence, at most 6 sentences of at most 22 words, no jargon, links or long numbers. Returns the list of problems. |
| `choose_stop_reason` | scamshield_agent.py:1875 | Precedence: invalid_input > model_error > tool_failure > gate_downgrade > no_progress > step_limit > success. A tool failure is reported even if a verdict was accepted. |
| `finish_run` | scamshield_agent.py:1889 | Picks the final label: the accepted verdict, or (when the gate gave up or the run ended) Python's supported label, never "safe" after an unfinished run and never "safe" when the model was concerned. Offers human help for "uncertain" (post-checked and saved as an extra trace step with `state_update` "offered by Python", `helper_offered_by` = `python`), writes the "what to do" line and a guide tip that fits the message (`tip_is_relevant`, line 1542: an entry about an organization must name the claimed one, a general entry's first red flag must be a found strong or weak sign, and family-and-friends entries are not shown for a message claiming an organization), saves the JSON trace (with `system_prompt` and `first_request`) and prints the result banner. |
| `rag.search` | rag.py:117 | Metadata search over the scam guide: scores entries by keyword overlap (rare words count more), applies the model's metadata filters (`org`, `scam_type`), boosts entries whose red flags match the found warning signs and halves entries about another organization. Returns the top 2 matches above a minimum score. |

## 3. The gate rules (say them like this)

- **likely_scam**: at least 1 strong warning sign or at least 2 weak ones.
- **likely_safe**: a saved contact, no strong signs, at most 1 weak sign, every link checked and official, the official number looked up whenever the message gives a phone number for an organization it claims, and no tool failure.
- **Phone numbers**: `lookup_official_contact` compares the numbers in the message with the official number;
  if none is official, the strong sign `unofficial_number` ("asks you to call a number that is not the official ... number").
- **uncertain**: everything else. Rejected if a strong sign was found. Rule "help must be offered before uncertain".
- **No "safe" after a concern**: once the model proposed likely_scam or uncertain, or called `ask_human_helper`
  itself (Python's own help offer does not count), a later likely_safe is rejected
  ("you raised a concern earlier; answer uncertain and use ask_human_helper").
- Always: the label is one of the three, cited evidence ids exist, the explanation is not empty and mentions every strong sign.
- Rejection feedback = the failed rule + expected vs. actual + "with the evidence so far, Python can support: X"
  (except after a concern, when "safe" is never offered).
- 2 rejections: Python uses the supported label (`gate_downgrade`) and its template explanation,
  except that the model's concern only ever makes the answer more careful: if the supported label is
  "safe" but the model said likely_scam or uncertain or asked for human help at any point, the final answer is "not sure" with help offered.

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
   `context` dictionary, and every step is saved in a JSON trace.

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
    For test sets 1 to 3, yes. Test set 2 was written before the round-1 rule fixes and test set 3
    (committed with its rules-only BEFORE score) before the round-2 fixes, but both were then used to fix
    rules, so they are no longer held out. That is why there is a fourth set: the large blind test set,
    614 messages written by a separate AI agent that never saw the rules, the code, the guide or the
    other sets, and frozen. (Naming: "review round N" is a critic review; the "round-N fixes" are the
    work done after it. Some older commit messages call the round-2 fixes "round-3"; older files call
    test sets 2 and 3 "holdout" and "holdout2".)

    **What did the blind test show?** One live run per message (`evidence/eval/large_agent_results.json`):
    the full agent got 513/614 = 84% right (95% range 80% to 86%), with 2 false "safe" answers. The rules
    alone got 526/614 = 86% but called 13 scams "safe". So the agent is slightly less accurate but much
    safer: it turned 11 of those 13 into "not sure". 90 of its 101 mistakes are "not sure", which sends the
    person to a human. In 43 of them the model had the right label, but the gate found no strong warning
    sign and lowered the answer. The 2 false "safe" (X0159, X0580) came from saved contacts: a "read me the
    code" request and a fake bank courier. They were not fixed afterwards, so the test stays blind.

11. **What does the guide search add, and is it RAG?**
    The guide tip in the answer and evidence for unclear messages. It is keyword retrieval with metadata
    rules (org filter, red-flag boost, other-organization penalty), not embeddings. Earlier versions also
    had an embedding search; it measured almost no gain on this data, so it was cut to keep the agent
    small and easy to explain.

12. **Why are all the commits on Nov 24?**
    Facts: `git log` shows every commit dated Nov 24 (the first at 09:17); `DEVLOG.md` has entries for
    Nov 22 (planning), Nov 23 (building) and Nov 24 (evaluation and review rounds).
    *Answer:* "I planned the project on Nov 22 and built the first version
    locally on Nov 23 with the coding assistant. I created the GitHub repository on the morning of Nov 24
    and committed the existing work in logical pieces, then every review-and-fix round that day was
    committed as it happened. The commits were made by the coding assistant on my machine under my own git
    account, at my request, which is also why several have the same timestamp."

13. **Which AI tools did you use?**
    *Answer:* "I used an AI coding assistant. I chose the project, the scope and the
    design (the plain-Python loop from class, the verdict gate, a metadata search over the scam guide) and made
    the key calls during the work: no LangGraph, a held-out test written before rule changes, honest
    reporting of failures, and a 614-message test written by a separate agent that never saw the rules.
    The assistant wrote most of the code, tests and documentation. I set up a loop where critic agents
    graded the project against the rubric and a work agent fixed what they found, over five rounds, and
    when a review showed the project was getting over-complicated, I decided to cut the extras. I
    checked the results by running the tests and the live Ollama evaluations, and every number in the
    report is generated from saved evidence files."

14. **Why can the model's concern never produce "safe"?**
    Python can block a label the evidence does not support, but a worried model may be noticing something
    the regex rules missed (a new scam wording). So when the gate gives up or the run ends, and the
    evidence supports "safe" but the model said likely_scam or uncertain at any point, the answer is "not
    sure" with human help offered, and the explanation says the helper thought something looked wrong but
    the checks could not confirm it (`model_concern_kept` in the trace). The rule lives in one place, the
    gate: a later "safe" after a concern is rejected, and when the gate gives up `finish_run` uses the
    supported label but never "safe" for a concerned model. The same holds when the model itself called
    `ask_human_helper` and then said "safe". Tests: "model concern never becomes safe", "scam then safe is
    never safe", "uncertain then safe is never safe", "helper then safe is never safe".
    Backup demo: `--case model_catches_miss` (a cash-courier text from a saved contact that the rules miss).
    Honest limit: the rule only helps when the model is worried. In an earlier saved run the model was not
    worried, the rules found nothing, and the answer was "safe".

15. **What do the `helper_offered_by` values mean?**
    `model`: the model called `ask_human_helper` (the traces show it often does so only after a gate
    rejection told it to). `python`: Python offered help because the final answer was "not sure" and
    nobody had offered it. `null`: no help was offered (scam or safe). `eval.py` and `harness_runs.py`
    count these values.

16. **How was test set 3 protected before it was used for fixes?**
    `data/eval_holdout2.json` and `evidence/eval/holdout2_rules_BEFORE.txt` were committed together, before
    any round-2 rule change (see `git log -- data/eval_holdout2.json`); the file is never edited after
    that. The AFTER score is in `holdout2_rules_AFTER.txt`. Caveat: the round-2 rules came from the
    critic's probe list, and some probes share wording with test set 3, so BEFORE is the honest number.

17. **Does the post-check really verify anything?**
    For the local lookup tools it confirms the result was recorded consistently; there is no outside
    state to inspect. The simulated alert is the only side effect, and it is read back from the log
    (also when Python makes the help offer). The independent check is the verdict gate.

18. **What is the evidence ledger and why is it never trimmed?**
    The chat history keeps only the last 10 messages, so a small model could forget which `E#` ids exist.
    The ledger lists all evidence with every tool result, so citations stay valid.

19. **What would you do next?**
    Test with real (anonymized) scam texts, ask older adults whether the explanations help, grow the
    website list, connect a real, consented family alert, and save state to resume an interrupted run
    (the Canvas Nov 4 notes mention checkpointing; it is not implemented, to keep the agent small).

20. **Why did you cut features before the presentation?**
    The rubric gives no extra points for complexity, and every part must be explained in the talk. Checkpointing,
    the embedding search with three search modes, a duplicate safety backstop and some evaluation options
    were extras: they cost lines and explanation time without adding a rubric point. The core (loop, 6
    tools, routing, verdict gate, human help, problem cases, tests) is unchanged.

21. **What happens with an empty message?** Python stops before the model is called (`invalid_input`).

22. **What is in a trace?** Per step: step, raw_reply, action, argument, parse_ok, validation_ok,
    available_actions, evidence_id, observation (the exact feedback), check_result (post-check or gate
    rules; a tool that raised an error gets "not run"), state_update, continue_or_stop, model_retries.
    At the top: the exact system_prompt and first_request, the final label, stop reason, evidence,
    helper_offered_by and model_concern_kept.

23. **What happens when a message gives a phone number?**
    If it claims an organization, "safe" waits for `lookup_official_contact`. That tool compares the numbers
    in the message with the official number (digits only, last 10 digits). If none matches, the strong
    sign `unofficial_number` makes it a scam; if one matches, the fact "the number in the message is the
    official ... number" is recorded. This was added after the final review, when a "your account is
    locked, call 1-800-555-0199" text from the saved bank contact was called "safe". Limit: it only
    checks numbers for an organization the message names, not a family member asking you to call a stranger.

## 5. Numbers

Do not memorize numbers from this file: read them from `docs/ScamShield_Project_Document.pdf`
(section 6), which is rebuilt from the evidence files with `python3 docs/build_docs.py`.
