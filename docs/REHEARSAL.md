# Rehearsal sheet (practise twice, out loud, without notes)

## Before you start
- [ ] Ollama is running: `curl http://127.0.0.1:11434` prints "Ollama is running".
- [ ] Warm the model once: `python3 scamshield_agent.py --case ordinary --consent yes --quiet`.
- [ ] Open the deck and `docs/DEMO_SCRIPT.md` side by side; keep the fallback console logs ready.

## Round 1: the 5-minute demo (time yourself)
Follow `docs/DEMO_SCRIPT.md`: ordinary (safe), scam, uncertain (human help), guide_missing (tool failure),
model_catches_miss (rules miss it). At each step, point at the MODEL DECISION, VALIDATION, TOOL RESULT,
NEXT OPTIONS and GATE lines and say in one sentence what happened and why.
- [ ] Finished in 5 minutes or less
- [ ] Used `--consent yes` every time
- [ ] Said honestly that model_catches_miss was called "safe" once in 6 saved runs

## Round 2: answer these without looking (then check `docs/EXPLAIN.md`)
1. Walk through the loop: message → model chooses one action → parse → validate → run tool → evidence →
   next decision → `done` → verdict gate → readability → final answer.
2. What does the model decide, and what does Python decide?
3. Say the "safe" rule exactly: saved contact, no strong signs, at most 1 weak sign, every link checked and
   official, the official number looked up whenever the message gives a phone number for an organization
   it claims, no tool failure.
4. Why can a worried model never produce "safe"? (Earlier scam/uncertain label, or the model offered help.)
5. What do ROUTING and the NEXT OPTIONS line show? Name one action that appears or disappears and why.
6. What does the post-check really verify? (Lookups: recorded consistently; the alert log is read back;
   the independent check is the gate.)
7. Show a problem case: guide_missing → tool_failure → "not sure"; empty → invalid_input.
8. Why did one run call a scam "safe"? (Neither the rules nor the model noticed; the gate cannot block a
   "safe" that the recorded evidence supports.)
9. Why plain Python and not LangGraph? Where did checkpointing come from? (The Canvas Nov 4 notes.)
10. What did the evaluation show? (156 live runs, 1 false safe; held-out sets 6/12 and 2/14 before fixes;
    the 614-message blind test with its 95% confidence range.)
11. Why are all commits on Nov 24, and how did you use AI? (Your own answers to EXPLAIN Q12 and Q13.)
12. What would you build next?

- [ ] Could answer at least 10 of 12 without notes
- [ ] Re-read the ones you missed, then try again
