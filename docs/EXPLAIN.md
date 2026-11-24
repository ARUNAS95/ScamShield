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
| `run_agent` | scamshield_agent.py:1256 | The main loop: input check, then per step ask the model (with up to 2 retries), parse, route `done` to the gate or a tool to `run_requested_tool`, and append the result + ledger + AVAILABLE ACTIONS to `messages`. It saves a checkpoint after every step and ends by calling `finish_run`. |
| `ask_model` | scamshield_agent.py:919 | Calls Ollama `/api/chat` with `qwen3:8b`, `think=false`, `format=json`, `num_ctx` 8192 and a 180 s timeout. Tests replace it with a scripted model function. |
| `parse_action` | scamshield_agent.py:938 | Strips think tags and code fences, then requires valid JSON with exactly the keys `action` (text) and `argument` (dictionary). It returns `(proposal, '')` or `(None, reason)`. |
| `ROUTING` | scamshield_agent.py:683 | A table with one plain precondition per action (e.g. `ask_human_helper`: "after check_sender, and only once"). The same text is sent to the model when a proposal is rejected. |
| `precondition_met` | scamshield_agent.py:710 | Checks one ROUTING precondition against the `context` state (links still unchecked, sender checked, searches left, broken tools). This is what makes routing conditional instead of a fixed order. |
| `available_actions` | scamshield_agent.py:733 | Lists every action whose precondition holds right now. It is shown to the model after every step and stored in each trace step. |
| `run_requested_tool` | scamshield_agent.py:809 | Rejects unknown or not-allowed actions, keeps only declared argument keys, runs the tool's `validate`, blocks repeated calls, runs the tool inside try/except, checks the result shape and runs `post_check`. On success it records evidence `E#`; on failure it records a tool failure and disables that tool. |
| `post_check` | scamshield_agent.py:766 | After a tool says it worked, verifies the promised change (link in `link_results`, sender marked checked, alert line really in the log file). "Verify, do not assume" from the robust browser agent note. |
| `evidence_ledger` | scamshield_agent.py:755 | One line per evidence item, sent with every tool result and never trimmed. A small model therefore never forgets which `E#` ids exist. |
| `run_extract_signals` | scamshield_agent.py:386 | Regex scan for strong and weak warning signs, links, phone numbers, claimed organizations and text aimed at an AI, on NFKC-normalized text and on a copy with look-alike letters undone. It must be the first action. |
| `run_check_link` | scamshield_agent.py:460 | Classifies a link from the message as official, look-alike, known scam, IP address, short link or unknown, using a local list and edit distance. It never opens the link. |
| `run_check_sender` | scamshield_agent.py:495 | Is the real sender a saved contact? "Not saved" is recorded as a note, not a warning sign. |
| `run_lookup_official_contact` | scamshield_agent.py:527 | Returns the real phone number of an organization the message claims to be, from a trusted list. Python later uses it in the "what to do" line. |
| `run_search_scam_guide` | scamshield_agent.py:562 | Calls `rag.search` with the model's query and optional filter plus the warning signs Python found. At most 3 searches; a missing guide file raises and becomes a tool failure. |
| `run_ask_human_helper` | scamshield_agent.py:609 | Asks for consent through the passed-in consent function, then writes a simulated alert to a log file. Nothing is ever sent. |
| `supported_label` | scamshield_agent.py:962 | The label the recorded evidence supports: scam with 1 strong or 2 weak signs; safe only with a saved contact, at most 1 weak sign, all links official and no tool failure; otherwise uncertain. It ignores what the model says. |
| `check_verdict` | scamshield_agent.py:1017 | The verdict gate: label valid, cited ids exist, explanation given, label matches the supported label (with the uncertain rules), and every strong sign is mentioned. Returns each rule with ok/detail, so feedback shows expected vs. actual. |
| `handle_done` | scamshield_agent.py:1425 | Runs the gate; on rejection sends feedback or, after 2 rejections, sets `gate_downgraded`. On acceptance it runs the readability check (one rewrite, then template). |
| `check_readability` | scamshield_agent.py:1108 | Verdict in the first sentence, at most 6 sentences of at most 22 words, no jargon, links or long numbers. Returns the list of problems. |
| `choose_stop_reason` | scamshield_agent.py:1477 | Precedence: invalid_input > model_error > tool_failure > gate_downgrade > no_progress > step_limit > success. A tool failure is reported even if a verdict was accepted. |
| `finish_run` | scamshield_agent.py:1491 | Picks the final label (accepted verdict, or Python's supported label, never "safe" after an unfinished run), offers human help for "uncertain", writes the "what to do" line and guide tip, and saves the JSON trace. Prints the result banner. |
| `rag.search` | rag.py:192 | Scores guide entries 50% embedding cosine + 50% keyword overlap (or keyword only), applies the model's metadata filters, boosts entries whose red flags match the found warning signs and halves entries about another organization. Falls back to keyword search if embeddings are unavailable and says so. |

## 3. The gate rules (say them like this)

- **likely_scam**: at least 1 strong warning sign or at least 2 weak ones.
- **likely_safe**: saved contact AND no strong signs AND at most 1 weak sign AND every link checked and official AND no tool failure.
- **uncertain**: everything else. Rejected if a strong sign was found. Requires that human help was offered first.
- Always: the label is one of the three, cited evidence ids exist, the explanation is not empty and mentions every strong sign.
- Rejection feedback = the failed rule + expected vs. actual + "with the evidence so far, Python can support: X".
- 2 rejections: Python uses the supported label (`gate_downgrade`) and its template explanation.

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
   The gate was deliberately broken (it believed every message was safe) and the safety tests failed.
   The tests also use a scripted model that gives deliberately wrong answers.

10. **Isn't the evaluation biased, since you wrote the data?**
    Yes, that is the main limitation. To reduce it, a held-out set was written before the round-1 rule
    changes, in different wording, and not edited afterwards. It still has a miss (H03: a USPS text with
    `.shop` and `.online` links ends as "not sure", not "scam").

11. **What does the RAG add?**
    The guide tip in the answer and evidence for unclear messages. The measured gain over keyword search
    is small on this data, and the document says so.

12. **Why are all the commits on Nov 24?**
    I built and tested the project locally on Nov 22 and 23 and committed it in logical chunks on Nov 24,
    after the first review. The development log (`DEVLOG.md`) records what was done on which day.

13. **Which AI tools did you use?**
    An AI coding assistant helped write parts of the code, tests and documentation. I chose the problem
    and the design, directed the work, reviewed every change, ran the evaluations and can explain each
    part. (Answer this in your own words.)

14. **What is the evidence ledger and why is it never trimmed?**
    The chat history keeps only the last 10 messages, so a small model could forget which `E#` ids exist.
    The ledger lists all evidence with every tool result, so citations stay valid.

15. **What would you do next?**
    Test with real (anonymized) scam texts, ask older adults whether the explanations help, grow the
    website list and handle other alphabets, and connect a real, consented family alert.

16. **What happens with an empty message?** Python stops before the model is called (`invalid_input`).

17. **What is in a trace?** Per step: step, raw_reply, action, argument, parse_ok, validation_ok,
    available_actions, evidence_id, observation (the exact feedback), check_result (post-check or gate
    rules), state_update, continue_or_stop, model_retries. Plus the final label, stop reason and evidence.

## 5. Numbers

Do not memorize numbers from this file: read them from `docs/ScamShield_Project_Document.pdf`
(section 6), which is rebuilt from the evidence files with `python3 docs/build_docs.py`.
