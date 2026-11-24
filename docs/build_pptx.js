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

// ---- Theme: change these few constants to restyle the whole deck ----
const BG = 'FBF8F3';            // slide background, warm off-white
const ORANGE = 'F6B26B';        // light orange: title bar, table headers, highlights
const ORANGE_SOFT = 'FCE5CD';   // pale orange: card fills
const ORANGE_LINE = 'E9A35A';   // card borders
const ORANGE_DEEP = 'E07B24';   // deeper orange: arrows, number circles, "pending" marker
const ORANGE_TEXT = 'A04E0C';   // deep orange for small accent text (readable on off-white)
const INK = '2B2B2B';           // body text, dark charcoal
const MUTED = '6A5D50';         // captions, warm grey
const SAND = 'F1EBE2';          // neutral warm card (the Python side)
const SAND_LINE = 'BFB2A3';
const WHITE = 'FFFFFF';
// Verdict colors, the same meaning on every slide (white text on each passes contrast)
const SCAM = 'B83227';          // likely scam: brick red
const SCAM_TINT = 'FADBD6';
const SAFE = '2F7A4B';          // likely safe: green
const SAFE_TINT = 'E2F0E6';
const UNSURE = 'A86400';        // not sure: amber
const UNSURE_TINT = 'FDECCF';
const CODE_BG = '2B2B2B';
const CODE_TEXT = 'FCE5CD';
const BODY = 'Calibri';
const MONO = 'Courier New';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';            // 13.33 x 7.5 inches
pres.author = D.student;
pres.title = 'ScamShield';
pres.subject = 'CSYE 7374 Agentic AI mini-project';
pres.theme = { headFontFace: BODY, bodyFontFace: BODY };

const TITLE_SIZE = 30;

// Title and closing slides: light orange background, charcoal text.
pres.defineSlideMaster({
  title: 'SCAMSHIELD_HERO',
  background: { color: ORANGE },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.5, w: 11.9, h: 1.0, fontFace: BODY,
      fontSize: 36, bold: true, color: INK, valign: 'middle' }, text: '' } },
  ],
});

// Content slides: off-white background under a light orange title bar.
pres.defineSlideMaster({
  title: 'SCAMSHIELD_CONTENT',
  background: { color: BG },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 1.1, fill: { color: ORANGE }, line: { color: ORANGE } } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.12, w: 12.1, h: 0.86, fontFace: BODY,
      fontSize: TITLE_SIZE, bold: true, color: INK, valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: 'ScamShield  |  CSYE 7374 Agentic AI', options: { x: 0.6, y: 7.08, w: 6, h: 0.3, fontFace: BODY,
      fontSize: 12, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.05, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 12, color: MUTED, align: 'right' },
});

function text(slide, value, options) {
  const merged = Object.assign({ isTextBox: true, fontFace: BODY, color: INK, margin: 0, valign: 'top' }, options);
  slide.addText(value, merged);
}

function card(slide, x, y, w, h, fill, line, dash) {
  const border = { color: line || fill, width: 1.25 };
  if (dash) {
    border.dashType = 'dash';
    border.width = 2;
  }
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: w, h: h, rectRadius: 0.12,
    fill: { color: fill }, line: border });
}

function pill(slide, x, y, w, h, fill, label, size, labelColor) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: w, h: h, rectRadius: h / 2,
    fill: { color: fill }, line: { color: fill } });
  text(slide, label, { x: x, y: y, w: w, h: h, fontSize: size || 20, bold: true, color: labelColor || WHITE,
    align: 'center', valign: 'middle' });
}

function numberCircle(slide, x, y, n) {
  slide.addShape(pres.shapes.OVAL, { x: x, y: y, w: 0.6, h: 0.6, fill: { color: ORANGE }, line: { color: ORANGE_DEEP, width: 1.5 } });
  text(slide, String(n), { x: x, y: y, w: 0.6, h: 0.6, fontSize: 22, bold: true, color: INK,
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

const SAFE_RULE = 'saved contact, no strong signs, at most 1 weak sign, every link checked and official, the official ' +
  'number looked up whenever the message gives a phone number for an organization it claims, no tool failure';

// ---------------------------------------------------------------- 1. Title
pres.addSection({ title: 'Introduction' });
let s = pres.addSlide({ masterName: 'SCAMSHIELD_HERO', sectionTitle: 'Introduction' });
text(s, 'ScamShield', { x: 0.7, y: 1.4, w: 7.5, h: 1.2, fontSize: 60, bold: true, color: INK });
text(s, 'A plain-language scam warning agent for older adults', { x: 0.7, y: 2.7, w: 7.2, h: 1.1,
  fontSize: 26, color: INK });
text(s, [
  { text: D.student, options: { bold: true, breakLine: true } },
  { text: D.course, options: { breakLine: true } },
  { text: D.date, options: { breakLine: true } },
  { text: D.repo },
], { x: 0.7, y: 4.3, w: 7.4, h: 1.9, fontSize: 18, color: INK, paraSpaceAfter: 4 });
card(s, 8.6, 1.3, 4.1, 5.0, BG, ORANGE_DEEP);
pill(s, 8.8, 1.6, 3.7, 0.8, SCAM, 'Likely scam', 22);
pill(s, 8.8, 2.7, 3.7, 0.8, SAFE, 'Likely safe', 22);
pill(s, 8.8, 3.8, 3.7, 1.1, UNSURE, 'Not sure: ask someone you trust', 20);
text(s, 'Fictional messages only. Never opens links.', { x: 8.8, y: 5.2, w: 3.7, h: 0.8, fontSize: 16,
  color: MUTED, align: 'center', valign: 'middle' });
s.addNotes('ScamShield checks one text message and answers in plain words: likely scam, likely safe, or not sure. ' +
  'It runs a local language model, qwen3:8b with Ollama, as an agent that chooses tools step by step, and Python checks ' +
  'every step. Everything is fictional and nothing is ever opened or sent.');

// ---------------------------------------------------------------- 2. Problem
pres.addSection({ title: 'Problem' });
s = content('Problem', 'Scam texts are built to rush older adults');
const exampleText = D.example ? D.example.message.text : 'Example message pending';
card(s, 0.6, 1.45, 5.6, 3.75, WHITE, SAND_LINE);
text(s, 'A text from an unknown number:', { x: 0.85, y: 1.65, w: 5.1, h: 0.4, fontSize: 18, color: MUTED });
text(s, exampleText, { x: 0.85, y: 2.1, w: 5.1, h: 2.95, fontSize: 20, color: INK });
const problems = [
  ['They copy real organizations', 'Medicare, the post office, a bank, a grandchild'],
  ['They rush and threaten', '"Your benefits will be suspended today"'],
  ['They ask for gift cards or codes', 'payment apps, or a tap on a look-alike link'],
];
for (let i = 0; i < problems.length; i++) {
  const y = 1.5 + i * 1.25;
  numberCircle(s, 6.8, y + 0.05, i + 1);
  text(s, problems[i][0], { x: 7.6, y: y, w: 5.1, h: 0.45, fontSize: 21, bold: true });
  text(s, problems[i][1], { x: 7.6, y: y + 0.48, w: 5.1, h: 0.5, fontSize: 18, color: MUTED });
}
card(s, 0.6, 5.5, 12.1, 1.3, ORANGE_SOFT, ORANGE_LINE);
text(s, 'People are told "don\'t click links", but rarely why this message is suspicious. ScamShield explains the ' +
  'evidence and says "not sure" instead of guessing.', { x: 0.9, y: 5.6, w: 11.5, h: 1.1, fontSize: 20,
  color: INK, valign: 'middle' });
s.addNotes('Scam texts copy real organizations, rush people and ask for gift cards, codes or payments. Older adults are ' +
  'targeted often. The usual advice is "don\'t click", but it does not teach why a message is suspicious. ' +
  'ScamShield explains the evidence in everyday words and, when it cannot tell, recommends asking a trusted person.');

// ---------------------------------------------------------------- 3. What it does
s = content('Problem', 'One message in, a plain answer out');
const verdicts = [
  [SCAM, 'Likely scam', 'a strong warning sign, or two weak ones', 1.45, 0.45],
  [SAFE, 'Likely safe', SAFE_RULE, 2.7, 1.6],
  [UNSURE, 'Not sure', 'evidence cannot settle it: ask someone you trust', 4.75, 0.75],
];
for (let i = 0; i < verdicts.length; i++) {
  const y = verdicts[i][3];
  pill(s, 0.6, y, 2.6, 0.6, verdicts[i][0], verdicts[i][1], 20);
  text(s, verdicts[i][2], { x: 0.6, y: y + 0.7, w: 4.9, h: verdicts[i][4], fontSize: verdicts[i][2].length > 100 ? 16 : 18,
    color: INK });
}
card(s, 5.9, 1.45, 6.8, 5.35, WHITE, ORANGE_LINE);
if (D.example) {
  pill(s, 6.2, 1.7, 2.6, 0.6, SCAM, D.example.final_label.toUpperCase(), 18);
  text(s, short(D.example.explanation, 330), { x: 6.2, y: 2.5, w: 6.2, h: 2.4, fontSize: 18 });
  text(s, [
    { text: 'What to do: ', options: { bold: true, color: ORANGE_TEXT } },
    { text: short(D.example.what_to_do, 210) },
  ], { x: 6.2, y: 4.9, w: 6.2, h: 1.35, fontSize: 18 });
  text(s, 'Real output from a saved live run. The "what to do" line is written by Python.', { x: 6.2, y: 6.3,
    w: 6.2, h: 0.4, fontSize: 14, color: MUTED, italic: true });
} else {
  text(s, 'Example output pending', { x: 6.2, y: 2.0, w: 6.2, h: 1, fontSize: 20, color: ORANGE_TEXT });
}
s.addNotes('Three possible answers. The example on the right is the real output for the Medicare gift-card text: the ' +
  'model wrote the explanation, Python checked it, and Python added the what-to-do line with the real Medicare number ' +
  'from a trusted list, so the model can never invent a phone number.');

// ---------------------------------------------------------------- 4. How it works (two slides)
// The full diagram (docs/workflow.png) is in the PDF. On slides it is split
// into two native diagrams so the smallest text is 14 pt when projected.
// Colors: orange boxes = the model decides; sand boxes = Python checks;
// red = a stop, amber = a retry.
const ARROW = '5A4E44';
const MODEL_BOX = [ORANGE, ORANGE_DEEP, INK];
const PY_BOX = [SAND, SAND_LINE, INK];
const IN_BOX = [WHITE, SAND_LINE, INK];
const STOP_BOX = [SCAM_TINT, SCAM, SCAM];
const RETRY_BOX = [UNSURE_TINT, UNSURE, UNSURE];

function flowBox(slide, x, y, w, h, style, title, body) {
  card(slide, x, y, w, h, style[0], style[1]);
  text(slide, title, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: 0.42, fontSize: 18, bold: true,
    color: style[2], align: 'center' });
  if (body) {
    text(slide, body, { x: x + 0.12, y: y + 0.52, w: w - 0.24, h: h - 0.6, fontSize: 15, color: INK,
      align: 'center' });
  }
}

function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1,
    line: { color: color || ARROW, width: 2, endArrowType: 'triangle' } });
}

function plainLine(slide, x1, y1, x2, y2, color) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1), line: { color: color || ARROW, width: 2 } });
}

function arrowLabel(slide, x, y, w, value, color) {
  text(slide, value, { x: x, y: y, w: w, h: 0.4, fontSize: 14, italic: true, color: color || MUTED,
    align: 'center' });
}

function legend(slide, y) {
  const items = [[MODEL_BOX, 'the model decides'], [PY_BOX, 'Python checks'], [STOP_BOX, 'stop'], [RETRY_BOX, 'retry']];
  let x = 0.6;
  for (let i = 0; i < items.length; i++) {
    card(slide, x, y + 0.06, 0.32, 0.26, items[i][0][0], items[i][0][1]);
    text(slide, items[i][1], { x: x + 0.42, y: y, w: 2.2, h: 0.38, fontSize: 14, color: MUTED, valign: 'middle' });
    x += 0.42 + (items[i][1].length * 0.085) + 0.45;
  }
}

pres.addSection({ title: 'How it works' });
s = content('How it works', 'How it works (1/2): the model chooses, Python checks');
const COLS = [0.6, 3.8, 7.0, 10.2];
const BW = 2.5;
const TOP = 2.05;
const BOT = 4.4;
const BH = 1.55;
legend(s, 1.25);
flowBox(s, COLS[0], TOP, BW, BH, IN_BOX, 'Text message', '+ sender number (fictional)');
flowBox(s, COLS[1], TOP, BW, BH, PY_BOX, 'Input check', 'Python: empty or too long?');
flowBox(s, COLS[2], TOP, BW, BH, MODEL_BOX, 'Model chooses', 'ONE action as JSON: action + argument');
flowBox(s, COLS[3], TOP, BW, BH, PY_BOX, 'Parser + validator', 'allowed now? argument from the message? not a repeat?');
flowBox(s, COLS[1], BOT, BW, BH, STOP_BOX, 'Stop: invalid_input', 'answer: not sure (no model call)');
flowBox(s, COLS[2], BOT, BW, BH, PY_BOX, 'Evidence E1, E2 ...', '+ evidence ledger + NEXT OPTIONS back to the model');
flowBox(s, COLS[3], BOT, BW, BH, PY_BOX, 'Tool runs (Python)', 'never opens links; post-check: did the state really change?');
arrow(s, COLS[0] + BW, TOP + BH / 2, COLS[1], TOP + BH / 2);
arrow(s, COLS[1] + BW, TOP + BH / 2, COLS[2], TOP + BH / 2);
arrow(s, COLS[2] + BW, TOP + BH / 2, COLS[3], TOP + BH / 2);
// Rejected proposals loop back over the top: validator -> model.
plainLine(s, COLS[3] + BW / 2, TOP, COLS[3] + BW / 2, TOP - 0.2, SCAM);
plainLine(s, COLS[2] + BW / 2, TOP - 0.2, COLS[3] + BW / 2, TOP - 0.2, SCAM);
arrow(s, COLS[2] + BW / 2, TOP - 0.2, COLS[2] + BW / 2, TOP, SCAM);
arrowLabel(s, COLS[2] + BW / 2 - 0.6, TOP - 0.58, COLS[3] - COLS[2] + 1.2, 'rejected: reason + allowed actions go back', SCAM);
arrow(s, COLS[1] + BW / 2, TOP + BH, COLS[1] + BW / 2, BOT, SCAM);
arrowLabel(s, COLS[1] + BW / 2 + 0.05, TOP + BH + 0.2, 1.3, 'fails', SCAM);
arrow(s, COLS[3] + BW / 2, TOP + BH, COLS[3] + BW / 2, BOT);
arrowLabel(s, COLS[3] + BW / 2 + 0.05, TOP + BH + 0.2, 1.2, 'tool');
arrow(s, COLS[3], BOT + BH / 2, COLS[2] + BW, BOT + BH / 2);
arrow(s, COLS[2] + BW / 2, BOT, COLS[2] + BW / 2, TOP + BH);
arrowLabel(s, COLS[2] + BW / 2 - 1.35, TOP + BH + 0.2, 1.3, 'next step');
card(s, 0.6, 6.15, 12.1, 0.75, ORANGE_SOFT, ORANGE_LINE);
text(s, 'When the model chooses done, the validator sends it to the verdict gate (next slide). A tool failure is ' +
  'recorded and that tool is not offered again.', { x: 0.8, y: 6.2, w: 11.7, h: 0.65, fontSize: 16, valign: 'middle' });
s.addNotes('Walk through the loop: Python checks the input, then the model chooses ONE action as JSON. Python parses ' +
  'and validates it: is this action allowed now, does the argument come from the message. A rejection goes back to ' +
  'the model with the reason and the allowed actions. The tool runs locally and never opens links; a post-check ' +
  'verifies the state change. The result becomes evidence E1, E2 with a ledger and the NEXT OPTIONS list, and the ' +
  'model chooses again. The full diagram is in the project document.');

s = content('How it works', 'How it works (2/2): the verdict gate and the answer');
const GX = [0.6, 3.8, 7.0, 10.2];
const GY = 1.85;
const GBOT = 4.15;
legend(s, 1.25);
flowBox(s, GX[0], GY, BW, BH, MODEL_BOX, 'Model: done', 'label + evidence ids + explanation');
flowBox(s, GX[1], GY, BW, BH, PY_BOX, 'Verdict gate', 'does the recorded evidence support this label?');
flowBox(s, GX[2], GY, BW, BH, PY_BOX, 'Readability', 'verdict first, at most 6 short sentences, no jargon or links');
flowBox(s, GX[3], GY, BW, BH, IN_BOX, 'Final answer', 'verdict + explanation + "what to do" by Python + trace');
arrow(s, GX[0] + BW, GY + BH / 2, GX[1], GY + BH / 2);
arrow(s, GX[1] + BW, GY + BH / 2, GX[2], GY + BH / 2);
arrowLabel(s, GX[1] + BW - 0.1, GY + BH / 2 - 0.45, 0.9, 'passes', SAFE);
arrow(s, GX[2] + BW, GY + BH / 2, GX[3], GY + BH / 2);
arrowLabel(s, GX[2] + BW - 0.1, GY + BH / 2 - 0.45, 0.9, 'ok', SAFE);
flowBox(s, GX[0], GBOT, BW + 0.7, BH, RETRY_BOX, '1st rejection', 'feedback shows expected vs. actual; the model tries again');
flowBox(s, GX[1] + 0.9, GBOT, BW + 1.6, BH, STOP_BOX, '2nd rejection: Python decides',
  'uses the label the evidence supports (gate_downgrade), but never "safe" if the model was worried');
flowBox(s, GX[3] - 0.3, GBOT, BW + 0.3, BH, RETRY_BOX, 'Too hard to read', 'one rewrite, then Python\'s template');
arrow(s, GX[1] + 0.6, GY + BH, GX[0] + 1.6, GBOT, UNSURE);
arrow(s, GX[1] + 1.9, GY + BH, GX[1] + 2.4, GBOT, SCAM);
arrow(s, GX[2] + 1.9, GY + BH, GX[3] + 0.6, GBOT, UNSURE);
card(s, 0.6, 5.95, 12.1, 0.95, SAFE_TINT, SAFE);
text(s, [
  { text: 'Safe needs: ', options: { bold: true, color: SAFE } },
  { text: SAFE_RULE + '.' },
], { x: 0.8, y: 6.0, w: 11.7, h: 0.85, fontSize: 16, valign: 'middle' });
s.addNotes('When the model says done, the verdict gate checks the label against the recorded evidence, like ' +
  'check_goal in the Airways agent. A first rejection goes back to the model with expected versus actual. After a ' +
  'second rejection Python uses the label the evidence supports, but the model\'s concern can only make the answer ' +
  'more careful: if the model said scam or not sure, or asked for human help itself, the answer is never safe. Then the readability check, one ' +
  'rewrite, and the final answer with Python\'s what-to-do line.');

// ---------------------------------------------------------------- 5. Model vs Python
s = content('How it works', 'The model decides; Python checks every decision');
card(s, 0.6, 1.45, 5.9, 5.35, ORANGE_SOFT, ORANGE_DEEP);
card(s, 6.8, 1.45, 5.9, 5.35, SAND, SAND_LINE);
text(s, 'The model decides', { x: 0.9, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: ORANGE_TEXT });
text(s, 'Python checks', { x: 7.1, y: 1.65, w: 5.3, h: 0.5, fontSize: 24, bold: true, color: INK });
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
text(s, modelRuns, { x: 0.9, y: 2.35, w: 5.3, h: 4.25, fontSize: 20, paraSpaceAfter: 10 });
text(s, pythonRuns, { x: 7.1, y: 2.35, w: 5.3, h: 4.25, fontSize: 20, paraSpaceAfter: 10 });
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
  const y = 1.45 + row * 2.4;
  card(s, x, y, 3.85, 2.2, ORANGE_SOFT, ORANGE_LINE);
  text(s, tools[i][0], { x: x + 0.2, y: y + 0.18, w: 3.5, h: 0.45, fontSize: 18, bold: true, fontFace: MONO,
    color: ORANGE_TEXT });
  text(s, tools[i][1], { x: x + 0.2, y: y + 0.7, w: 3.5, h: 0.75, fontSize: 18 });
  text(s, 'When: ' + tools[i][2], { x: x + 0.2, y: y + 1.45, w: 3.5, h: 0.65, fontSize: 16, color: MUTED,
    italic: true });
}
text(s, [
  { text: 'done', options: { bold: true, fontFace: MONO, color: ORANGE_TEXT } },
  { text: ' (label + evidence ids + explanation) is not a tool: it goes to the verdict gate.' },
], { x: 0.6, y: 6.35, w: 12.1, h: 0.5, fontSize: 18 });
s.addNotes('Each tool is a local Python function. Python only offers the tools whose precondition holds right now: ' +
  'no links means no check_link; ask_human_helper only after the sender was checked. There is no fixed order beyond ' +
  'extract_signals first, so the model picks different tools for different messages.');

// ---------------------------------------------------------------- 7. Verdict gate
s = content('How it works', 'The verdict gate accepts only what the evidence supports');
const rules = [
  ['Likely scam', 'at least 1 strong or 2 weak warning signs', SCAM, 1.45, 0.45],
  ['Likely safe', SAFE_RULE, SAFE, 2.55, 1.6],
  ['Not sure', 'otherwise; never with a strong sign; help must be offered first', UNSURE, 4.5, 0.75],
];
for (let i = 0; i < rules.length; i++) {
  const y = rules[i][3];
  pill(s, 0.6, y, 2.4, 0.5, rules[i][2], rules[i][0], 18);
  text(s, rules[i][1], { x: 0.6, y: y + 0.6, w: 5.0, h: rules[i][4], fontSize: rules[i][1].length > 100 ? 16 : 18 });
}
card(s, 0.6, 5.9, 5.0, 0.9, SAND, SAND_LINE);
text(s, 'A rejection shows expected vs. actual. After 2 rejections Python uses the supported label.',
  { x: 0.8, y: 5.92, w: 4.6, h: 0.86, fontSize: 18, valign: 'middle' });
card(s, 5.9, 1.45, 6.8, 5.35, WHITE, ORANGE_LINE);
const g = D.gate_example;
if (g) {
  text(s, 'Real rejection (' + g.case + ' case, run ' + g.run + ', ' + g.mode + ')', { x: 6.15, y: 1.6, w: 6.3,
    h: 0.45, fontSize: 18, bold: true, color: ORANGE_TEXT });
  text(s, [
    { text: 'Model: ', options: { bold: true, color: ORANGE_TEXT } },
    { text: g.label + ', "' + short(g.explanation, 120) + '"' },
  ], { x: 6.15, y: 2.15, w: 6.3, h: 1.45, fontSize: 18 });
  let failed = g.failed.length ? g.failed[0] : '';
  text(s, [
    { text: 'Python: rejected. ', options: { bold: true, color: INK } },
    { text: short(failed, 190) },
  ], { x: 6.15, y: 3.65, w: 6.3, h: 1.45, fontSize: 18 });
  let after = g.next_action ? g.next_action : 'nothing';
  if (g.next_action === 'done' && g.next_argument) {
    after = 'done again: "' + short(g.next_argument.explanation, 95) + '"';
  }
  text(s, [
    { text: 'Next: ', options: { bold: true, color: ORANGE_TEXT } },
    { text: after },
  ], { x: 6.15, y: 5.15, w: 6.3, h: 1.0, fontSize: 18 });
  text(s, 'Ended: ' + g.final_label + ' (' + g.stop_reason + ')', { x: 6.15, y: 6.25, w: 6.3, h: 0.4,
    fontSize: 16, color: MUTED, italic: true });
} else {
  text(s, 'Gate rejection example pending', { x: 6.15, y: 2.0, w: 6.3, h: 0.8, fontSize: 20, color: ORANGE_TEXT });
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
  ['Rules miss it', 'Cash courier text from family (problem case)', 'Point at: no warning signs, the model worries, NOT SURE (honest: 1 of 6 saved runs said safe)'],
];
for (let i = 0; i < demo.length; i++) {
  const x = 0.6 + i * 2.46;
  card(s, x, 1.45, 2.3, 3.05, ORANGE_SOFT, ORANGE_LINE);
  numberCircle(s, x + 0.12, 1.6, i + 1);
  text(s, demo[i][0], { x: x + 0.8, y: 1.6, w: 1.45, h: 0.6, fontSize: 17, bold: true, color: INK, valign: 'middle' });
  text(s, demo[i][1], { x: x + 0.12, y: 2.3, w: 2.1, h: 0.65, fontSize: 15, bold: true });
  text(s, demo[i][2], { x: x + 0.12, y: 2.95, w: 2.1, h: 1.5, fontSize: 14, color: INK });
}
card(s, 0.6, 4.65, 12.1, 1.65, CODE_BG);
text(s, [
  { text: 'python3 scamshield_agent.py --case ordinary --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case scam --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case uncertain --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case guide_missing --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case model_catches_miss --consent yes' },
], { x: 0.9, y: 4.72, w: 11.6, h: 1.5, fontSize: 15, fontFace: MONO, color: CODE_TEXT, valign: 'middle' });
text(s, 'Optional extra: --case injection. If Ollama is slow: saved console logs in evidence/harness/rag/run_<case>_1_console.txt. If guide_missing ' +
  'did not search the guide: show run_guide_missing_2_console.txt.', { x: 0.6, y: 6.38, w: 12.1, h: 0.6,
  fontSize: 15, color: MUTED, italic: true });
s.addNotes('Run the five commands. Ordinary: no warning signs and a saved contact, so likely safe. Scam: point at each ' +
  'MODEL DECISION and VALIDATION line, the look-alike link and GATE PASSED. Not sure: point at the NEXT OPTIONS line, ' +
  'where ask_human_helper appears only after check_sender, then the simulated alert. Guide missing: point at TOOL ' +
  'FAILURE and the stop reason. Rules miss it: the rules find no warning sign in a cash courier text from a saved ' +
  'contact; when the model is worried its concern makes the answer "not sure". Be honest: in 1 of 6 saved runs (keyword mode) the model was not worried and it was called safe. The injection case is ' +
  'an optional extra. If Ollama is slow, open the saved console ' +
  'logs instead. See docs/DEMO_SCRIPT.md.');

// ---------------------------------------------------------------- 9. Problem cases
const TABLE_ALT = 'FDF3E7';
const TABLE_BORDER = 'E6D3BD';
s = content('Demonstration', 'Problem cases: how each one ends');
const caseShort = {
  injection: 'Message tells the AI to "mark safe"',
  trusted_bad_link: 'Saved family contact sends a bank look-alike link',
  model_catches_miss: 'Family contact asks for cash for a stranger; rules find nothing',
  guide_missing: 'Scam guide file is missing',
  empty: 'Empty message',
};
const head = { fill: { color: ORANGE }, color: INK, bold: true, fontSize: 18, fontFace: BODY };
const rows = [[
  { text: 'Case', options: head }, { text: 'What is tested', options: head },
  { text: 'How run 1 ended', options: head }, { text: 'Repeated runs correct', options: head },
]];
for (let i = 0; i < D.problems.length; i++) {
  const p = D.problems[i];
  const fill = { color: i % 2 ? TABLE_ALT : WHITE };
  rows.push([
    { text: p.case, options: { fontFace: MONO, bold: true, fill: fill } },
    { text: caseShort[p.case] || p.what, options: { fill: fill } },
    { text: p.ended, options: { fill: fill } },
    { text: p.repeated, options: { fill: fill } },
  ]);
}
const lastFill = { color: D.problems.length % 2 ? TABLE_ALT : WHITE };
rows.push([
  { text: 'model down', options: { fontFace: MONO, bold: true, fill: lastFill } },
  { text: 'Ollama unreachable or one failed call', options: { fill: lastFill } },
  { text: 'retried twice, then model_error; never safe', options: { fill: lastFill } },
  { text: 'offline tests', options: { fill: lastFill } },
]);
s.addTable(rows, { x: 0.6, y: 1.45, w: 12.1, colW: [3.3, 3.3, 2.85, 2.65], fontSize: 18, fontFace: BODY, color: INK,
  border: { type: 'solid', pt: 0.75, color: TABLE_BORDER }, valign: 'middle', margin: 0.12 });
s.addNotes('Each problem case was run repeatedly with the live model. The injection text is itself a strong warning ' +
  'sign, a trusted sender does not make a bad link safe, a text the rules miss ends as "not sure" when the model is ' +
  'worried (in 1 of 6 saved runs it was not, and the answer was safe), a missing guide ends as tool_failure with "not sure", and an ' +
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
  [D.tests, 'offline tests passed', INK],
  [E.correct, 'eval set correct (RAG)', SAFE],
  [D.live_false_safe, 'false "safe" in ' + D.live_runs + ' live runs', SCAM],
  [D.harness_total, 'repeated demo runs correct', SAFE],
  [D.holdout2_before + ' > ' + D.holdout2_after, 'held-out set 2, rules only (before > after)', ORANGE_TEXT],
];
for (let i = 0; i < stats.length; i++) {
  const x = 0.6 + i * 2.46;
  card(s, x, 1.45, 2.26, 1.9, ORANGE_SOFT, ORANGE_LINE);
  text(s, String(stats[i][0]), { x: x + 0.1, y: 1.52, w: 2.06, h: 0.85, fontSize: String(stats[i][0]).length > 8 ? 26 : 36, bold: true,
    color: stats[i][0] === 'pending' ? ORANGE_TEXT : stats[i][2], align: 'center', valign: 'middle' });
  text(s, stats[i][1], { x: x + 0.15, y: 2.4, w: 1.96, h: 0.9, fontSize: 16, color: INK, align: 'center' });
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
text(s, resultRuns, { x: 0.6, y: 3.55, w: 12.1, h: 2.75, fontSize: 18, paraSpaceAfter: 4 });
let wrongIds = [];
for (let i = 0; i < D.rules_after_wrong.length; i++) {
  wrongIds.push(D.rules_after_wrong[i].id);
}
for (let i = 0; i < D.holdout2_after_wrong.length; i++) {
  wrongIds.push(D.holdout2_after_wrong[i].id + ' (expected ' + D.holdout2_after_wrong[i].expected + ', rules say ' +
    D.holdout2_after_wrong[i].supported + ')');
}
text(s, 'Wrong answers on the labeled sets (none "safe"): ' + (D.live_wrong.length ? D.live_wrong.join('; ') : 'none') +
  '.   Rules only: ' + (wrongIds.length ? wrongIds.join('; ') : 'none'),
  { x: 0.6, y: 6.32, w: 12.1, h: 0.7, fontSize: 14, color: MUTED, italic: true });
s.addNotes('All numbers on this slide are read from the evidence files when the deck is built. The offline tests use ' +
  'a scripted model with deliberately wrong answers. Held-out set 2 was written and committed before the round-2 ' +
  'rule changes and was never edited; its before score is the honest one. Any value shown as "pending" was not ' +
  'available when the deck was built.');

// ---------------------------------------------------------------- 10b. Large blind test
const L = D.large || {};
const LR = L.rules;
const LA = L.agent;
s = content('Results', 'Large blind test: ' + L.messages + ' messages written without seeing the rules');

function scoreCard(slide, x, title, numbers, pendingNote) {
  const y = 1.45;
  const w = 3.75;
  const h = 2.75;
  if (!numbers) {
    card(slide, x, y, w, h, BG, ORANGE_DEEP, true);
    text(slide, title, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.45, fontSize: 18, bold: true });
    pill(slide, x + 0.3, y + 0.85, w - 0.6, 0.7, ORANGE_DEEP, 'LIVE RUN PENDING', 20, INK);
    text(slide, pendingNote, { x: x + 0.2, y: y + 1.7, w: w - 0.4, h: 0.95, fontSize: 16, color: ORANGE_TEXT,
      align: 'center' });
    return;
  }
  card(slide, x, y, w, h, ORANGE_SOFT, ORANGE_LINE);
  text(slide, title, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.45, fontSize: 18, bold: true });
  text(slide, [
    { text: numbers.score, options: { bold: true } },
    { text: '  ' + numbers.percent, options: { fontSize: 22, color: MUTED } },
  ], { x: x + 0.2, y: y + 0.6, w: w - 0.4, h: 0.75, fontSize: 36, valign: 'middle' });
  text(slide, '95% range: ' + numbers.range, { x: x + 0.2, y: y + 1.38, w: w - 0.4, h: 0.4, fontSize: 18,
    color: ORANGE_TEXT, bold: true });
  text(slide, [
    { text: 'False "safe": ' + numbers.false_safe, options: { breakLine: true, color: SCAM, bold: true } },
    { text: 'False alarms: ' + numbers.false_alarm },
  ], { x: x + 0.2, y: y + 1.85, w: w - 0.4, h: 0.8, fontSize: 18 });
}
scoreCard(s, 0.6, 'Rules only (no model)', LR, '');
scoreCard(s, 4.55, 'Live agent (model + gate)', LA, 'The slide fills in when the live run has finished.');

// confidence range picture: one bar per result on a shared percent axis
card(s, 0.6, 4.4, 7.7, 2.45, WHITE, SAND_LINE);
text(s, '95% confidence range for the score', { x: 0.85, y: 4.5, w: 7.2, h: 0.4, fontSize: 18, bold: true });
const AX0 = 2.85;
const AXW = 5.05;
const lows = [];
const highs = [];
[LR, LA].forEach(function (n) {
  if (n && n.ci) {
    lows.push(n.ci[0]);
    highs.push(n.ci[1]);
  }
});
const lo = lows.length ? Math.max(0, Math.floor(Math.min.apply(null, lows) * 10 - 0.5) / 10) : 0.5;
const hi = highs.length ? Math.min(1, Math.ceil(Math.max.apply(null, highs) * 10 + 0.5) / 10) : 1;
function px(v) {
  return AX0 + (v - lo) / (hi - lo) * AXW;
}
const rangeRows = [['Rules only', LR, ORANGE_DEEP], ['Live agent', LA, SAFE]];
for (let i = 0; i < rangeRows.length; i++) {
  const ry = 5.05 + i * 0.6;
  text(s, rangeRows[i][0], { x: 0.85, y: ry, w: 1.9, h: 0.45, fontSize: 16, valign: 'middle' });
  const n = rangeRows[i][1];
  if (n && n.ci) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px(n.ci[0]), y: ry + 0.1, w: Math.max(0.08, px(n.ci[1]) - px(n.ci[0])),
      h: 0.25, rectRadius: 0.12, fill: { color: rangeRows[i][2], transparency: 35 }, line: { color: rangeRows[i][2] } });
    s.addShape(pres.shapes.OVAL, { x: px(n.accuracy) - 0.09, y: ry + 0.135, w: 0.18, h: 0.18,
      fill: { color: INK }, line: { color: INK } });
  } else {
    text(s, 'pending', { x: AX0, y: ry, w: 2, h: 0.45, fontSize: 16, color: ORANGE_TEXT, italic: true, bold: true,
      valign: 'middle' });
  }
}
plainLine(s, AX0, 6.28, AX0 + AXW, 6.28, SAND_LINE);
const tickStep = (hi - lo) > 0.41 ? 0.1 : 0.05;
for (let v = lo; v <= hi + 1e-9; v += tickStep) {
  text(s, Math.round(v * 100) + '%', { x: px(v) - 0.4, y: 6.32, w: 0.8, h: 0.35, fontSize: 14, color: MUTED,
    align: 'center' });
}

// weakest categories
const cats = L.categories || [];
const catRows = [[
  { text: 'Weakest categories', options: head },
  { text: 'Rules', options: Object.assign({}, head, { align: 'center' }) },
  { text: 'Agent', options: Object.assign({}, head, { align: 'center' }) },
]];
for (let i = 0; i < cats.length; i++) {
  const fill = { color: i % 2 ? TABLE_ALT : WHITE };
  const name = String(cats[i].category).replace(/^(scam|safe|uncertain)_/, function (m, kind) {
    return { scam: 'scam: ', safe: 'safe: ', uncertain: 'not sure: ' }[kind];
  }).replace(/_/g, ' ');
  catRows.push([
    { text: name, options: { fill: fill } },
    { text: cats[i].rules, options: { fill: fill, align: 'center' } },
    { text: cats[i].agent, options: { fill: fill, align: 'center', color: cats[i].agent === 'pending' ? ORANGE_TEXT : INK,
      italic: cats[i].agent === 'pending' } },
  ]);
}
s.addTable(catRows, { x: 8.6, y: 1.45, w: 4.1, colW: [2.3, 0.9, 0.9], fontSize: 16, fontFace: BODY, color: INK,
  border: { type: 'solid', pt: 0.75, color: TABLE_BORDER }, valign: 'middle', margin: 0.06, rowH: 0.45 });
text(s, 'Lowest ' + (L.ranked_by === 'agent' ? 'live agent' : 'rules-only') + ' score first, of ' +
  L.category_count + ' categories.', { x: 8.6, y: 4.68, w: 4.1, h: 0.4, fontSize: 14, color: MUTED, italic: true });
card(s, 8.6, 5.2, 4.1, 1.65, ORANGE_SOFT, ORANGE_LINE);
text(s, 'The 95% range is where the true score very likely lies. More messages make it narrower: this set is ' +
  'big enough to compare the two scores fairly.', { x: 8.8, y: 5.28, w: 3.7, h: 1.5, fontSize: 16, valign: 'middle' });
const halfWidth = LR && LR.ci ? Math.round((LR.ci[1] - LR.ci[0]) * 50) : null;
s.addNotes('This set of ' + L.messages + ' fictional messages was written and frozen without looking at the rules, ' +
  'so it is the fairest test. A 95% confidence range says how far the true score could be from the measured one: ' +
  'with 50 messages, 80% correct could really be anywhere from ' + L.small_example + '; with ' + L.messages +
  ' messages the range is only about plus or minus ' + (halfWidth === null ? 'a few' : halfWidth) + ' points. ' +
  (LA ? 'The live agent scored ' + LA.score + ' (range ' + LA.range + ') against ' + (LR ? LR.score : 'pending') +
    ' for the rules alone.' : 'The live agent run was still going when this deck was built, so only the rules-only ' +
    'score is shown.') + ' The table lists the weakest message categories.');

// ---------------------------------------------------------------- 11. Learned
pres.addSection({ title: 'Conclusion' });
s = content('Conclusion', 'What I learned');
const learned = D.learned.slice(0, 5);
for (let i = 0; i < learned.length; i++) {
  const step = Math.min(1.35, 5.5 / Math.max(1, learned.length));
  const y = 1.25 + i * step;
  numberCircle(s, 0.6, y + 0.4, i + 1);
  text(s, learned[i].lesson, { x: 1.45, y: y, w: 11.2, h: 0.78, fontSize: 19, bold: true, valign: 'bottom' });
  text(s, 'DEVLOG: ' + learned[i].title, { x: 1.45, y: y + 0.82, w: 11.2, h: 0.35,
    fontSize: 16, color: MUTED });
}
s.addNotes('These lessons come from the development log findings. The most important: never trust the model\'s ' +
  'output shape or its verdict; make the checker say what it expected; and measure the innovation honestly.');

// ---------------------------------------------------------------- 12. Limitations
s = pres.addSlide({ masterName: 'SCAMSHIELD_HERO', sectionTitle: 'Conclusion' });
s.addText('Limitations and next steps', { placeholder: 'title' });
const limits = ['Same author wrote the rules, guide and test messages', 'Small local model: often too quick to say "safe"',
  'RAG gain is small on this data', 'Fictional English texts only; regex rules miss new tricks'];
const next = ['Test with real (anonymized) scam texts', 'Ask older adults whether the explanations help',
  'Larger website list and more look-alike tricks', 'Phone integration with a real, consented family alert'];
card(s, 0.7, 1.65, 5.8, 4.55, BG, ORANGE_DEEP);
card(s, 6.85, 1.65, 5.8, 4.55, BG, ORANGE_DEEP);
text(s, 'Limitations', { x: 1.0, y: 1.85, w: 5.2, h: 0.5, fontSize: 24, bold: true, color: SCAM });
text(s, 'Next steps', { x: 7.15, y: 1.85, w: 5.2, h: 0.5, fontSize: 24, bold: true, color: SAFE });
const limitRuns = [];
const nextRuns = [];
for (let i = 0; i < limits.length; i++) {
  limitRuns.push({ text: limits[i], options: { bullet: true, breakLine: i < limits.length - 1 } });
  nextRuns.push({ text: next[i], options: { bullet: true, breakLine: i < next.length - 1 } });
}
text(s, limitRuns, { x: 1.0, y: 2.5, w: 5.2, h: 3.5, fontSize: 20, color: INK, paraSpaceAfter: 12 });
text(s, nextRuns, { x: 7.15, y: 2.5, w: 5.2, h: 3.5, fontSize: 20, color: INK, paraSpaceAfter: 12 });
text(s, 'Thank you. Questions?   ' + D.repo, { x: 0.7, y: 6.45, w: 11.9, h: 0.5, fontSize: 20, bold: true, color: INK });
s.addNotes('Be honest about the limits: the evaluation data was written by me, the model is small, and the RAG gain ' +
  'is small. The safety comes from Python\'s evidence gate, not from the model. Next steps would be real data and ' +
  'feedback from older adults.');

pres.writeFile({ fileName: outPath }).then(function () {
  console.log('wrote ' + path.basename(outPath) + ' (' + pres.slides.length + ' slides)');
});
