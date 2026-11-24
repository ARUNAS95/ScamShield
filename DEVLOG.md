# ScamShield development log

A record of what was planned, what broke, and what changed. Each entry
lists the problem, how it was found, the fix, and where the evidence is.

Naming: "Critic review round N" is a strict review of the repository; the
"round-N fixes" are the changes made after it. Some older commit messages
call the round-2 fixes "round-3"; the commits cannot be renamed, so this
note records the mapping.

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

## Nov 24, 2026: Critic review round 2

A second strict review found one safety bug in the gate fallback, rule gaps that new wording slipped
through, and several honesty and visibility problems. Each finding and its fix:

### Held-out set 2 first
Before touching any rule, a new held-out set (`data/eval_holdout2.json`, F01 to F14) was written in
wording no rule had been written for: brand gift cards with "claim numbers", a Cyrillic look-alike link,
a defanged link, a card-photo request, "CashApp me", PayPal friends and family, a "six number code", and
harmless saved-contact texts with risky words ("I'll pay you back on Venmo", a gift card as a birthday
present, "the wifi password is ...", "5 p.m.Love you"). It was committed together with its rules-only
score: **2/14, with 5 false "safe" and 4 false alarms** (`evidence/eval/holdout2_rules_BEFORE.txt`).
After the rule changes below: **13/14, 0 false "safe", 1 false alarm**
(`evidence/eval/holdout2_rules_AFTER.txt`). The remaining miss is F11 ("I paid the fee today, thanks for
the $40"): urgency + money request are two weak signs. The set was not edited. Caveat: the new rules came
from the critic's probe list, and some probes share wording with holdout2, so the AFTER score is
optimistic; BEFORE is the honest held-out number. Held-out set 1 is no longer a held-out score either,
because its failures drove the round-1 fixes.

### The gate-fallback bug (blocker) and its structural fix
- **Bug:** when the model said "likely_scam" twice on a message where the rules found nothing (for
  example a Cyrillic look-alike link from a saved contact, before the new rules), the gate rejected both
  answers, gave up, and used the label the evidence supported: **"likely safe"**. The model had seen the
  danger, and Python turned that into "safe".
- **Fix (a principle, not a patch):** Python can block an unsupported label, but the model's concern can
  only make the answer more careful, never less. In `finish_run`, if there is no accepted verdict and the
  evidence supports "safe" but the model proposed likely_scam or uncertain at any point, the final
  answer is "uncertain" with human help offered, and the explanation says the helper thought something
  looked wrong but the checks could not confirm it (`model_concern_kept` in the trace). Test: "model
  concern never becomes safe".
- **Looping:** when the gate rejected a "likely_scam" because no warning sign was recorded, the model
  just tried again. The feedback now invites it to answer "uncertain", say what worries it, and use
  `ask_human_helper`.

### Rule and parser gaps
- **Other alphabets:** Cyrillic and Greek look-alike letters (а е о р с у х і ј ѕ ԁ ӏ, ο α ε ν ρ τ) are
  mapped to Latin in the warning-sign copy, so "gіft cаrd" is found. Links may contain any letters, and a
  link with letters outside a-z (or an `xn--` address) is a new strong sign, `lookalike_letters_link`.
- **Defanged links:** `[.]`, `(.)`, `(dot)` and `hxxp(s)` are restored before links are found.
- **Hidden addresses:** `normalize_domain` drops anything before `@`, so `http://user@203.0.113.9/x` is
  an IP link and `medicare.gov@evil-login.ru` is checked as `evil-login.ru`. Such a link is a new strong
  sign, `hidden_address_link`. E-mail addresses are still not links.
- **Requests only:** gift cards (including brand cards such as Apple, Steam, Google Play, Target, and a
  gift emoji with numbers), money apps ("CashApp me $50", PayPal friends and family), passwords and PINs
  now count only when they are requested. A gift card given as a present, "I'll pay you back on Venmo"
  and "the wifi password is ..." are not warning signs. A rule can now have `guarded_patterns` that an
  `unless` pattern cancels, but only when the text has no request words.
- **Card photos:** "a photo of the front and back of your debit card" is a new strong sign,
  `card_details_request`.
- **False links:** "5 p.m.Love you", "Oak St.Apt" and "8 a.m.See you" are no longer links (known
  abbreviations, and a capital letter after a dot starts a sentence unless the ending is a common one
  such as ".Com").
- **Regression lists in `tests.py`:** 17 ordinary texts that must stay safe and 15 critic probes that
  must be scams; every demo case, the eval set (25/25) and held-out set 1 (11/12) keep their labels.

### Agentic honesty and visibility
- `helper_offered_by` is now `model` (the model asked for help on its own), `model_after_gate_hint`
  (after a gate rejection told it to) or `python`. Earlier, help requested after a gate hint was counted
  as the model's own idea. Both summaries count the values.
- The verbose console prints `NEXT OPTIONS:` after each step, so routing is visible in the demo.
- The gate rule now reads "help must be offered before uncertain".

### Robustness and traces
- `--resume` of a finished checkpoint refuses ("this run already finished: <label>") instead of
  asking the model again.
- The "uncertain" template no longer says "we could not confirm who sent it" for a saved contact.
- A tool that raises an error still gets a `check_result` ("not run").
- Each trace saves the exact `system_prompt` and `first_request`; the first request's actions come from
  `available_actions()`, and the prompt's sentence limit is the one `check_readability` enforces (6).
- The harness checksums now cover `eval.py` and the organization, domain and contact files; `eval.py`
  writes its own `evidence/eval/source_checksums.txt`.
- `OLLAMA_URL`, `SCAMSHIELD_MODEL`, `OLLAMA_EMBED_URL` and `SCAMSHIELD_EMBED_MODEL` can be set as
  environment variables; `docs/build_docs.py` finds Chrome through `CHROME_PATH`, macOS or the PATH.
- Guide tips must fit the message: a tip is shown only when its red flags include a found strong sign
  or its organization is the one the message claims (the USPS injection case no longer shows the
  grandparent tip).

### Testing the tests again
`python3 tests.py --break-gate` replaces `supported_label` with "always likely_safe" and runs all
tests: **19 of 80 fail** (`evidence/eval/break_gate_tests.txt`). The earlier counts (10 of 46 above,
and 16 of 63 in the round-1 README) came from one-off manual experiments; it is now reproducible.

## Nov 24, 2026: Critic review round 3

A third review found one remaining safety hole, rule gaps, and places where the documents claimed more
than the code or the evidence shows. Each code fix has offline tests (88 tests in total, up from 80).
The live evidence is regenerated after these changes.

### The "concern then safe" hole (safety)
- **Problem:** the round-2 rule only applied when the gate gave up. If the model said likely_scam (rejected:
  no recorded sign) and then likely_safe, the gate accepted "safe", because the feedback had even told it
  "Python can support: likely_safe". The model's concern was lost.
- **Fix:** `check_verdict` now rejects likely_safe after the model proposed likely_scam or uncertain earlier
  in the run ("you raised a concern earlier; answer uncertain and use ask_human_helper"), the feedback no
  longer offers "safe" after a concern, and `finish_run` turns an accepted "safe" after a concern into
  "uncertain" with help as a backstop. Tests: "scam then safe is never safe", "uncertain then safe is
  never safe", "accepted safe after a concern becomes uncertain (backstop)".

### A demo case the rules miss
- `model_catches_miss`: a saved contact (Emma) asks for cash to be handed to a stranger at the door. No rule
  matches, so the evidence alone supports "safe". In one live check (`--case model_catches_miss`, RAG) the
  model searched the guide, proposed likely_scam twice and offered human help after the gate hint; the gate
  rejected both scam answers and the run ended **not sure** (`gate_downgrade`). See "Live results after the
  round-3 fixes" below for the repeated runs, where it was called "safe" twice.

### Rule coverage
- New request wordings: Remitly, Wise, Google Pay, Apple Pay and Western Union; "I need you to wire 2000"
  (a wire amount counts only with request words, so "thanks for the wire" does not); bank routing and
  account details, sign-in codes, online banking logins and Medicare numbers; crypto wallet addresses,
  USDT and "wallet address". "Venmo me back" is no longer flagged, and a card photo counts only for a bank
  card, so "a photo of the front of the card I made for you" is harmless.
- These are a regression list in `tests.py` (16 scams, 6 harmless texts), not a held-out score. The eval
  set stays 25/25, held-out set 1 11/12 and held-out set 2 13/14 (rules only), and every demo case keeps
  its label.

### Smaller fixes
- **Guide tips:** an entry about an organization is shown only for that organization, a general entry
  only when its main (first) red flag was found, and family-and-friends entries never for a message that
  claims an organization. The USPS injection case shows neither the grandparent (G05) nor the hacked
  friend (G09) tip; the Medicare scam still shows G01 and G02.
- **Help offered by Python** is post-checked like the tool (the alert log is read back) and saved as a
  trace step (`raw_reply` null, `state_update` "offered by Python"). The `steps` count stays the number of
  model steps.
- **Prompt:** the explanation rules now say "at most 22 words each" (the readability limit).
- **Settings:** a subprocess test shows that `SCAMSHIELD_MODEL` really overrides the model.

### Documents
- The post-check is described honestly: for the local lookups it confirms the result was recorded
  consistently (there is no outside state to inspect); the alert is read back from the log; the
  independent check is the verdict gate.
- The document build now reads the held-out set 2 live results, adds them to the PDF table and the
  results slide, and computes the total of live runs and false "safe" answers from every result file.
- The autonomy claims in the PDF were reworded to match the traces (the model usually checks the link,
  sender and guide before proposing "likely scam"; it offers human help most often after a gate hint).
- The README quotes the Canvas post on state management, verification and checkpointing and no longer
  presents the LangSmith comparison as course material.
- The authorship statement in the PDF was replaced by an accurate draft, marked for Aruna to rewrite.

### Testing the tests again
`python3 tests.py --break-gate`: **21 of 88 fail** with the broken gate (`evidence/eval/break_gate_tests.txt`).

## Nov 24, 2026: Live results after the round-3 fixes

- 156 live runs (eval, held-out sets 1 and 2, demo harness; both search modes). Labeled sets: eval 25/25,
  held-out 1 11/12 (H03 "not sure"), held-out 2 13/14 (F11 false alarm) in both modes; demo harness 52/54.
- **The first false "safe" answers:** in 2 of 3 keyword runs of `model_catches_miss`
  (`evidence/harness/keyword/run_model_catches_miss_1_trace.json`, `_2_`) the rules found nothing, the
  guide search returned an irrelevant entry (G13), and the model proposed "likely safe" with no earlier
  concern, so the gate had nothing to block. The RAG runs ended "not sure" 3/3, but the model's judgment
  also varied, so this does not prove RAG caused the difference. The case was **not tuned** afterwards.
- Documents and slides that said this case is "never safe" were corrected.

## Nov 24, 2026: Critic review round 4 (final review)

- Course alignment graded Full; criteria estimated at 27/30, 19/20, 19/20, 13/15, 9/10 (branch), 2/5.
- Two more safety gaps were found and are **documented, not fixed**, because fixing them changes the agent
  code and every piece of live evidence would have to be regenerated:
  1. A phone number in the message that differs from the claimed organization's official number is not
     used as evidence. In a critic's live check a "your account is locked, call 1-800-555-0199" text from
     the saved bank contact was called "safe", although `lookup_official_contact` had returned the real
     number.
  2. If the model offers human help and then proposes "safe", the gate accepts it: `model_was_concerned`
     only looks at earlier scam/uncertain labels.
- Docs-only fixes: slide 10 title, README tool-sequence count and limitation wording, test name for the
  `model_catches_miss` case, EXPLAIN round count and a robust-note section table.

## Nov 24, 2026: Round-4 fixes (after critic review round 4)

The two gaps documented above were fixed after all, with tests. The live evidence is regenerated
separately after this change.

1. **A phone number that is not the official number.**
   - Problem: `lookup_official_contact` returned the real First City Bank number (1-800-555-0106), but
     nothing compared it with the number in the message (1-800-555-0199), so the "your account is
     locked, call this number" text from the saved bank contact ended "safe".
   - Fix: `lookup_official_contact` now compares every phone number in the message with the official
     number (digits only, a leading country code 1 removed, last 10 digits). If none is official, the
     strong sign `unofficial_number` is added ("asks you to call a number that is not the official
     First City Bank number"); if one is, the fact "the number in the message is the official ...
     number" is recorded. A number that is the official number of another organization the message
     names is not flagged. "Safe" now also needs this lookup whenever the message gives a phone number
     for an organization it claims; the gate rejection says so and points to `lookup_official_contact`
     (not to human help, so a safe message can still be confirmed). `eval.py --rules` and the test
     helper now run `lookup_official_contact` for every claimed organization.
   - Tests: "phone numbers compared by their last digits", "unofficial number is a strong sign after
     lookup", "phone number not looked up -> not safe" (also a scripted model that skips the lookup),
     "official number in the message stays safe", "message without a phone number needs no lookup".
   - Label changes: none. Rules-only results are unchanged (eval 25/25, holdout 11/12, holdout2 13/14);
     no test-set message both names an organization and gives a phone number. Of the demo cases only
     `ordinary` does, and it stays "safe" after the lookup.
   - Two short live checks (`qwen3:8b`, not saved as evidence): the bank text ended **likely_scam** (the
     model looked up the bank and named the wrong number); the `ordinary` case ended **likely_safe**
     after one gate rejection (the model said "safe" before the lookup, then did the lookup).
2. **Human help, then "safe".**
   - Problem: `model_was_concerned` only looked at earlier scam/uncertain labels, so a model that called
     `ask_human_helper` and then said "safe" got "safe".
   - Fix: `model_was_concerned` is also true when the model itself asked for human help
     (`helper_offered_by` is `model` or `model_after_gate_hint`). Python's own help offer does not
     count. The existing gate rule and the `finish_run` backstop then turn a later "safe" into "not sure".
   - Test: "helper then safe is never safe".
- Test count: 94 (up from 88). `python3 tests.py --break-gate`: **23 of 94 fail** with the broken gate.

## Nov 24, 2026: Live results after the round-4 fixes

- 156 live runs again. Eval 25/25 (RAG) and 24/25 (keyword), held-out 1 11/12 in both, held-out 2 12/14
  (RAG) and 13/14 (keyword); demo harness 53/54.
- **1 false "safe"** (was 2): keyword run 1 of `model_catches_miss`, where the model was not worried. In
  keyword runs 2 and 3 the model offered human help on its own and the new "help counts as concern" rule
  turned its later "safe" into "not sure".
- **The cost of more caution:** L03 (a real bank purchase alert, keyword) and F09 (a birthday gift card
  from family, RAG) ended "not sure" because the model was worried or offered help first.
- `guide_missing`: the model searched the guide in only 2 of 6 runs, so the tool failure appears in
  `evidence/harness/rag/run_guide_missing_2_console.txt` and keyword run 1; the demo script and the PDF now
  point to a run where it really failed.

## Nov 24, 2026: Simplification after the over-complication review

A strict review against the rubric ("a small, reliable agent can receive full credit; no extra points
for complexity", and criterion 6: I must be able to explain my own work) found the core right-sized but
the extras too big for a small individual project. The extras were cut without touching the core.

**What was cut, and why** (none of it earns a rubric point, and each part was one more thing to explain):
- **Checkpointing** (`--resume`, `--stop-after`, the checkpoint file and its "finished" marker). It came
  from the Canvas Nov 4 notes as an idea, not a requirement. It is now listed under "Possible extensions"
  in the README.
- **Embeddings and the three search modes.** The guide search used `nomic-embed-text` embeddings (a
  second Ollama model, an embedding cache file, a cosine function, a fallback path) and had three modes
  (keyword, embeddings without metadata, full) so they could be compared. Finding 7 already showed the
  embeddings added almost nothing on this data. Now there is one search: keyword scoring plus the metadata
  rules (org filter, red-flag boost, other-organization penalty), honestly called "metadata search over
  the scam guide". Only `qwen3:8b` is needed. `eval.py --retrieval`, `--model-queries` and `--mode`, and
  `harness_runs.py --mode` are gone; eval and harness run one mode.
- **A duplicate safety backstop.** The "model concern never becomes safe" rule was enforced three times.
  It now lives in one place: the gate rejects a "safe" after any model concern, and when the gate gives up,
  `finish_run` uses the supported label but never "safe" for a concerned model. The removed backstop in
  `finish_run` could only fire if the gate had already failed. `helper_offered_by` now has two values,
  `model` and `python`; the third value (`model_after_gate_hint`) and its counting were dropped. The traces
  still show that the model often offers help only after the gate's feedback, and the README says so.
- **The environment-variable subprocess test.** `OLLAMA_URL` and `SCAMSHIELD_MODEL` still work (like the
  class notebook); only the slow subprocess test was removed.

**What was kept, and why:** the loop, the 6 tools, the parser and validator, routing with `NEXT OPTIONS`,
the verdict gate and the "safe" rule (including the phone-number rule), link and text normalization (it
carries most of the detection quality), the readability check, human help with consent, the problem
cases, the post-checks, model-call retries, the stop reasons, the harness and all four test sets. These
are what the rubric grades or what keeps the answers safe.

**Naming:** the held-out sets are now called test set 2 (`eval_holdout.json`) and test set 3
(`eval_holdout2.json`): they were written before rule fixes and then used to fix rules, so they are no
longer held out. The 614-message set is the large blind test set: it was written by a separate AI agent
that never saw the rules, and it is frozen.

**Checks after the change:** 90 offline tests pass (94 before: the two checkpoint tests, the embedding
fallback test, the backstop test and the subprocess test were removed; one test for the org filter was
added). `python3 tests.py --break-gate`: 21 of 90 fail with the broken gate
(`evidence/eval/break_gate_tests.txt`). The rules-only results are unchanged (test set 1 25/25, test set 2
11/12, test set 3 13/14, large blind test set 526/614). Python code went from 4,555 to 4,134 lines. The
live results (eval and harness) are regenerated after this change.

## What came from the course and what is new

| From the course (Agent Airways, bare-bones notebook, PR #31, Harness assignment, robust browser agent note, Nov 4 notes) | New in ScamShield |
|---|---|
| JSON action loop, tool registry, `result()` shape, step budget, stop reasons | Verdict gate that works out the label from recorded evidence |
| Python decides success (`check_goal`) | Never-trimmed evidence ledger with `E#` ids |
| "Treat page text as data" | Prompt-injection signals as strong warning signs, random-tag message markers |
| Trace fields (step, raw_reply, ..., continue_or_stop) from the bare-bones notebook and PR #31 | Readability check and Python-written "what to do" line |
| Repeated runs with an external runner | Metadata search over the scam guide (keyword scoring + metadata rules) |
| State management / Verification / Checkpointing bullets in the course Canvas post "additional notes on Nov. 4 lecture and references" | State in the `context` dictionary and verification by the gate; checkpointing was built and then cut in the simplification (a possible extension) |
| Retries and "verify, do not assume" (robust browser agent note) | Post-check of every tool's state change, model-call retries recorded in the trace |
| Human approval with `input()` | Consent as a passed-in function, so automated runs never block |

## My decisions and what I learned (written by Aruna)

> **DRAFT. Edit this into your own words before submitting.** It was drafted from the decisions I made
> in the development sessions (Nov 22 to 24). Change anything that does not sound like me or that I would
> say differently.

- **Why I chose this project:** Scam texts target older adults, and the usual advice ("don't click
  links") never says *why* a message is suspicious. The professor approved the idea and asked for
  plain-language explanations, a suspicious, an ordinary and an uncertain demo, and a recommendation to
  ask a person when the agent cannot tell. That last part mattered most to me: saying "I'm not sure, ask
  someone" is better than a confident wrong answer.
- **Who I imagined using it, and what they need from it:** an older adult reading a text on their phone,
  and a family member who helps them. They need a short verdict first, the reason in everyday words, and
  one concrete thing to do, with the real phone number, never one copied from the message.
- **The design decision I am most sure about, and why:** Python decides whether a verdict is allowed,
  not the model. The model chooses which checks to run and explains the result, but it can never say
  "safe" unless the recorded evidence supports it, and a worried model can only make the answer more
  careful. This idea comes straight from `check_goal()` in the Agent Airways class agent.
- **A design decision I went back and forth on:** whether to use LangGraph. I asked whether it was
  necessary, and decided on plain Python because the rubric does not require it, it would not make the
  answers more accurate, and a plain loop shows every decision in the demo. I first added metadata RAG with
  embeddings as an innovation, then cut it back to a simple metadata search over the guide when a review
  showed it did not change the answers and only added things to explain. I also questioned whether a 1,000-message dataset was
  over-complicating the project; I settled on a smaller, blind-written 614-message test.
- **The hardest problem for me:** making the agent really agentic and really safe at the same time. The
  critic reviews kept finding ways a scam could still be called "safe" (a flip from "scam" to "safe", a
  fake call-back number, help offered and then "safe"), and each fix had to be checked against fresh live
  runs, not just the model's word.
- **A moment the model surprised me (good or bad):** on the very first test call, the model invented an
  argument for a tool that takes none. Later, its first instinct on a normal-looking text from an unknown
  number was often "safe", and in some runs it called a cash-courier scam from a family contact "safe"
  because neither the rules nor the model noticed it.
- **What the evaluation taught me that I did not expect:** how little a small test set proves. With 50
  messages an accuracy of 80% could really be anywhere from about 67% to 89%, which is why I wanted 500+
  messages. I also learned that hand-written rules generalize poorly: each fresh held-out set exposed many
  misses before it was used for fixes (6/12 and 2/14), and embedding search mattered only on one hard case, which I traded away to keep the agent small.
- **How I used AI tools while building it, and how I checked their work:** I used Claude Code. It wrote
  most of the code, tests and documentation from my instructions, and I set up a loop where a work agent
  fixed issues and separate critic agents graded the project against the rubric. I checked the results by
  running the tests and the live evaluations myself, required that every number in the documents come
  from saved evidence, and asked that failures be reported honestly instead of tuned away.
- **What I would do differently:** write the held-out test messages before writing any detection rules,
  keep the code smaller, and commit my work day by day instead of in a few large batches.
- **What I would build next with more time:** test on real (consented, anonymized) messages, handle
  screenshots and voice notes as the proposal suggested, measure false alarms on everyday family texts,
  and add a real, consent-based way to alert a family member.
