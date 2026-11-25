# My contribution

ScamShield is my individual project for CSYE 7374 (Agentic AI). This page explains how I used an AI coding
assistant, how I checked its work, my plan, what I did each day, and what I learned.

## How I used an AI coding assistant

### Which tool
I used **Claude Code**, Anthropic's AI coding assistant, running in my terminal on my own machine.
(This is separate from the model inside ScamShield: the agent itself runs `qwen3:8b` locally through Ollama.)

### What I used it for

| Task | Where it is | What Claude Code did | What I decided or did myself |
|---|---|---|---|
| Planning | (planning sessions) | Turned my idea and the professor's feedback into a plan and pointed out weak spots | Chose the project and scope, chose plain Python over LangGraph, chose a local model (Ollama), chose the scam-guide search as the extra feature |
| Agent code | `scamshield_agent.py`, `rag.py` | Wrote most of the code from my instructions | Set what each part must do, following the class Agent Airways agent |
| Tests and evaluation | `tests.py`, `eval.py`, `harness_runs.py` | Wrote the tests and the evaluation scripts | Decided what had to be tested, including the problem cases and 500+ test messages |
| Data | `data/` | Drafted the fictional messages, contacts, websites, scam guide and test sets 1 to 3 | Decided which kinds of cases were needed |
| Blind test set | `data/eval_large.json` | A separate Claude Code agent wrote 614 messages without seeing the rules, code or other test sets | Asked for a blind set so the test would be fair, and froze it before testing |
| Reviews | (not in the repo) | Separate Claude Code reviewer agents graded the project strictly against the rubric over several rounds | Chose which problems to fix, and when the project became too complicated, decided to cut the extras |
| Documents and commits | `README.md`, this file, the PDF and slides | Drafted the text, built the PDF and slides, and made the git commits on my machine under my account | Reviewed and edited the text, and asked for every number to come from a saved result file |

### How I reviewed and tested its work
- **Offline tests:** I ran `python3 tests.py`; all 90 tests pass. They use a fake model that gives wrong
  answers on purpose, so they test the safety checks, not just the happy path.
- **Testing the tests:** `python3 tests.py --break-gate` replaces the safety gate with one that calls
  everything safe; 21 of the 90 tests then fail, which shows the tests really catch a broken check.
- **Live runs with the real model:** I ran the demo cases with `qwen3:8b` myself and checked that each
  ended with the expected answer and stop reason.
- **The blind test:** I ran a 10-message trial first, then the full 614-message test myself (about 2
  hours), and checked the summary against the saved results.
- **Traceable numbers:** every result is saved in `evidence/`, with checksums of the code and data that
  produced it, so the numbers in the README can be checked against real runs, not the assistant's claims.
- **Pushing back on suggestions:** I asked whether LangGraph was needed (it was not), asked whether the
  project was getting over-complicated (we cut checkpointing, embedding search and a duplicate check),
  reduced the planned 1,000+ messages per file to one 614-message blind set, refused to tune the rules
  after seeing the blind results, and required failures (such as the 2 scams called "safe") to be
  reported honestly.

## The plan

| Day | Plan | What happened |
|---|---|---|
| Nov 22 | Read the professor's feedback, design the agent, decide what to reuse from class | Design settled: Python checks every answer, evidence is recorded, plain Python instead of LangGraph |
| Nov 23 | Build the agent, the six tools, the verdict gate and the tests | Working agent on the local model; four real problems found and fixed |
| Nov 24 | Test it, review it against the rubric, fix it, make the PDF and slides | Live tests, four review rounds, cut the extras, ran the 614-message blind test |

The professor asked for fictional messages, a small scam-prevention guide, three demos (suspicious,
ordinary, uncertain), a plain explanation of the evidence, and a suggestion to ask a person when unsure.
The plan was built around those points.

## What I did each day

### Nov 22: planning
- Reused the patterns from the Agent Airways class agent: one action per step, a tool registry, a step
  limit, stop reasons, and Python deciding success.
- Chose plain Python over LangGraph: not required, not more accurate, and harder to show in a demo.
- Made four design decisions after reviewing the plan:
  - Python checks the evidence it recorded itself, not the evidence the model says it has.
  - Every tool result carries the full list of evidence so far, so the model never loses track.
  - The uncertain demo uses a message with no warning signs ("Dr. Lee's office, please call back").
  - Consent is passed in as a setting, so tests never wait for typing.

### Nov 23: building the agent
Four problems showed up on the first live runs:
1. **The model invented arguments** for a tool that takes none. Now unknown arguments are dropped.
2. **Notes were counted as warning signs** ("asks you to call back"). Notes are now marked "NOT a warning sign".
3. **The gate's feedback did not say what was missing**, so the model just guessed again. Now it says
   what was expected and what was found.
4. **The model copied an example filter** from the tool description. The example was removed.

By the end of the day there were 46 offline tests. I broke the gate on purpose to check that the tests
fail when they should, and they did.

### Nov 24: testing, reviews and the blind test
- **Live tests:** the model often wanted to call unknown senders "safe". The gate rejected every one of
  those answers, which shows why Python has to check the model.
- **Four review rounds against the rubric.** The main fixes:
  - New test sets written before changing the rules showed the rules missed new wording (6/12 and 2/14).
    I fixed disguised spelling, odd links, payment apps and code requests.
  - A worried model can no longer end "safe".
  - A phone number in the message is now compared with the official number.
  - Claims in the documents that went beyond the evidence were corrected.
- **Cut the extras.** The rubric says a small, reliable agent can get full credit, so I removed
  checkpointing, embedding search and a duplicate safety check. The results stayed the same.
- **Blind test with 614 messages.** The full agent got 84% right and called only 2 scams "safe"; the
  rules alone got 86% but called 13 scams "safe". I did not change any rule after seeing the results.

## What came from the course and what is new

| From the course | New in ScamShield |
|---|---|
| Action loop, tool registry, step limit, stop reasons (Agent Airways) | A verdict gate that works out the label from recorded evidence |
| Python decides success (`check_goal`) | An evidence list with ids (E1, E2...) that is never trimmed |
| Treat page text as data | Text that tries to trick the AI counts as a strong warning sign |
| Trace fields (class notebook, PR #31) | A readability check and a Python-written "what to do" line |
| Repeated runs (Harness assignment) | A search over a small scam-prevention guide |
| Retries and "verify, don't assume" (robust browser agent note) | A check after every tool run |

## What I learned

- **Python should decide, not the model.** The model picks the checks and explains, but it can only say
  "safe" when the evidence supports it. This caught its most dangerous habit.
- **Never trust the shape of a model reply.** It invented an argument on the very first call.
- **Feedback must say what was expected and what was found**, or the model just guesses.
- **Small tests prove little.** A perfect 25 out of 25 still means the true accuracy could be anywhere from
  87% to 100%. With 614 messages the range is about plus or minus 3 points.
- **Hand-written rules miss new wording.** Every fresh test set found new misses.
- **Being careful has a cost.** Fewer dangerous "safe" answers, but some harmless family texts end
  "not sure". For older adults I think that is the right trade.
- **Simpler is easier to explain.** Cutting the extras cost almost nothing.

## What I would do differently and next

- Write the test messages before writing any rules, and commit my work day by day.
- Test on real (consented, anonymized) messages, handle screenshots and voice notes, catch a "not" before
  a warning word ("no payment needed"), and add a real, consent-based family alert.
