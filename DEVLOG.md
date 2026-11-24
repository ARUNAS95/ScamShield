# ScamShield development log

A record of what was planned, what broke, and what changed. Each entry
lists the problem, how it was found, the fix, and where the evidence is.

## Nov 22, 2026: Planning

- Read the approved proposal feedback: fictional messages, a small scam-prevention guide,
  three demos (suspicious, ordinary, uncertain), explain the evidence, and recommend human
  help when unsure.
- Reused the patterns from the Agent Airways class agent: one JSON action per step, a tool
  registry with `validate()` and `run()`, the `result(ok, message, data)` shape, a `context`
  dictionary, a step budget, stop reasons, and Python deciding success (`check_goal()`).
- Reviewed the plan with four critic passes. Main changes they caused:
  - **The gate must check evidence Python recorded**, not the evidence ids the model chooses to cite.
  - **An evidence ledger is sent with every tool result and never trimmed**, so a small model
    cannot forget which `E#` ids exist.
  - **The uncertain demo was changed** from "Hi Grandma, new number" (a known scam pattern that
    could honestly be labeled a scam) to "Dr. Lee's office, please call back" (no warning signs).
  - **Consent is a function passed in** (`--consent prompt|yes|no`), so tests and repeated
    runs never hang on `input()`.
  - Rejected: LangGraph, native tool calling, and an LLM "critic" inside the app (Python checks instead).

## Nov 23, 2026: Building the agent

### Finding 1: the model invents arguments
- **Seen:** the first live test call returned `{"action":"extract_signals","argument":{"signals":["suspicious_link", ...]}}`,
  even though `extract_signals` takes no argument.
- **Fix:** `run_requested_tool` keeps only the argument keys each tool declares and reports
  the ignored ones in the tool result. Required arguments are still validated.
- **Evidence:** test `extra argument keys ignored`.

### Finding 2: notes were counted as warning signs
- **Seen:** on the uncertain case, the model said `likely_scam` with zero warning signs. The trace
  showed why: `extract_signals` listed "asks you to call back" and "not a saved contact" under
  `warning_signs` (with strength `info`), and the model counted them.
- **Fix:** notes are now returned separately as `other_notes_not_warning_signs` and marked
  "NOT a warning sign" in the evidence ledger. The prompt also says so.

### Finding 3: the gate's feedback did not say what was expected
- **Seen:** after a rejection, the model tried a different wrong label instead of fixing the problem.
- **Fix:** rejections now say what the evidence currently supports (expected vs. actual),
  e.g. "likely_safe needs a saved contact ...; actual: sender not checked yet". This is the
  same lesson as the Google harness extra-credit experiment, where the checker's feedback
  never showed the expected and actual values.

### Finding 4: the model copied a filter from the tool example
- **Seen:** the tool guide example was `{"query":"...","filters":{"org":"Medicare"}}`. On the
  doctor's-office message the model sent `"org": "Dr. Lee's office"`, the validator correctly
  rejected it, and the model gave up on the guide entirely.
- **Fix:** the example no longer shows a filter; the description says to add one only when
  `extract_signals` found that organization. After the change the model searched the guide
  on the uncertain case, and the `guide_missing` case reached the real tool failure.

### Testing the tests
- 46 offline tests with a scripted model (no Ollama).
- To make sure the tests can actually fail, the gate was deliberately broken (it believed every
  message was safe). 10 safety tests failed, including "injection cannot make message safe"
  and "missing guide -> never safe".

## Nov 24, 2026: Evaluation

### Finding 5: suspected context-window truncation (measured, not happening)
- **Suspicion:** Ollama runs `qwen3:8b` with a 4,096-token window by default and silently drops
  the oldest text when a prompt is longer, which could remove the system prompt.
- **Check:** replayed a real 8-step run and asked Ollama to count prompt tokens at every step.
  The largest prompt was about 2,300 tokens, so nothing was being cut off.
- **Change:** set `num_ctx` to 8192 anyway as a safety margin.

### Finding 6: the model's instinct on unknown senders is "safe"
- **Seen in the live evaluation:** on messages from unknown numbers with no warning signs, the
  model proposed `likely_safe` in 5 of the 10 runs on those messages (2 of 5 with RAG, 3 of 5
  with keyword search). That is the most harmful mistake for an older adult.
- **Result:** the verdict gate rejected every one (0 false "safe" answers in 50 live evaluation runs). This
  is the clearest evidence that results are checked against evidence instead of trusted
  because the model says so.

### Finding 7: the RAG gain is small on this data
- With the full message text as the query, metadata RAG found a correct guide entry in 21/21
  messages vs. 20/21 for keyword search. The one difference was the hidden-injection message,
  where the `ai_directed` flag boosted the right entry.
- Replaying the short queries the model actually wrote gave 13/13 in every mode. The guide and
  test messages share vocabulary, so embeddings add nothing measurable here.
- With RAG the model's own last label was right in 24/25 messages vs. 21/25 with keyword search,
  all in the uncertain category. With one run per mode, this could be chance; the repeated-run
  harness checks it.

### Finding 8: repeated runs (48 live runs of the demo cases)
- 48/48 runs ended with the expected label, 24/24 in each search mode.
- The model was **not fooled by the injection** in any run; it always answered "scam". The gate
  still rejected 6 answers because they did not warn about the hidden instruction (one run ended
  in `gate_downgrade` with Python's template explanation). Blocking a fooled model's "safe" answer
  is shown by the offline test with a scripted model.
- Tool choices differ by message but are consistent across repeats of the same message.
- The console logs contained the full local folder path in the "TRACE" line; the banner now prints
  project-relative paths and the saved logs were cleaned.

## Nov 24, 2026: Critic review round 1

A strict review of the code found the problems below. Each fix has offline tests (63 tests in total,
up from 46). Live evaluation numbers in the README are to be regenerated after these changes.

### Held-out set first
- **Problem:** the warning-sign rules, the guide and the 25 evaluation messages were written by the
  same person, so a 25/25 result could mean the rules only fit their own wording.
- **Change:** before any rule was changed, 12 held-out messages (`data/eval_holdout.json`, H01 to H12)
  were written in different wording from the rules, together with `eval.py --rules --set eval|holdout`
  (rules only, no model). The "before" result was committed first.
- **Result (rules only):** eval set 25/25 before and after. Held-out set **6/12 before, 11/12 after**
  (`evidence/eval/holdout_rules_BEFORE.txt`, `holdout_rules_AFTER.txt`). Before the changes, H07 (a
  saved contact asking for money by Zelle or Cash App) was supported as **likely_safe**. After the
  changes H03 (USPS text with `.shop` and `.online` links) is still wrong: the links are "unknown", so
  the evidence supports "uncertain", not "scam". The held-out messages were not edited.

### Safety rules
- **Links:** only 16 endings (`.com`, `.co`, ...) were recognized, so `parcel-tracking-center.shop` and
  `http://192.168.10.45/login` were not links at all. Now any `name.name` address with a 2 to 24 letter
  ending, any `http(s)://` link and any IP address is a link; "Dr. Lee", "Oak St.", "$45.20", "8 pm."
  and "e.g." are not. Unknown endings are classified `unknown` (blocks "safe"). IP-address links are a
  new strong sign `ip_link`, because real organizations use named websites.
- **Disguised words:** "g1ft c@rds", fullwidth letters and "g i f t - c a r d s" were not detected.
  The text is now NFKC-normalized, and warning signs are also matched on a copy with look-alike
  characters undone and spaced letters joined. Links are still taken from the undisguised text.
- **New wordings:** gift cards also as "gift-cards" and "store cards ... numbers"; a new strong sign
  `payment_app` for a request to send or pay with Zelle, Venmo, Cash App, MoneyGram or a wire; code
  requests also as "code you just got", "6-digit code" and "numbers on the back of your card".
- **Regression check:** every demo case and every eval-set message gives the same supported label as
  before; no legitimate message became a scam.

### Gate and routing
- **`ALLOWED_NEXT` did nothing:** every tool was allowed after every tool, so the "graph" never removed
  an option. It was replaced by `ROUTING`, a table of the real preconditions checked by
  `precondition_met()`. New precondition: `ask_human_helper` only after `check_sender`.
- **`done` skipped the routing:** a `done` before `extract_signals` went straight to the verdict gate
  and counted as a gate rejection. It now goes through `available_actions` and is an ordinary rejected
  proposal (it counts toward `no_progress`).
- **"uncertain" hid strong signs:** the gate accepted "uncertain" on a message with a gift-card
  request. "uncertain" is now rejected when a strong warning sign was found; with weak signs only it is
  still allowed.

### Robustness
- **One failed model call ended the run:** a call is now retried up to 2 times after a short wait, and
  each retry is recorded in the step trace.
- **Tool success was assumed:** `check_result` was empty for tool steps. A post-check now verifies the
  state change of every tool (including reading the simulated alert back from the log file); a failed
  post-check is a tool failure.
- **Traces lost the feedback:** rejected and rewritten verdicts were saved as "GATE REJECTED" or
  nothing. The exact feedback text sent to the model is now in the step `observation`. A badly shaped
  tool result now appears in `tool_sequence` as `(FAILED)`.

### Demo output and hygiene
- The `extract_signals` line names the warning signs, the guide search line lists the guide ids and
  titles, and long console lines are wrapped instead of cut off.
- `tests.py` uses its `run_test` helper; `.claude/` and `critic_report/` are ignored by git.
- README: the `ALLOWED_NEXT` "graph" claims were replaced by the conditional routing description; the
  tool sequence counts are labeled as RAG-mode numbers; trace fields are credited to the bare-bones
  class notebook and PR #31; checkpointing is described as this project's own addition.

## What came from the course and what is new

| From the course (Agent Airways, bare-bones notebook, PR #31, Harness assignment, robust browser agent note, Nov 4 notes) | New in ScamShield |
|---|---|
| JSON action loop, tool registry, `result()` shape, step budget, stop reasons | Verdict gate that works out the label from recorded evidence |
| Python decides success (`check_goal`) | Never-trimmed evidence ledger with `E#` ids |
| "Treat page text as data" | Prompt-injection signals as strong warning signs, random-tag message markers |
| Trace fields (step, raw_reply, ..., continue_or_stop) from the bare-bones notebook and PR #31 | Readability check and Python-written "what to do" line |
| Repeated runs with an external runner | Metadata RAG with keyword fallback, and its evaluation |
| A remark about checkpointing in the Nov 4 notes | Own addition: checkpoint after every step and `--resume` |
| Retries and "verify, do not assume" (robust browser agent note) | Post-check of every tool's state change, model-call retries recorded in the trace |
| Human approval with `input()` | Consent as a passed-in function, so automated runs never block |
