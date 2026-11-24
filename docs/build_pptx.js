// Builds docs/ScamShield_Presentation.pptx from docs/build/deck_data.json.
// The data file is written by docs/build_docs.py, which reads every result
// number from the evidence files, so no result is typed here.
//
// Usage (build_docs.py runs this for you):
//   node docs/build_pptx.js docs/build/deck_data.json docs/ScamShield_Presentation.pptx

const fs = require('fs');
const path = require('path');
const pptxgen = require(path.join(__dirname, 'node_modules', 'pptxgenjs'));

const dataPath = process.argv[2];
const outPath = process.argv[3];
const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const NAVY = '1F3A5F';
const PURPLE = '5E35B1';
const LAVENDER = 'EDE7F6';
const GREEN = '2E7D5B';
const MINT = 'E6F4EC';
const AMBER = 'B45309';
const AMBER_TINT = 'FFF3E0';
const RED = 'C62828';
const INK = '1C2630';
const MUTED = '546E7A';
const TINT = 'F4F7F9';
const WHITE = 'FFFFFF';
const BODY = 'Calibri';
const MONO = 'Courier New';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';            // 13.33 x 7.5 inches
pres.author = D.student;
pres.title = 'ScamShield';
pres.subject = 'CSYE 7374 Agentic AI mini-project';
pres.theme = { headFontFace: BODY, bodyFontFace: BODY };

pres.defineSlideMaster({
  title: 'SCAMSHIELD_DARK',
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.5, w: 11.9, h: 1.0, fontFace: BODY,
      fontSize: 36, bold: true, color: WHITE, valign: 'middle' }, text: '' } },
  ],
});

pres.defineSlideMaster({
  title: 'SCAMSHIELD_CONTENT',
  background: { color: WHITE },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 0.85, fontFace: BODY,
      fontSize: 34, bold: true, color: NAVY, valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: 'ScamShield  |  CSYE 7374 Agentic AI', options: { x: 0.6, y: 7.05, w: 6, h: 0.3, fontFace: BODY,
      fontSize: 11, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.02, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 11, color: MUTED, align: 'right' },
});

function text(slide, value, options) {
  const merged = Object.assign({ isTextBox: true, fontFace: BODY, color: INK, margin: 0, valign: 'top' }, options);
  slide.addText(value, merged);
}

function card(slide, x, y, w, h, fill, line) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: w, h: h, rectRadius: 0.12,
    fill: { color: fill }, line: { color: line || fill, width: 1.25 } });
}

function pill(slide, x, y, w, h, fill, label, size) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: w, h: h, rectRadius: h / 2,
    fill: { color: fill }, line: { color: fill } });
  text(slide, label, { x: x, y: y, w: w, h: h, fontSize: size || 20, bold: true, color: WHITE,
    align: 'center', valign: 'middle' });
}

function numberCircle(slide, x, y, n, color) {
  slide.addShape(pres.shapes.OVAL, { x: x, y: y, w: 0.6, h: 0.6, fill: { color: color }, line: { color: color } });
  text(slide, String(n), { x: x, y: y, w: 0.6, h: 0.6, fontSize: 22, bold: true, color: WHITE,
    align: 'center', valign: 'middle' });
}

function short(value, limit) {
  value = String(value === undefined || value === null ? '' : value);
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 3).trim() + '...';
}

function content(section, title) {
  const slide = pres.addSlide({ masterName: 'SCAMSHIELD_CONTENT', sectionTitle: section });
  slide.addText(title, { placeholder: 'title' });
  return slide;
}

// ---------------------------------------------------------------- 1. Title
pres.addSection({ title: 'Introduction' });
let s = pres.addSlide({ masterName: 'SCAMSHIELD_DARK', sectionTitle: 'Introduction' });
text(s, 'ScamShield', { x: 0.7, y: 1.5, w: 7.5, h: 1.2, fontSize: 60, bold: true, color: WHITE });
text(s, 'A plain-language scam warning agent for older adults', { x: 0.7, y: 2.75, w: 7.2, h: 1.1,
  fontSize: 26, color: 'CADCFC' });
text(s, [
  { text: D.student, options: { bold: true, breakLine: true } },
  { text: D.course, options: { breakLine: true } },
  { text: D.date, options: { breakLine: true } },
  { text: D.repo },
], { x: 0.7, y: 4.4, w: 7.4, h: 1.8, fontSize: 18, color: WHITE, paraSpaceAfter: 4 });
pill(s, 8.9, 1.7, 3.7, 0.8, RED, 'Likely scam', 22);
pill(s, 8.9, 2.8, 3.7, 0.8, GREEN, 'Likely safe', 22);
pill(s, 8.9, 3.9, 3.7, 1.1, AMBER, 'Not sure: ask someone you trust', 20);
text(s, 'Fictional messages only. Never opens links.', { x: 8.9, y: 5.35, w: 3.7, h: 0.8, fontSize: 16,
  color: 'CADCFC', align: 'center' });
s.addNotes('ScamShield checks one text message and answers in plain words: likely scam, likely safe, or not sure. ' +
  'It runs a local language model, qwen3:8b with Ollama, as an agent that chooses tools step by step, and Python checks ' +
  'every step. Everything is fictional and nothing is ever opened or sent.');

// ---------------------------------------------------------------- 2. Problem
pres.addSection({ title: 'Problem' });
s = content('Problem', 'Scam texts are built to rush older adults');
const exampleText = D.example ? D.example.message.text : 'Example message pending';
card(s, 0.6, 1.5, 5.6, 3.6, 'EEF1F4');
text(s, 'A text from an unknown number:', { x: 0.85, y: 1.7, w: 5.1, h: 0.4, fontSize: 18, color: MUTED });
text(s, exampleText, { x: 0.85, y: 2.15, w: 5.1, h: 2.8, fontSize: 20, color: INK });
const problems = [
  ['They copy real organizations', 'Medicare, the post office, a bank, a grandchild'],
  ['They rush and threaten', '"Your benefits will be suspended today"'],
  ['They ask for gift cards or codes', 'payment apps, or a tap on a look-alike link'],
];
for (let i = 0; i < problems.length; i++) {
  const y = 1.5 + i * 1.25;
  numberCircle(s, 6.8, y + 0.05, i + 1, RED);
  text(s, problems[i][0], { x: 7.6, y: y, w: 5.1, h: 0.45, fontSize: 21, bold: true });
  text(s, problems[i][1], { x: 7.6, y: y + 0.48, w: 5.1, h: 0.5, fontSize: 18, color: MUTED });
}
card(s, 0.6, 5.5, 12.1, 1.2, LAVENDER);
text(s, 'People are told "don\'t click links", but rarely why this message is suspicious. ScamShield explains the ' +
  'evidence and says "not sure" instead of guessing.', { x: 0.9, y: 5.62, w: 11.5, h: 0.95, fontSize: 20,
  color: '311B92', valign: 'middle' });
s.addNotes('Scam texts copy real organizations, rush people and ask for gift cards, codes or payments. Older adults are ' +
  'targeted often. The usual advice is "don\'t click", but it does not teach why a message is suspicious. ' +
  'ScamShield explains the evidence in everyday words and, when it cannot tell, recommends asking a trusted person.');

// ---------------------------------------------------------------- 3. What it does
s = content('Problem', 'One message in, a plain answer out');
const verdicts = [
  [RED, 'Likely scam', 'a strong warning sign, or two weak ones'],
  [GREEN, 'Likely safe', 'saved contact, no strong signs, links official'],
  [AMBER, 'Not sure', 'evidence cannot settle it: ask someone you trust'],
];
for (let i = 0; i < verdicts.length; i++) {
  const y = 1.55 + i * 1.6;
  pill(s, 0.6, y, 2.6, 0.7, verdicts[i][0], verdicts[i][1], 20);
  text(s, verdicts[i][2], { x: 0.6, y: y + 0.78, w: 4.6, h: 0.7, fontSize: 18, color: INK });
}
card(s, 5.6, 1.45, 7.1, 5.3, WHITE, NAVY);
if (D.example) {
  pill(s, 5.9, 1.7, 2.6, 0.6, RED, D.example.final_label.toUpperCase(), 18);
  text(s, short(D.example.explanation, 330), { x: 5.9, y: 2.5, w: 6.5, h: 2.3, fontSize: 18 });
  text(s, [
    { text: 'What to do: ', options: { bold: true } },
    { text: short(D.example.what_to_do, 210) },
  ], { x: 5.9, y: 4.85, w: 6.5, h: 1.35, fontSize: 18 });
  text(s, 'Real output from a saved live run. The "what to do" line is written by Python.', { x: 5.9, y: 6.25,
    w: 6.5, h: 0.4, fontSize: 14, color: MUTED, italic: true });
} else {
  text(s, 'Example output pending', { x: 5.9, y: 2.0, w: 6.5, h: 1, fontSize: 20, color: AMBER });
}
s.addNotes('Three possible answers. The example on the right is the real output for the Medicare gift-card text: the ' +
  'model wrote the explanation, Python checked it, and Python added the what-to-do line with the real Medicare number ' +
  'from a trusted list, so the model can never invent a phone number.');

// ---------------------------------------------------------------- 4. How it works
pres.addSection({ title: 'How it works' });
s = content('How it works', 'How it works: the model chooses, Python checks');
const diagramH = 5.75;                      // the diagram is 1420 x 900
const diagramW = diagramH * 1420 / 900;
s.addImage({ path: D.diagram, x: (13.333 - diagramW) / 2, y: 1.25, w: diagramW, h: diagramH,
  altText: 'ScamShield workflow diagram' });
s.addNotes('Walk through the loop: input check, then the model chooses ONE action as JSON. Python parses it and ' +
  'validates it: is this action allowed now, does the argument come from the message. The tool runs locally, a ' +
  'post-check verifies the state change, and the result becomes evidence E1, E2 with a ledger that goes back to the ' +
  'model. When the model says done, the verdict gate checks the label against the recorded evidence. After two ' +
  'rejections Python uses the supported label. Then the readability check, and the final answer.');

// ---------------------------------------------------------------- 5. Model vs Python
s = content('How it works', 'The model decides; Python checks every decision');
card(s, 0.6, 1.45, 5.9, 5.3, LAVENDER, PURPLE);
card(s, 6.8, 1.45, 5.9, 5.3, MINT, GREEN);
text(s, 'The model decides', { x: 0.9, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: PURPLE });
text(s, 'Python checks', { x: 7.1, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: GREEN });
const modelSide = ['Which tool to use next, and with which argument', 'What to search for in the scam guide',
  'When it has enough evidence', 'Which label to propose, which evidence to cite', 'How to word the explanation'];
const pythonSide = ['Is this action allowed now? Is the argument from the message?', 'Did the tool really change the state? (post-check)',
  'Does the recorded evidence support the label? (gate)', 'Is the answer easy to read?', 'Writes "what to do" and every phone number'];
const modelRuns = [];
const pythonRuns = [];
for (let i = 0; i < modelSide.length; i++) {
  modelRuns.push({ text: modelSide[i], options: { bullet: true, breakLine: i < modelSide.length - 1 } });
  pythonRuns.push({ text: pythonSide[i], options: { bullet: true, breakLine: i < pythonSide.length - 1 } });
}
text(s, modelRuns, { x: 0.9, y: 2.35, w: 5.3, h: 4.2, fontSize: 20, paraSpaceAfter: 10 });
text(s, pythonRuns, { x: 7.1, y: 2.35, w: 5.3, h: 4.2, fontSize: 20, paraSpaceAfter: 10 });
s.addNotes('The split of responsibility. The model makes the investigative decisions: which tool, which argument, ' +
  'when to stop, which label. Python never trusts those decisions: it checks preconditions and argument grounding ' +
  'before a tool runs, verifies the state change after, and accepts a verdict only if the recorded evidence supports it.');

// ---------------------------------------------------------------- 6. Tools
s = content('How it works', 'Six tools the model can choose from');
const tools = [
  ['extract_signals', 'Warning signs, links, claimed organization', 'always first, once'],
  ['check_link', 'Official, look-alike or scam? Never opened', 'a link from the message is unchecked'],
  ['check_sender', 'Is the sender a saved contact?', 'the real sender, once'],
  ['lookup_official_contact', 'Real phone number from a trusted list', 'an organization the message claims'],
  ['search_scam_guide', 'Metadata RAG over the scam guide', 'up to 3 times'],
  ['ask_human_helper', 'Simulated alert to family, with consent', 'after check_sender, once'],
];
for (let i = 0; i < tools.length; i++) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.6 + col * 4.1;
  const y = 1.45 + row * 2.45;
  card(s, x, y, 3.85, 2.2, AMBER_TINT, 'D97706');
  text(s, tools[i][0], { x: x + 0.2, y: y + 0.18, w: 3.5, h: 0.45, fontSize: 18, bold: true, fontFace: MONO,
    color: '4527A0' });
  text(s, tools[i][1], { x: x + 0.2, y: y + 0.7, w: 3.5, h: 0.75, fontSize: 18 });
  text(s, 'When: ' + tools[i][2], { x: x + 0.2, y: y + 1.45, w: 3.5, h: 0.65, fontSize: 16, color: MUTED,
    italic: true });
}
text(s, [
  { text: 'done', options: { bold: true, fontFace: MONO, color: GREEN } },
  { text: ' (label + evidence ids + explanation) is not a tool: it goes to the verdict gate.' },
], { x: 0.6, y: 6.4, w: 12.1, h: 0.5, fontSize: 18 });
s.addNotes('Each tool is a local Python function. Python only offers the tools whose precondition holds right now: ' +
  'no links means no check_link; ask_human_helper only after the sender was checked. There is no fixed order beyond ' +
  'extract_signals first, so the model picks different tools for different messages.');

// ---------------------------------------------------------------- 7. Verdict gate
s = content('How it works', 'The verdict gate accepts only what the evidence supports');
const rules = [
  ['Likely scam', 'at least 1 strong or 2 weak warning signs', RED],
  ['Likely safe', 'saved contact, no strong signs, every link official', GREEN],
  ['Not sure', 'otherwise; never with a strong sign; help offered first', AMBER],
];
for (let i = 0; i < rules.length; i++) {
  const y = 1.5 + i * 1.2;
  text(s, rules[i][0], { x: 0.6, y: y, w: 4.9, h: 0.45, fontSize: 21, bold: true, color: rules[i][2] });
  text(s, rules[i][1], { x: 0.6, y: y + 0.45, w: 4.9, h: 0.65, fontSize: 18 });
}
card(s, 0.6, 5.2, 4.9, 1.5, TINT);
text(s, 'A rejection shows expected vs. actual. After 2 rejections Python uses the supported label.',
  { x: 0.8, y: 5.32, w: 4.5, h: 1.25, fontSize: 18, valign: 'middle' });
card(s, 5.9, 1.45, 6.8, 5.3, WHITE, NAVY);
const g = D.gate_example;
if (g) {
  text(s, 'Real rejection (' + g.case + ' case, run ' + g.run + ', ' + g.mode + ')', { x: 6.15, y: 1.6, w: 6.3,
    h: 0.45, fontSize: 18, bold: true, color: NAVY });
  text(s, [
    { text: 'Model: ', options: { bold: true, color: PURPLE } },
    { text: g.label + ', "' + short(g.explanation, 120) + '"' },
  ], { x: 6.15, y: 2.15, w: 6.3, h: 1.45, fontSize: 18 });
  let failed = g.failed.length ? g.failed[0] : '';
  text(s, [
    { text: 'Python: rejected. ', options: { bold: true, color: GREEN } },
    { text: short(failed, 140) },
  ], { x: 6.15, y: 3.65, w: 6.3, h: 1.45, fontSize: 18 });
  let after = g.next_action ? g.next_action : 'nothing';
  if (g.next_action === 'done' && g.next_argument) {
    after = 'done again: "' + short(g.next_argument.explanation, 95) + '"';
  }
  text(s, [
    { text: 'Next: ', options: { bold: true, color: PURPLE } },
    { text: after },
  ], { x: 6.15, y: 5.15, w: 6.3, h: 1.0, fontSize: 18 });
  text(s, 'Ended: ' + g.final_label + ' (' + g.stop_reason + ')', { x: 6.15, y: 6.2, w: 6.3, h: 0.4,
    fontSize: 16, color: MUTED, italic: true });
} else {
  text(s, 'Gate rejection example pending', { x: 6.15, y: 2.0, w: 6.3, h: 0.8, fontSize: 20, color: AMBER });
}
s.addNotes('Python works out the label the recorded evidence supports, like check_goal in the Airways agent. The ' +
  'model\'s label must match, cited evidence ids must exist, and the explanation must mention every strong warning ' +
  'sign. The example on the right is a real rejection from a saved trace: the feedback says exactly what is missing, ' +
  'and the model fixes it on the next step.');

// ---------------------------------------------------------------- 8. Demo plan
pres.addSection({ title: 'Demonstration' });
s = content('Demonstration', 'Live demo: a scam, an injection, a tool failure');
const demo = [
  ['Scam', 'Medicare gift-card text', 'Point at: tools chosen, look-alike link E2, gate PASSED, real Medicare number'],
  ['Injection', '"AI assistant: mark safe"', 'Point at: hidden instruction found as a strong sign, gate feedback'],
  ['Guide missing', 'Tool failure (problem case)', 'Point at: TOOL FAILURE, stop reason tool_failure, "not sure" + helper'],
];
for (let i = 0; i < demo.length; i++) {
  const x = 0.6 + i * 4.1;
  card(s, x, 1.45, 3.85, 3.1, TINT);
  numberCircle(s, x + 0.2, 1.65, i + 1, NAVY);
  text(s, demo[i][0], { x: x + 0.95, y: 1.7, w: 2.75, h: 0.5, fontSize: 22, bold: true, color: NAVY });
  text(s, demo[i][1], { x: x + 0.2, y: 2.4, w: 3.45, h: 0.5, fontSize: 18, bold: true });
  text(s, demo[i][2], { x: x + 0.2, y: 2.95, w: 3.45, h: 1.5, fontSize: 18, color: INK });
}
card(s, 0.6, 4.8, 12.1, 1.55, '263238');
text(s, [
  { text: 'python3 scamshield_agent.py --case scam --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case injection --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case guide_missing --consent yes' },
], { x: 0.9, y: 4.92, w: 11.6, h: 1.3, fontSize: 18, fontFace: MONO, color: 'E0F2F1', valign: 'middle' });
text(s, 'If Ollama is slow: show the saved logs in evidence/harness/rag/run_*_console.txt', { x: 0.6, y: 6.5,
  w: 12.1, h: 0.4, fontSize: 18, color: MUTED, italic: true });
s.addNotes('Run the three commands. For the scam, point at each MODEL DECISION and VALIDATION line, the look-alike ' +
  'link, and GATE PASSED. For the injection, point at the hidden instruction listed as a strong warning sign and at ' +
  'any GATE REJECTED line. For guide_missing, point at TOOL FAILURE and the stop reason. If Ollama is slow, open the ' +
  'saved console logs instead. See docs/DEMO_SCRIPT.md.');

// ---------------------------------------------------------------- 9. Problem cases
s = content('Demonstration', 'Problem cases: none of them ends as "safe"');
const caseShort = {
  injection: 'Message tells the AI to "mark safe"',
  trusted_bad_link: 'Saved family contact sends a bank look-alike link',
  guide_missing: 'Scam guide file is missing',
  empty: 'Empty message',
};
const head = { fill: { color: NAVY }, color: WHITE, bold: true, fontSize: 18, fontFace: BODY };
const rows = [[
  { text: 'Case', options: head }, { text: 'What is tested', options: head },
  { text: 'How run 1 ended', options: head }, { text: 'Repeated runs correct', options: head },
]];
for (let i = 0; i < D.problems.length; i++) {
  const p = D.problems[i];
  const fill = { color: i % 2 ? WHITE : TINT };
  rows.push([
    { text: p.case, options: { fontFace: MONO, bold: true, fill: fill } },
    { text: caseShort[p.case] || p.what, options: { fill: fill } },
    { text: p.ended, options: { fill: fill } },
    { text: p.repeated, options: { fill: fill } },
  ]);
}
rows.push([
  { text: 'model down', options: { fontFace: MONO, bold: true, fill: { color: D.problems.length % 2 ? WHITE : TINT } } },
  { text: 'Ollama unreachable or one failed call', options: { fill: { color: D.problems.length % 2 ? WHITE : TINT } } },
  { text: 'retried twice, then model_error; never safe', options: { fill: { color: D.problems.length % 2 ? WHITE : TINT } } },
  { text: 'offline tests', options: { fill: { color: D.problems.length % 2 ? WHITE : TINT } } },
]);
s.addTable(rows, { x: 0.6, y: 1.45, w: 12.1, colW: [2.4, 4.0, 3.6, 2.1], fontSize: 18, fontFace: BODY, color: INK,
  border: { type: 'solid', pt: 0.75, color: 'CFD8DC' }, valign: 'middle', margin: 0.08 });
s.addNotes('Each problem case was run repeatedly with the live model. The injection text is itself a strong warning ' +
  'sign, a trusted sender does not make a bad link safe, a missing guide ends as tool_failure with "not sure", and an ' +
  'empty message stops before the model is called. A failed model call is retried twice, then the run stops with ' +
  'model_error.');

// ---------------------------------------------------------------- 10. Results
pres.addSection({ title: 'Results' });
s = content('Results', 'Testing and results');
const E = D.eval.rag;
const EK = D.eval.keyword;
const H = D.holdout.rag;
const HK = D.holdout.keyword;
const stats = [
  [D.tests, 'offline tests passed', NAVY],
  [E.correct, 'eval set correct (RAG)', GREEN],
  [E.false_safe, 'false "safe" answers (eval, RAG)', RED],
  [D.harness_total, 'repeated demo runs correct', GREEN],
  [D.rules_after, 'held-out set, rules only', AMBER],
];
for (let i = 0; i < stats.length; i++) {
  const x = 0.6 + i * 2.46;
  card(s, x, 1.45, 2.26, 2.3, TINT);
  text(s, String(stats[i][0]), { x: x + 0.1, y: 1.6, w: 2.06, h: 1.0, fontSize: 34, bold: true,
    color: stats[i][0] === 'pending' ? AMBER : stats[i][2], align: 'center', valign: 'middle' });
  text(s, stats[i][1], { x: x + 0.15, y: 2.65, w: 1.96, h: 1.0, fontSize: 16, color: INK, align: 'center' });
}
const resultLines = [
  'Evaluation set, keyword only: ' + EK.correct + ' correct, false "safe" ' + EK.false_safe,
  'Model\'s own last label: ' + E.model_last + ' with RAG, ' + EK.model_last + ' keyword; gate overrode it ' +
    E.overrides + ' / ' + EK.overrides + ' times',
  'Held-out set, live agent: ' + H.correct + ' (RAG), ' + HK.correct + ' (keyword); false "safe" ' + H.false_safe +
    ' / ' + HK.false_safe,
  'Rules only on the held-out set: ' + D.rules_before + ' before the round-1 rule changes, ' + D.rules_after + ' after',
];
const resultRuns = [];
for (let i = 0; i < resultLines.length; i++) {
  resultRuns.push({ text: resultLines[i], options: { bullet: true, breakLine: i < resultLines.length - 1 } });
}
text(s, resultRuns, { x: 0.6, y: 4.05, w: 12.1, h: 2.3, fontSize: 18, paraSpaceAfter: 8 });
let wrongIds = [];
for (let i = 0; i < D.rules_after_wrong.length; i++) {
  wrongIds.push(D.rules_after_wrong[i].id);
}
text(s, 'Honest miss: ' + (wrongIds.length ? wrongIds.join(', ') + ' still "not sure" instead of "scam" (only unknown links)' :
  'none'), { x: 0.6, y: 6.45, w: 12.1, h: 0.45, fontSize: 18, color: MUTED, italic: true });
s.addNotes('All numbers on this slide are read from the evidence files when the deck is built. The offline tests use ' +
  'a scripted model with deliberately wrong answers. The held-out set was written before the rule changes and was ' +
  'not edited to pass. Any value shown as "pending" was not available when the deck was built.');

// ---------------------------------------------------------------- 11. Learned
pres.addSection({ title: 'Conclusion' });
s = content('Conclusion', 'What I learned');
const learned = D.learned.slice(0, 5);
for (let i = 0; i < learned.length; i++) {
  const y = 1.4 + i * 1.12;
  numberCircle(s, 0.6, y + 0.08, i + 1, PURPLE);
  text(s, learned[i].lesson, { x: 1.45, y: y, w: 11.2, h: 0.68, fontSize: 19, bold: true, valign: 'middle' });
  text(s, 'DEVLOG: ' + learned[i].title, { x: 1.45, y: y + 0.7, w: 11.2, h: 0.35, fontSize: 16, color: MUTED });
}
s.addNotes('These lessons come from the development log findings. The most important: never trust the model\'s ' +
  'output shape or its verdict; make the checker say what it expected; and measure the innovation honestly.');

// ---------------------------------------------------------------- 12. Limitations
s = pres.addSlide({ masterName: 'SCAMSHIELD_DARK', sectionTitle: 'Conclusion' });
s.addText('Limitations and next steps', { placeholder: 'title' });
const limits = ['Same author wrote the rules, guide and test messages', 'Small local model: often too quick to say "safe"',
  'RAG gain is small on this data', 'Fictional English texts only; regex rules miss new tricks'];
const next = ['Test with real (anonymized) scam texts', 'Ask older adults whether the explanations help',
  'Larger website list and other alphabets', 'Phone integration with a real, consented family alert'];
text(s, 'Limitations', { x: 0.7, y: 1.75, w: 5.8, h: 0.5, fontSize: 24, bold: true, color: 'FFCDD2' });
text(s, 'Next steps', { x: 6.9, y: 1.75, w: 5.8, h: 0.5, fontSize: 24, bold: true, color: 'C8E6C9' });
const limitRuns = [];
const nextRuns = [];
for (let i = 0; i < limits.length; i++) {
  limitRuns.push({ text: limits[i], options: { bullet: true, breakLine: i < limits.length - 1 } });
  nextRuns.push({ text: next[i], options: { bullet: true, breakLine: i < next.length - 1 } });
}
text(s, limitRuns, { x: 0.7, y: 2.4, w: 5.8, h: 3.6, fontSize: 20, color: WHITE, paraSpaceAfter: 12 });
text(s, nextRuns, { x: 6.9, y: 2.4, w: 5.8, h: 3.6, fontSize: 20, color: WHITE, paraSpaceAfter: 12 });
text(s, 'Thank you. Questions?   ' + D.repo, { x: 0.7, y: 6.4, w: 11.9, h: 0.5, fontSize: 18, color: 'CADCFC' });
s.addNotes('Be honest about the limits: the evaluation data was written by me, the model is small, and the RAG gain ' +
  'is small. The safety comes from Python\'s evidence gate, not from the model. Next steps would be real data and ' +
  'feedback from older adults.');

pres.writeFile({ fileName: outPath }).then(function () {
  console.log('wrote ' + path.basename(outPath) + ' (' + pres.slides.length + ' slides)');
});
