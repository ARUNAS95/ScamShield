# My contribution

ScamShield is my individual project for CSYE 7374 (Agentic AI). This file explains how I planned the work,
what I did each day, what broke and how I fixed it, and what I learned. The code, the evidence and the
commit history are all in this repository.

## How I worked

I chose the project, the scope and the design, and I made the decisions along the way. An AI coding
assistant wrote most of the code, tests and documentation from my instructions. I also used separate AI
reviewers that graded the project against the rubric, then had the fixes made and re-checked. I verified
the results myself by running the tests and the live evaluations, and I insisted that every number in the
documents comes from a saved evidence file and that failures are reported, not tuned away.

## The plan

| Day | Plan | What actually happened |
|---|---|---|
| Nov 22 | Read the professor's feedback, design the agent, decide what to reuse from class | Plan reviewed four times; key safety ideas settled (Python checks the verdict, evidence ledger, consent as a function) |
| Nov 23 | Build the agent, the six tools, the verdict gate and the offline tests | Working agent on the local model; four real problems found and fixed (Findings 1 to 4) |
| Nov 24 | Evaluate, review against the rubric, fix, write the PDF and the slides | Live evaluation, four review rounds, a simplification, the 614-message blind test, final documents |

The professor's feedback asked for fictional messages, a small scam-prevention guide, three demos
(suspicious, ordinary and uncertain), a plain explanation of the evidence, and a recommendation to ask a
person when the agent cannot tell. Everything in the plan was built around those points.

## Day 1 (Nov 22): planning

- I reused the patterns from the Agent Airways class agent: one JSON action per step, a tool registry with
  `validate()` and `run()`, the `result(ok, message, data)` shape, a `context` dictionary, a step budget,
  stop reasons, and Python deciding success (`check_goal()`).
- I decided on plain Python instead of LangGraph. The rubric does not require it, it would not make the
  answers more accurate, and a plain loop shows every decision during the demo.
- Reviewing the plan changed four things:
  - **The gate checks the evidence Python recorded**, not the evidence ids the model chooses to cite.
  - **An evidence ledger goes with every tool result and is never trimmed**, so a small model cannot
    forget which `E#` ids exist.
  - **The uncertain demo changed** from "Hi Grandma, new number" (a known scam pattern) to "Dr. Lee's
    office, please call back", which has no warning signs at all.
  - **Consent is a function passed in** (`--consent prompt|yes|no`), so tests and repeated runs never
    hang waiting for typing.

## Day 2 (Nov 23): building the agent

### Finding 1: the model invents arguments
The very first live call returned `{"action":"extract_signals","argument":{"signals":[...]}}`, although
`extract_signals` takes no argument. Now the agent keeps only the argument keys each tool declares and
reports the rest as ignored. Test: `extra argument keys ignored`.

### Finding 2: notes were counted as warning signs
On the uncertain case the model said "scam" with zero warning signs. The trace showed why: notes such as
"asks you to call back" were listed under warning signs, and the model counted them. Notes are now listed
separately and marked "NOT a warning sign".

### Finding 3: the gate's feedback did not say what was expected
After a rejection, the model just tried another wrong label. Rejections now say what the evidence supports
and what is missing, for example "likely_safe needs a saved contact; actual: sender not checked yet". This
is the same lesson as the Google harness experiment, where the checker never showed expected and actual
values.

### Finding 4: the model copied a filter from the tool example
The tool guide example used `"org": "Medicare"`, so on the doctor's-office message the model sent
`"org": "Dr. Lee's office"`, got rejected, and gave up on the guide. The example no longer shows a filter.

By the end of the day there were 46 offline tests with a scripted model. To make sure they could fail, I
broke the gate on purpose (it believed every message was safe) and 10 safety tests failed, as they should.

## Day 3 (Nov 24): evaluation, reviews and the blind test

### Finding 5: context-window truncation (measured, not happening)
I suspected Ollama was cutting off the start of long prompts (its default window is 4,096 tokens). I
replayed a real 8-step run and counted the tokens: the largest prompt was about 2,300. I set `num_ctx` to
8192 anyway as a margin.

### Finding 6: the model's instinct on unknown senders is "safe"
On messages from unknown numbers with no warning signs, the model proposed "safe" in 5 of 10 runs, the
most harmful mistake for an older adult. The verdict gate rejected every one. That is the clearest proof
that answers are checked against evidence instead of being trusted.

### Finding 7: embedding search added almost nothing here
The guide search with embeddings found the right guide entry in 21 of 21 messages, against 20 of 21 for
plain keyword search. The guide and the messages share vocabulary, so the gain was too small to matter.

### Review rounds
I had the project reviewed strictly against the rubric four times and fixed what was found. The main fixes:
- **Test sets written before fixing the rules.** Test set 2 (12 messages) and test set 3 (14 messages)
  were written in new wording and committed with their score *before* any rule change: 6/12 and 2/14 with
  the rules alone. After the fixes: 11/12 and 13/14. Because they were then used for fixing, I no longer
  count them as fair tests.
- **The rules missed new wording:** `.shop` links, IP-address links, disguised spelling ("g1ft c@rds",
  spaced letters, Cyrillic look-alike letters), defanged links, hidden addresses after `@`, payment apps,
  card photos and "send me the code" in many forms.
- **A worried model can never end "safe".** One review found that when the gate gave up, Python could
  turn the model's "scam" into "safe". Another found that a model could say "scam", get rejected, then say
  "safe". Now any concern from the model (an earlier scam or not-sure answer, or asking for human help)
  means the answer can only become more careful.
- **A fake call-back number.** A "your account is locked, call this number" text from the saved bank
  contact was called safe. Now the number in the message is compared with the official one, and a
  different number is a strong warning sign.
- **Honest wording.** Claims such as "never safe" and "0 false safe" were corrected when the evidence did
  not support them.

### Simplifying
A review asked whether the project had become too complicated for the rubric, which says a small, reliable
agent can get full credit. I agreed and cut the extras without touching the core: checkpointing (resume a
run from a file), embeddings and the three search modes, a duplicate safety check, and one slow test. The
Python code went from 4,555 to 4,134 lines; the results stayed the same. The cost: on one hard case (a
cash-courier text from a family contact) the embedding version was suspicious more often, and I report
that instead of hiding it.

### The blind test (614 messages)
Small test sets prove little: with 50 messages, 80% accuracy could really be anywhere from about 67% to
89%. So I had a separate AI agent write 614 fictional messages without ever seeing my rules, code, guide or
other test sets, froze the file, and ran the full agent once on every message (about 2 hours).

| | Rules alone | Full agent |
|---|---|---|
| Correct (95% range) | 526/614 = 85.7% (82.7% to 88.2%) | 513/614 = 83.6% (80.4% to 86.3%) |
| Scams or unclear messages called "safe" | 13 of 417 | **2 of 417** |
| False alarms on safe messages | 6 of 197 | 6 of 197 |

The agent is slightly less accurate but much safer: it said "safe" to only 2 of the 13 messages the rules
got dangerously wrong. 90 of its 101 mistakes are "not sure", which sends the person to someone they
trust. I did not change any rule after seeing these results, so the test stays blind.

## What came from the course and what is new

| From the course | New in ScamShield |
|---|---|
| JSON action loop, tool registry, `result()` shape, step budget, stop reasons (Agent Airways) | Verdict gate that works out the label from recorded evidence |
| Python decides success (`check_goal`) | Evidence ledger with `E#` ids that is never trimmed |
| "Treat page text as data" | Prompt-injection text counted as a strong warning sign |
| Trace fields from the bare-bones notebook and PR #31 | Readability check and a Python-written "what to do" line |
| Repeated runs with an external runner (Harness assignment) | Metadata search over a small scam guide |
| State management and verification (Nov 4 notes) | State in the `context` dictionary, verification by the gate |
| Retries and "verify, do not assume" (robust browser agent note) | Post-check of every tool, model-call retries recorded in the trace |
| Human approval with `input()` | Consent passed in as a function, so automated runs never block |

## What I learned

- **Python should decide, not the model.** The model chooses which checks to run and explains the result,
  but it can never say "safe" unless the recorded evidence supports it. This came straight from
  `check_goal()` in the class agent, and it caught the model's most dangerous habit (Finding 6).
- **Never trust the shape of a model reply.** Even on the first call it invented an argument (Finding 1).
- **Feedback must say what was expected and what was found**, or the model just guesses again (Finding 3).
- **Small test sets say very little.** A perfect score on 25 messages still leaves a 95% range of 87% to
  100%. The 614-message blind test narrowed it to about plus or minus 3 points.
- **Hand-written rules do not generalize.** Each fresh test set exposed many misses (6/12 and 2/14 before
  fixes), and the blind test still found two scams from saved contacts that nothing caught.
- **Caution has a price.** Being careful cut dangerous "safe" answers from 13 to 2 but turned some harmless
  family texts that mention money into "not sure". For older adults I think that trade is right.
- **Simpler is easier to defend.** Cutting the extras cost almost nothing and made the agent something I
  can explain line by line.

## What I would do differently

Write the test messages before writing any detection rules, keep the code smaller from the start, and
commit my work day by day instead of in a few large batches.

## What I would build next

Test on real (consented, anonymized) messages; handle screenshots and voice notes; make the rules notice a
"not" before a warning word ("no payment needed"); flag "read me the code" requests from saved contacts;
and add a real, consent-based way to alert a family member.
