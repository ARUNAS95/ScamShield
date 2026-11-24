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
  [GREEN, 'Likely safe', 'saved contact, no strong signs, at most 1 weak sign, every link checked and official, no tool failure'],
  [AMBER, 'Not sure', 'evidence cannot settle it: ask someone you trust'],
];
for (let i = 0; i < verdicts.length; i++) {
  const y = 1.55 + i * 1.6;
  pill(s, 0.6, y, 2.6, 0.7, verdicts[i][0], verdicts[i][1], 20);
  text(s, verdicts[i][2], { x: 0.6, y: y + 0.76, w: 4.7, h: 0.8, fontSize: 16, color: INK });
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

// ---------------------------------------------------------------- 4. How it works (two slides)
// The full diagram (docs/workflow.png) is in the PDF. On slides it is split
// into two native diagrams so the smallest text is 14 pt when projected.
function flowBox(slide, x, y, w, h, fill, line, title, body, titleColor) {
  card(slide, x, y, w, h, fill, line);
  text(slide, title, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: 0.42, fontSize: 18, bold: true,
    color: titleColor || NAVY, align: 'center' });
  if (body) {
    text(slide, body, { x: x + 0.12, y: y + 0.52, w: w - 0.24, h: h - 0.6, fontSize: 15, color: INK,
      align: 'center' });
  }
}

function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1,
    line: { color: color || '37474F', width: 2, endArrowType: 'triangle' } });
}

function plainLine(slide, x1, y1, x2, y2, color) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1), line: { color: color || '37474F', width: 2 } });
}

function arrowLabel(slide, x, y, w, value, color) {
  text(slide, value, { x: x, y: y, w: w, h: 0.4, fontSize: 14, italic: true, color: color || MUTED,
    align: 'center' });
}

pres.addSection({ title: 'How it works' });
s = content('How it works', 'How it works (1/2): the model chooses, Python checks');
const COLS = [0.6, 3.8, 7.0, 10.2];
const BW = 2.5;
const TOP = 1.95;
const BOT = 4.35;
const BH = 1.6;
flowBox(s, COLS[0], TOP, BW, BH, TINT, 'B0BEC5', 'Text message', '+ sender number (fictional)');
flowBox(s, COLS[1], TOP, BW, BH, MINT, GREEN, 'Input check', 'Python: empty or too long?', GREEN);
flowBox(s, COLS[2], TOP, BW, BH, LAVENDER, PURPLE, 'Model chooses', 'ONE action as JSON: action + argument', PURPLE);
flowBox(s, COLS[3], TOP, BW, BH, MINT, GREEN, 'Parser + validator', 'allowed now? argument from the message? not a repeat?', GREEN);
flowBox(s, COLS[1], BOT, BW, BH, 'FFEBEE', RED, 'Stop: invalid_input', 'answer: not sure (no model call)', RED);
flowBox(s, COLS[2], BOT, BW, BH, MINT, GREEN, 'Evidence E1, E2 ...', '+ evidence ledger + NEXT OPTIONS back to the model', GREEN);
flowBox(s, COLS[3], BOT, BW, BH, MINT, GREEN, 'Tool runs (Python)', 'never opens links; post-check: did the state really change?', GREEN);
arrow(s, COLS[0] + BW, TOP + BH / 2, COLS[1], TOP + BH / 2);
arrow(s, COLS[1] + BW, TOP + BH / 2, COLS[2], TOP + BH / 2);
arrow(s, COLS[2] + BW, TOP + BH / 2, COLS[3], TOP + BH / 2);
// Rejected proposals loop back over the top: validator -> model.
plainLine(s, COLS[3] + BW / 2, TOP, COLS[3] + BW / 2, TOP - 0.2, RED);
plainLine(s, COLS[2] + BW / 2, TOP - 0.2, COLS[3] + BW / 2, TOP - 0.2, RED);
arrow(s, COLS[2] + BW / 2, TOP - 0.2, COLS[2] + BW / 2, TOP, RED);
arrowLabel(s, COLS[2] + BW / 2, TOP - 0.6, COLS[3] - COLS[2], 'rejected: reason + allowed actions go back', RED);
arrow(s, COLS[1] + BW / 2, TOP + BH, COLS[1] + BW / 2, BOT, RED);
arrowLabel(s, COLS[1] + BW / 2 + 0.05, TOP + BH + 0.2, 1.3, 'fails', RED);
arrow(s, COLS[3] + BW / 2, TOP + BH, COLS[3] + BW / 2, BOT);
arrowLabel(s, COLS[3] + BW / 2 + 0.05, TOP + BH + 0.2, 1.2, 'tool');
arrow(s, COLS[3], BOT + BH / 2, COLS[2] + BW, BOT + BH / 2);
arrow(s, COLS[2] + BW / 2, BOT, COLS[2] + BW / 2, TOP + BH);
arrowLabel(s, COLS[2] + BW / 2 - 1.35, TOP + BH + 0.2, 1.3, 'next step');
card(s, 0.6, 6.15, 12.1, 0.7, AMBER_TINT, 'D97706');
text(s, 'When the model chooses done, the validator sends it to the verdict gate (next slide). A tool failure is ' +
  'recorded and that tool is not offered again.', { x: 0.8, y: 6.2, w: 11.7, h: 0.6, fontSize: 16, valign: 'middle' });
s.addNotes('Walk through the loop: Python checks the input, then the model chooses ONE action as JSON. Python parses ' +
  'and validates it: is this action allowed now, does the argument come from the message. A rejection goes back to ' +
  'the model with the reason and the allowed actions. The tool runs locally and never opens links; a post-check ' +
  'verifies the state change. The result becomes evidence E1, E2 with a ledger and the NEXT OPTIONS list, and the ' +
  'model chooses again. The full diagram is in the project document.');

s = content('How it works', 'How it works (2/2): the verdict gate and the answer');
const GX = [0.6, 3.8, 7.0, 10.2];
const GY = 1.95;
flowBox(s, GX[0], GY, BW, BH, LAVENDER, PURPLE, 'Model: done', 'label + evidence ids + explanation', PURPLE);
flowBox(s, GX[1], GY, BW, BH, MINT, GREEN, 'Verdict gate', 'does the recorded evidence support this label?', GREEN);
flowBox(s, GX[2], GY, BW, BH, MINT, GREEN, 'Readability', 'verdict first, at most 6 short sentences, no jargon or links', GREEN);
flowBox(s, GX[3], GY, BW, BH, TINT, NAVY, 'Final answer', 'verdict + explanation + "what to do" by Python + trace');
arrow(s, GX[0] + BW, GY + BH / 2, GX[1], GY + BH / 2);
arrow(s, GX[1] + BW, GY + BH / 2, GX[2], GY + BH / 2);
arrowLabel(s, GX[1] + BW - 0.1, GY + BH / 2 - 0.45, 0.9, 'passes', GREEN);
arrow(s, GX[2] + BW, GY + BH / 2, GX[3], GY + BH / 2);
arrowLabel(s, GX[2] + BW - 0.1, GY + BH / 2 - 0.45, 0.9, 'ok', GREEN);
flowBox(s, GX[0], BOT, BW + 0.7, BH, 'FFF8E1', AMBER, '1st rejection', 'feedback shows expected vs. actual; the model tries again', AMBER);
flowBox(s, GX[1] + 0.9, BOT, BW + 1.6, BH, 'FFEBEE', RED, '2nd rejection: Python decides',
  'uses the label the evidence supports (gate_downgrade), but never "safe" if the model was worried', RED);
flowBox(s, GX[3] - 0.3, BOT, BW + 0.3, BH, 'FFF8E1', AMBER, 'Too hard to read', 'one rewrite, then Python\'s template', AMBER);
arrow(s, GX[1] + 0.6, GY + BH, GX[0] + 1.6, BOT, AMBER);
arrow(s, GX[1] + 1.9, GY + BH, GX[1] + 2.4, BOT, RED);
arrow(s, GX[2] + 1.9, GY + BH, GX[3] + 0.6, BOT, AMBER);
card(s, 0.6, 6.15, 12.1, 0.7, TINT);
text(s, 'Safe needs: a saved contact, no strong signs, at most 1 weak sign, every link checked and official, ' +
  'no tool failure.', { x: 0.8, y: 6.2, w: 11.7, h: 0.6, fontSize: 16, valign: 'middle' });
s.addNotes('When the model says done, the verdict gate checks the label against the recorded evidence, like ' +
  'check_goal in the Airways agent. A first rejection goes back to the model with expected versus actual. After a ' +
  'second rejection Python uses the label the evidence supports, but the model\'s concern can only make the answer ' +
  'more careful: if the model said scam or not sure, the answer is never safe. Then the readability check, one ' +
  'rewrite, and the final answer with Python\'s what-to-do line.');

// ---------------------------------------------------------------- 5. Model vs Python
s = content('How it works', 'The model decides; Python checks every decision');
card(s, 0.6, 1.45, 5.9, 5.3, LAVENDER, PURPLE);
card(s, 6.8, 1.45, 5.9, 5.3, MINT, GREEN);
text(s, 'The model decides', { x: 0.9, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: PURPLE });
text(s, 'Python checks', { x: 7.1, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: GREEN });
const modelSide = ['Which tool to use next, and with which argument', 'What to search for in the scam guide',
  'When it has enough evidence', 'Which label to propose, which evidence to cite', 'How to word the explanation'];
const pythonSide = ['Is this action allowed now? Is the argument from the message?', 'Was the result recorded? Alert read back from the log',
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
  ['Likely safe', 'saved contact, no strong signs, at most 1 weak sign, every link checked and official, no tool failure', GREEN],
  ['Not sure', 'otherwise; never with a strong sign; help must be offered first', AMBER],
];
for (let i = 0; i < rules.length; i++) {
  const y = 1.5 + i * 1.2;
  text(s, rules[i][0], { x: 0.6, y: y, w: 4.9, h: 0.45, fontSize: 21, bold: true, color: rules[i][2] });
  text(s, rules[i][1], { x: 0.6, y: y + 0.42, w: 4.9, h: 0.75, fontSize: 16 });
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
s = content('Demonstration', 'Live demo: safe, scam, not sure, two problem cases');
const demo = [
  ['Ordinary', 'Saved pharmacy reminder', 'Point at: no warning signs, saved contact, LIKELY SAFE'],
  ['Scam', 'Medicare gift-card text', 'Point at: tools chosen, look-alike link, gate PASSED, what-to-do line'],
  ['Not sure', 'Unknown doctor\'s office', 'Point at: NEXT OPTIONS adds ask_human_helper after check_sender'],
  ['Guide missing', 'Tool failure (problem case)', 'Point at: TOOL FAILURE, stop reason tool_failure, never safe'],
  ['Rules miss it', 'Cash courier text from family (problem case)', 'Point at: no warning signs, the model worries, NOT SURE (honest: 2 of 6 saved runs said safe)'],
];
for (let i = 0; i < demo.length; i++) {
  const x = 0.6 + i * 2.46;
  card(s, x, 1.45, 2.3, 3.05, TINT);
  numberCircle(s, x + 0.12, 1.6, i + 1, NAVY);
  text(s, demo[i][0], { x: x + 0.75, y: 1.62, w: 1.5, h: 0.55, fontSize: 17, bold: true, color: NAVY });
  text(s, demo[i][1], { x: x + 0.12, y: 2.25, w: 2.1, h: 0.65, fontSize: 14, bold: true });
  text(s, demo[i][2], { x: x + 0.12, y: 2.9, w: 2.1, h: 1.55, fontSize: 14, color: INK });
}
card(s, 0.6, 4.65, 12.1, 1.65, '263238');
text(s, [
  { text: 'python3 scamshield_agent.py --case ordinary --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case scam --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case uncertain --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case guide_missing --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case model_catches_miss --consent yes   (extra: --case injection)' },
], { x: 0.9, y: 4.72, w: 11.6, h: 1.5, fontSize: 15, fontFace: MONO, color: 'E0F2F1', valign: 'middle' });
text(s, 'If Ollama is slow: saved console logs in evidence/harness/rag/run_<case>_1_console.txt. If guide_missing ' +
  'did not search the guide: show run_guide_missing_1_console.txt.', { x: 0.6, y: 6.35, w: 12.1, h: 0.6,
  fontSize: 15, color: MUTED, italic: true });
s.addNotes('Run the five commands. Ordinary: no warning signs and a saved contact, so likely safe. Scam: point at each ' +
  'MODEL DECISION and VALIDATION line, the look-alike link and GATE PASSED. Not sure: point at the NEXT OPTIONS line, ' +
  'where ask_human_helper appears only after check_sender, then the simulated alert. Guide missing: point at TOOL ' +
  'FAILURE and the stop reason. Rules miss it: the rules find no warning sign in a cash courier text from a saved ' +
  'contact; when the model is worried its concern makes the answer "not sure". Be honest: in 2 of 6 saved runs (keyword mode) the model was not worried and it was called safe. The injection case is ' +
  'an optional extra. If Ollama is slow, open the saved console ' +
  'logs instead. See docs/DEMO_SCRIPT.md.');

// ---------------------------------------------------------------- 9. Problem cases
s = content('Demonstration', 'Problem cases: none of them ends as "safe"');
const caseShort = {
  injection: 'Message tells the AI to "mark safe"',
  trusted_bad_link: 'Saved family contact sends a bank look-alike link',
  model_catches_miss: 'Family contact asks for cash for a stranger; rules find nothing',
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
s.addTable(rows, { x: 0.6, y: 1.45, w: 12.1, colW: [2.9, 3.7, 3.4, 2.1], fontSize: 16, fontFace: BODY, color: INK,
  border: { type: 'solid', pt: 0.75, color: 'CFD8DC' }, valign: 'middle', margin: 0.08 });
s.addNotes('Each problem case was run repeatedly with the live model. The injection text is itself a strong warning ' +
  'sign, a trusted sender does not make a bad link safe, a text the rules miss ends as "not sure" when the model is ' +
  'worried (in 2 of 6 saved runs it was not, and the answer was safe), a missing guide ends as tool_failure with "not sure", and an ' +
  'empty message stops before the model is called. A failed model call is retried twice, then the run stops with ' +
  'model_error.');

// ---------------------------------------------------------------- 10. Results
pres.addSection({ title: 'Results' });
s = content('Results', 'Testing and results');
const E = D.eval.rag;
const EK = D.eval.keyword;
const H = D.holdout.rag;
const HK = D.holdout.keyword;
const H2 = D.holdout2.rag;
const H2K = D.holdout2.keyword;
const stats = [
  [D.tests, 'offline tests passed', NAVY],
  [E.correct, 'eval set correct (RAG)', GREEN],
  [D.live_false_safe, 'false "safe" in ' + D.live_runs + ' live runs', RED],
  [D.harness_total, 'repeated demo runs correct', GREEN],
  [D.holdout2_before + ' > ' + D.holdout2_after, 'held-out set 2, rules only (before > after)', AMBER],
];
for (let i = 0; i < stats.length; i++) {
  const x = 0.6 + i * 2.46;
  card(s, x, 1.45, 2.26, 2.3, TINT);
  text(s, String(stats[i][0]), { x: x + 0.1, y: 1.6, w: 2.06, h: 1.0, fontSize: String(stats[i][0]).length > 8 ? 24 : 34, bold: true,
    color: stats[i][0] === 'pending' ? AMBER : stats[i][2], align: 'center', valign: 'middle' });
  text(s, stats[i][1], { x: x + 0.15, y: 2.65, w: 1.96, h: 1.0, fontSize: 16, color: INK, align: 'center' });
}
const resultLines = [
  'Evaluation set, keyword only: ' + EK.correct + ' correct, false "safe" ' + EK.false_safe,
  'Model\'s own last label: ' + E.model_last + ' with RAG, ' + EK.model_last + ' keyword; gate overrode it ' +
    E.overrides + ' / ' + EK.overrides + ' times',
  'Held-out set 1, live agent: ' + H.correct + ' (RAG), ' + HK.correct + ' (keyword); false "safe" ' + H.false_safe +
    ' / ' + HK.false_safe,
  'Held-out set 2, live agent: ' + H2.correct + ' (RAG), ' + H2K.correct + ' (keyword); false "safe" ' + H2.false_safe +
    ' / ' + H2K.false_safe,
  'Rules only on held-out set 1: ' + D.rules_before + ' before the round-1 fixes, ' + D.rules_after +
    ' after (rules were fixed using these failures, so no longer held-out)',
  'Break the gate (always "safe"): ' + D.break_gate + ' tests fail',
];
const resultRuns = [];
for (let i = 0; i < resultLines.length; i++) {
  resultRuns.push({ text: resultLines[i], options: { bullet: true, breakLine: i < resultLines.length - 1 } });
}
text(s, resultRuns, { x: 0.6, y: 3.9, w: 12.1, h: 2.4, fontSize: 15, paraSpaceAfter: 4 });
let wrongIds = [];
for (let i = 0; i < D.rules_after_wrong.length; i++) {
  wrongIds.push(D.rules_after_wrong[i].id);
}
for (let i = 0; i < D.holdout2_after_wrong.length; i++) {
  wrongIds.push(D.holdout2_after_wrong[i].id + ' (expected ' + D.holdout2_after_wrong[i].expected + ', rules say ' +
    D.holdout2_after_wrong[i].supported + ')');
}
text(s, 'Wrong live answers (none "safe"): ' + (D.live_wrong.length ? D.live_wrong.join('; ') : 'none') +
  '.   Rules only: ' + (wrongIds.length ? wrongIds.join('; ') : 'none'),
  { x: 0.6, y: 6.3, w: 12.1, h: 0.65, fontSize: 13, color: MUTED, italic: true });
s.addNotes('All numbers on this slide are read from the evidence files when the deck is built. The offline tests use ' +
  'a scripted model with deliberately wrong answers. Held-out set 2 was written and committed before the round-2 ' +
  'rule changes and was never edited; its before score is the honest one. Any value shown as "pending" was not ' +
  'available when the deck was built.');

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
  'Larger website list and more look-alike tricks', 'Phone integration with a real, consented family alert'];
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
