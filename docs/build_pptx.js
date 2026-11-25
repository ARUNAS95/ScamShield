// Builds docs/ScamShield_Presentation.pptx from docs/build/deck_data.json.
// The data file is written by docs/build_docs.py, which reads every result
// number from the evidence files, so no result is typed here.
//
// Usage (build_docs.py runs this for you):
//   node docs/build_pptx.js docs/build/deck_data.json docs/ScamShield_Presentation.pptx
//
// Design: the colors, font and shapes follow the student's slide template
// (its theme "theme3": cream background, green and blue as main colors,
// peach as the accent, Arial; a small breadcrumb line top left with the page
// number top right; boxes with a folded peach corner; green arrows between
// cards; full-color statement slides with a large corner triangle).

const fs = require('fs');
const path = require('path');
const pptxgen = require(path.join(__dirname, 'node_modules', 'pptxgenjs'));

const dataPath = process.argv[2];
const outPath = process.argv[3];
const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const PENDING = 'pending';

// ---- Colors taken from the template theme (ppt/theme/theme3.xml) ----
const GREEN = '137C3F';   // dk1: body text, breadcrumb, arrows
const CREAM = 'FFFCF5';   // lt1: slide background
const BLUE = '146AEB';    // dk2: titles, callout boxes
const PEACH = 'FBA084';   // lt2: folded corners, triangles, accent
const SAGE = 'B6D7A8';    // accent3 (template)
const SKY = 'A4C2F4';     // accent4 (template)
// ---- Derived from those (tints and dark shades for readable text) ----
const INK = '1E2A22';         // near-black green for long text and tables
const GREEN_TINT = 'E7F2EA';  // pale green card
const BLUE_TINT = 'E8F0FD';   // pale blue card
const PEACH_TINT = 'FEEDE5';  // pale peach card / table stripe
const RUST = 'B23E17';        // deep peach: "likely scam" and warnings (5.6:1 on cream)
const CODE_BG = '0E3B21';     // dark green code box
const WHITE = 'FFFFFF';
const FONT = 'Arial';
const MONO = 'Courier New';

// Verdict colors, the same meaning on every slide
const V_SCAM = RUST;
const V_SAFE = GREEN;
const V_UNSURE = BLUE;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';            // 13.333 x 7.5 in (the template's 10 x 5.625 scaled by 4/3)
pres.author = D.student;
pres.title = 'ScamShield';
pres.subject = 'CSYE 7374 Agentic AI mini-project';
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const W = 13.333;
const LEFT = 0.6;
const CONTENT_W = 12.13;

// Content slides: cream, blue title, page number top right.
pres.defineSlideMaster({
  title: 'SS_CONTENT',
  background: { color: CREAM },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: LEFT, y: 0.78, w: CONTENT_W, h: 0.9, fontFace: FONT,
      fontSize: 36, color: BLUE, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: 12.05, y: 0.27, w: 0.68, h: 0.36, fontFace: FONT, fontSize: 14, color: GREEN, align: 'right' },
});
// Full-bleed blue statement slide.
pres.defineSlideMaster({
  title: 'SS_BLUE',
  background: { color: BLUE },
  objects: [],
  slideNumber: { x: 12.05, y: 0.27, w: 0.68, h: 0.36, fontFace: FONT, fontSize: 14, color: INK, align: 'right' },
});
// Full-bleed peach slide (title and closing slides).
pres.defineSlideMaster({
  title: 'SS_PEACH',
  background: { color: PEACH },
  objects: [],
});

// ---------------------------------------------------------------- helpers

function T(slide, value, options) {
  slide.addText(value, Object.assign({ isTextBox: true, fontFace: FONT, color: INK, margin: 0, valign: 'top' }, options));
}

function crumb(slide, section, title, color) {
  T(slide, section, { x: LEFT, y: 0.27, w: 2.3, h: 0.36, fontSize: 14, color: color || GREEN, valign: 'middle' });
  T(slide, title, { x: 3.05, y: 0.27, w: 7.5, h: 0.36, fontSize: 14, color: color || GREEN, valign: 'middle' });
}

// A free shape from a list of [x, y] points (inches on the slide).
function poly(slide, points, color, name) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  points.forEach(function (p) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  });
  const pts = points.map(function (p) {
    return { x: p[0] - x0, y: p[1] - y0 };
  });
  pts.push({ close: true });
  slide.addShape(pres.shapes.CUSTOM_GEOMETRY, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, points: pts,
    fill: { color: color }, line: { color: color, width: 0 }, objectName: name || 'shape' });
}

// Template pixel coordinates (720 x 405 preview) to slide inches.
const K = W / 720;
function px(points) {
  return points.map(function (p) {
    return [p[0] * K, p[1] * K];
  });
}

// The template's box with a folded peach corner (top right).
function foldedBox(slide, x, y, w, h, fill, line, fold, name) {
  const c = fold || 0.42;
  const border = line ? { color: line, width: 1.5 } : { color: fill, width: 0 };
  slide.addShape(pres.shapes.CUSTOM_GEOMETRY, { x: x, y: y, w: w, h: h, objectName: name || 'card',
    points: [{ x: 0, y: 0 }, { x: w - c, y: 0 }, { x: w, y: c }, { x: w, y: h }, { x: 0, y: h }, { close: true }],
    fill: { color: fill }, line: border });
  slide.addShape(pres.shapes.CUSTOM_GEOMETRY, { x: x + w - c, y: y, w: c, h: c, objectName: 'fold',
    points: [{ x: 0, y: 0 }, { x: c, y: c }, { x: 0, y: c }, { close: true }],
    fill: { color: PEACH }, line: { color: PEACH, width: 0 } });
}

function arrowRight(slide, x, y, w, h) {
  slide.addShape(pres.shapes.RIGHT_ARROW, { x: x, y: y, w: w, h: h, fill: { color: GREEN }, line: { color: GREEN, width: 0 },
    objectName: 'arrow' });
}

function arrowDown(slide, x, y, w, h) {
  slide.addShape(pres.shapes.DOWN_ARROW, { x: x, y: y, w: w, h: h, fill: { color: GREEN }, line: { color: GREEN, width: 0 },
    objectName: 'arrow' });
}

function chip(slide, x, y, w, h, fill, label, size, color) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: w, h: h, rectRadius: h / 2, fill: { color: fill },
    line: { color: fill, width: 0 }, objectName: 'chip' });
  T(slide, label, { x: x, y: y, w: w, h: h, fontSize: size || 18, bold: true, color: color || WHITE, align: 'center',
    valign: 'middle' });
}

function line(slide, x1, y1, x2, y2, color, arrowEnd) {
  const options = { color: color || GREEN, width: 3 };
  if (arrowEnd) {
    options.endArrowType = 'triangle';
  }
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: options });
}

function short(value, limit) {
  value = String(value === undefined || value === null ? '' : value);
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit - 3).trim() + '...';
}

function isPending(value) {
  return value === undefined || value === null || value === PENDING;
}

function content(section, crumbTitle, title) {
  const slide = pres.addSlide({ masterName: 'SS_CONTENT', sectionTitle: section });
  crumb(slide, section, crumbTitle);
  slide.addText(title, { placeholder: 'title' });
  return slide;
}

const WORDS = { likely_scam: 'likely scam', likely_safe: 'likely safe', uncertain: 'not sure' };
const SAFE_RULE = 'a saved contact, no strong signs, at most 1 weak sign, every link checked and official, the ' +
  'official number looked up whenever the message gives a phone number for an organization it claims, and no tool failure';

// ================================================================ 1. Title
pres.addSection({ title: 'Introduction' });
let s = pres.addSlide({ masterName: 'SS_PEACH', sectionTitle: 'Introduction' });
poly(s, px([[20, 70], [195, 0], [712, 30], [697, 335], [522, 405], [20, 372]]), CREAM, 'cream sheet');
poly(s, px([[20, 70], [195, 0], [158, 115]]), GREEN, 'corner triangle');
poly(s, px([[697, 335], [522, 405], [565, 287]]), GREEN, 'corner triangle');
T(s, 'ScamShield', { x: 2.85, y: 1.95, w: 8.6, h: 1.25, fontSize: 64, color: BLUE, valign: 'middle' });
T(s, 'Plain-language scam warnings for older adults', { x: 2.85, y: 3.2, w: 8.6, h: 0.65, fontSize: 28,
  color: GREEN, valign: 'middle' });
T(s, [
  { text: D.student, options: { bold: true, breakLine: true } },
  { text: D.course },
], { x: 2.85, y: 4.25, w: 6.6, h: 1.0, fontSize: 20, color: GREEN, paraSpaceAfter: 4 });
s.addNotes('Hello, I am ' + D.student + '. My project is ScamShield. It checks one text message and tells an older ' +
  'adult, in plain words, whether it is likely a scam, likely safe, or not sure. A small local language model, ' +
  'qwen3:8b running in Ollama, acts as an agent that chooses its checks step by step, and Python checks every step. ' +
  'All messages are fictional, and it never opens links or contacts anyone.');

// ================================================================ 2. Problem (blue statement)
pres.addSection({ title: 'The problem' });
s = pres.addSlide({ masterName: 'SS_BLUE', sectionTitle: 'The problem' });
poly(s, px([[555, 0], [720, 0], [720, 95]]), CREAM, 'corner');
poly(s, px([[555, 0], [718, 95], [590, 130]]), PEACH, 'corner triangle');
crumb(s, 'The problem', 'Why ScamShield', WHITE);
T(s, 'Scam texts are built to rush older adults', { x: LEFT, y: 1.75, w: 9.6, h: 1.1, fontSize: 38, color: WHITE,
  valign: 'middle' });
function whiteList(slide, heading, items, x) {
  T(slide, heading, { x: x, y: 3.35, w: 5.7, h: 0.5, fontSize: 26, bold: true, color: CREAM });
  const runs = items.map(function (item, i) {
    return { text: item, options: { bullet: { indent: 22 }, breakLine: i < items.length - 1 } };
  });
  T(slide, runs, { x: x, y: 4.05, w: 5.9, h: 3.0, fontSize: 24, color: WHITE, paraSpaceAfter: 14 });
}
whiteList(s, 'What scam texts do', ['Pretend to be Medicare, the post office or a bank',
  'Rush you: "suspended today"', 'Ask for gift cards, codes or a tap on a fake link'], LEFT);
whiteList(s, 'What is missing', ['People hear "don\'t click", but not why',
  'A wrong "safe" is the most harmful mistake', 'An honest "not sure, ask someone" is better than a guess'], 6.95);
s.addNotes('The problem. Scam texts copy real organizations, rush people with threats, and ask for gift cards, ' +
  'codes or a click on a look-alike link. Older adults are targeted often. They are told "don\'t click links" but ' +
  'rarely why this particular message is suspicious. For them the worst mistake is a wrong "safe". So ScamShield ' +
  'explains the evidence in everyday words, and when it cannot tell, it says "not sure" and offers to alert a ' +
  'trusted family member.');

// ================================================================ 3. What it does
pres.addSection({ title: 'ScamShield' });
s = content('ScamShield', 'What it does', 'One message in, a plain answer out');
const ex = D.example;
foldedBox(s, LEFT, 1.95, 5.2, 3.45, WHITE, SAGE, 0.42, 'message card');
if (ex) {
  T(s, 'Text from ' + ex.message.sender + ' (not a saved contact)', { x: LEFT + 0.25, y: 2.15, w: 4.4, h: 0.6,
    fontSize: 16, bold: true, color: GREEN });
  T(s, '"' + ex.message.text + '"', { x: LEFT + 0.25, y: 2.8, w: 4.7, h: 2.45, fontSize: 20, color: INK });
} else {
  T(s, 'Example message pending', { x: LEFT + 0.25, y: 2.2, w: 4.7, h: 1, fontSize: 20, color: RUST });
}
arrowRight(s, 5.95, 3.35, 0.8, 0.6);
foldedBox(s, 6.9, 1.95, 5.83, 4.35, BLUE, null, 0.5, 'answer callout');
if (ex) {
  chip(s, 7.2, 2.2, 2.7, 0.58, CREAM, ex.final_label.toUpperCase(), 20, V_SCAM);
  T(s, short(ex.explanation, 300), { x: 7.2, y: 3.0, w: 5.25, h: 1.75, fontSize: 18, color: WHITE });
  T(s, [
    { text: 'What to do: ', options: { bold: true } },
    { text: short(ex.what_to_do, 200) },
  ], { x: 7.2, y: 4.6, w: 5.25, h: 1.5, fontSize: 18, color: WHITE });
} else {
  T(s, 'Example output pending', { x: 7.2, y: 2.4, w: 5.2, h: 1, fontSize: 20, color: WHITE });
}
T(s, 'Three possible answers', { x: LEFT, y: 5.6, w: 5.2, h: 0.4, fontSize: 16, bold: true, color: GREEN });
chip(s, LEFT, 6.05, 1.6, 0.5, V_SCAM, 'Likely scam', 16);
chip(s, LEFT + 1.75, 6.05, 1.6, 0.5, V_SAFE, 'Likely safe', 16);
chip(s, LEFT + 3.5, 6.05, 1.7, 0.5, V_UNSURE, 'Not sure', 16);
T(s, 'Real output from a saved live run. Python writes the "what to do" line and every phone number.',
  { x: LEFT, y: 6.85, w: CONTENT_W, h: 0.35, fontSize: 14, italic: true, color: GREEN });
s.addNotes('Input: one text message and the sender\'s number. Output: a verdict, a short explanation and a concrete ' +
  '"what to do" line. This is the real output for the Medicare gift-card text from a saved live run. The model wrote ' +
  'the explanation and Python checked it. The what-to-do line, with the real Medicare number from a trusted list, ' +
  'is always written by Python, so the model can never invent a phone number. The three possible answers are ' +
  'likely scam, likely safe, and not sure, which always comes with an offer of human help.');

// ================================================================ 4. How it works
pres.addSection({ title: 'How it works' });
s = content('How it works', 'The loop', 'How it works');
// legend in the title row
s.addShape(pres.shapes.RECTANGLE, { x: 8.15, y: 1.03, w: 0.36, h: 0.36, fill: { color: BLUE }, line: { color: BLUE, width: 0 } });
T(s, 'the model decides', { x: 8.65, y: 1.0, w: 2.0, h: 0.42, fontSize: 15, color: INK, valign: 'middle' });
s.addShape(pres.shapes.RECTANGLE, { x: 10.75, y: 1.03, w: 0.36, h: 0.36, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
T(s, 'Python checks', { x: 11.25, y: 1.0, w: 1.5, h: 0.42, fontSize: 15, color: INK, valign: 'middle' });

const CX = [0.65, 3.8, 6.95, 10.1];
const CW = 2.55;
const TOP_Y = 2.6;
const BOX_H = 1.45;
const BOT_Y = 4.85;
function flowCard(slide, x, y, w, kind, title, body) {
  const fill = kind === 'model' ? BLUE : kind === 'python' ? GREEN : WHITE;
  const textColor = kind === 'plain' ? INK : WHITE;
  if (kind === 'plain') {
    foldedBox(slide, x, y, w, BOX_H, WHITE, GREEN, 0.36, title);
  } else {
    slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: w, h: BOX_H, fill: { color: fill },
      line: { color: fill, width: 0 }, objectName: title });
  }
  T(slide, title, { x: x + 0.15, y: y + 0.15, w: w - 0.45, h: 0.45, fontSize: 19, bold: true, color: textColor });
  T(slide, body, { x: x + 0.15, y: y + 0.62, w: w - 0.3, h: BOX_H - 0.7, fontSize: 16, color: textColor });
}
flowCard(s, CX[0], TOP_Y, CW, 'model', 'Model chooses', 'ONE action as JSON: action + argument');
flowCard(s, CX[1], TOP_Y, CW, 'python', 'Python validates', 'allowed now? argument taken from the message?');
flowCard(s, CX[2], TOP_Y, CW, 'python', 'Tool runs', 'a local lookup; never opens a link');
flowCard(s, CX[3], TOP_Y, CW, 'plain', 'Evidence', 'E1, E2 ... recorded, plus the new list of allowed actions');
for (let i = 0; i < 3; i++) {
  arrowRight(s, CX[i] + CW + 0.08, TOP_Y + BOX_H / 2 - 0.2, 0.44, 0.4);
}
// evidence goes back to the model: a loop over the top
line(s, CX[3] + CW / 2, TOP_Y, CX[3] + CW / 2, 2.2);
line(s, CX[0] + CW / 2, 2.2, CX[3] + CW / 2, 2.2);
line(s, CX[0] + CW / 2, 2.2, CX[0] + CW / 2, TOP_Y, GREEN, true);
T(s, 'next decision: the model reads the evidence and chooses again', { x: 3.45, y: 2.0, w: 6.4, h: 0.4,
  fontSize: 15, bold: true, color: GREEN, align: 'center', valign: 'middle', fill: { color: CREAM } });
T(s, 'not allowed? the reason goes back to the model', { x: CX[1], y: TOP_Y + BOX_H + 0.08, w: 3.0, h: 0.6,
  fontSize: 14, italic: true, color: RUST });
// done path
arrowDown(s, CX[0] + CW / 2 - 0.2, TOP_Y + BOX_H + 0.08, 0.4, BOT_Y - TOP_Y - BOX_H - 0.16);
T(s, 'enough evidence', { x: CX[0] + CW / 2 + 0.3, y: TOP_Y + BOX_H + 0.25, w: 1.6, h: 0.4, fontSize: 14,
  italic: true, color: GREEN });
flowCard(s, CX[0], BOT_Y, CW, 'model', 'Model: done', 'label + evidence ids + explanation');
flowCard(s, CX[1], BOT_Y, CW, 'python', 'Verdict gate', 'does the recorded evidence support it?');
flowCard(s, CX[2], BOT_Y, CX[3] + CW - CX[2], 'plain', 'Answer',
  'verdict + plain explanation + "what to do" (written by Python) + a saved trace of every step');
arrowRight(s, CX[0] + CW + 0.08, BOT_Y + BOX_H / 2 - 0.2, 0.44, 0.4);
arrowRight(s, CX[1] + CW + 0.08, BOT_Y + BOX_H / 2 - 0.2, 0.44, 0.4);
T(s, 'Gate says no? The reason goes back. After 2 rejections, Python uses the supported label.',
  { x: LEFT, y: 6.5, w: CONTENT_W, h: 0.6, fontSize: 18, color: INK, valign: 'middle' });
s.addNotes('This is the whole loop. The model chooses ONE action at a time as JSON. Python validates it: is this ' +
  'action allowed right now, and does the argument come from the message? If not, the reason goes back to the ' +
  'model. The tool runs locally and never opens a link. The result is recorded as evidence with an id, and the ' +
  'model gets the evidence and the new list of allowed actions, so the next decision depends on what was found. ' +
  'When the model has enough evidence it says done with a label, evidence ids and an explanation. The verdict gate ' +
  'checks that label against the recorded evidence. After two rejections Python uses the label the evidence supports. ' +
  'The answer gets a what-to-do line written by Python, and every step is saved in a trace.');

// ================================================================ 5. Tools
s = content('How it works', 'The tools', 'Six tools the model can choose from');
const tools = [
  ['extract_signals', 'Finds warning signs, links, phone numbers and the claimed organization', 'first, only once'],
  ['check_link', 'Looks the link up in a list of official and scam websites. Never opens it', 'a link in the message is unchecked'],
  ['check_sender', 'Is the sender a saved contact?', 'the real sender, only once'],
  ['lookup_official_contact', 'The real phone number from a trusted list', 'the message claims an organization'],
  ['search_scam_guide', 'Metadata search over the scam guide: keyword scoring plus metadata rules', 'up to 3 times'],
  ['ask_human_helper', 'Simulated alert to a family member, only with consent', 'after check_sender, once'],
];
for (let i = 0; i < tools.length; i++) {
  const x = LEFT + (i % 3) * 4.14;
  const y = 1.95 + Math.floor(i / 3) * 2.35;
  foldedBox(s, x, y, 3.85, 2.15, WHITE, SAGE, 0.38, tools[i][0]);
  T(s, tools[i][0], { x: x + 0.2, y: y + 0.2, w: 3.3, h: 0.4, fontSize: 16, bold: true, fontFace: MONO, color: BLUE });
  T(s, tools[i][1], { x: x + 0.2, y: y + 0.65, w: 3.5, h: 0.9, fontSize: 17, color: INK });
  T(s, 'Offered: ' + tools[i][2], { x: x + 0.2, y: y + 1.58, w: 3.5, h: 0.45, fontSize: 15, italic: true, color: GREEN,
    valign: 'bottom' });
}
T(s, [
  { text: 'done', options: { bold: true, fontFace: MONO, color: BLUE } },
  { text: ' (label + evidence ids + explanation) is not a tool: the verdict gate checks it.' },
], { x: LEFT, y: 6.65, w: CONTENT_W, h: 0.45, fontSize: 18, valign: 'middle' });
s.addNotes('Each tool is a small local Python function. Python offers a tool only when it makes sense right now: no ' +
  'link means no check_link, the official-number lookup only appears when the message claims an organization, and ' +
  'ask_human_helper only after the sender was checked. Apart from extract_signals going first there is no fixed ' +
  'order, so the model picks different tools for different messages. The guide search is a metadata search over a ' +
  'small scam-prevention guide: keyword scoring plus rules that use the warning signs already found.');

// ================================================================ 6. Verdict gate
s = content('How it works', 'The verdict gate', 'The verdict gate: only what the evidence supports');
const gateRules = [
  ['Likely scam', V_SCAM, 'at least 1 strong warning sign, or at least 2 weak ones', 1.95, 0.65],
  ['Likely safe', V_SAFE, SAFE_RULE, 3.25, 1.75],
  ['Not sure', V_UNSURE, 'anything else; never when a strong sign was found; human help offered first', 5.5, 0.9],
];
for (let i = 0; i < gateRules.length; i++) {
  const r = gateRules[i];
  chip(s, LEFT, r[3], 2.0, 0.48, r[1], r[0], 17);
  T(s, r[2], { x: LEFT, y: r[3] + 0.56, w: 6.25, h: r[4], fontSize: 18, color: INK });
}
const g = D.gate_example;
foldedBox(s, 7.2, 1.95, 5.53, 3.3, WHITE, SAGE, 0.42, 'rejection example');
if (g) {
  T(s, 'A real rejection (' + g.case + ' case, run ' + g.run + ')', { x: 7.45, y: 2.12, w: 4.6, h: 0.4,
    fontSize: 16, bold: true, color: GREEN });
  const asked = g.helper_offered_by === 'model' ? 'The model asked for human help, then said: ' : 'The model said: ';
  T(s, [
    { text: asked },
    { text: String(g.label), options: { bold: true, fontFace: MONO } },
  ], { x: 7.45, y: 2.6, w: 5.05, h: 0.65, fontSize: 18, color: INK });
  const reason = String(g.key_failure || '').split(': ').slice(1).join(': ') || g.key_failure;
  T(s, [
    { text: 'Python: rejected. ', options: { bold: true, color: RUST } },
    { text: '"' + short(reason, 120) + '"' },
  ], { x: 7.45, y: 3.3, w: 5.05, h: 1.15, fontSize: 18, color: INK });
  let after = 'the model chose ' + (g.next_action || 'nothing');
  if (g.next_action === 'done' && g.next_argument) {
    after = 'the model answered ' + (WORDS[g.next_argument.label] || g.next_argument.label);
  }
  T(s, [
    { text: 'Next: ', options: { bold: true, color: GREEN } },
    { text: after + '; the run ended ' + (WORDS[g.final_label] || g.final_label) + '.' },
  ], { x: 7.45, y: 4.5, w: 5.05, h: 0.6, fontSize: 18, color: INK });
} else {
  T(s, 'Gate rejection example pending', { x: 7.45, y: 2.3, w: 5, h: 0.8, fontSize: 20, color: RUST });
}
foldedBox(s, 7.2, 5.45, 5.53, 1.6, BLUE, null, 0.42, 'key rule callout');
T(s, 'A worried model can only make the answer more careful, never "safe".', { x: 7.45, y: 5.6, w: 4.75, h: 1.3,
  fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
s.addNotes('When the model says done, Python works out which label the recorded evidence supports, like check_goal ' +
  'in the Airways class agent. Scam needs at least one strong or two weak warning signs. Safe needs everything on ' +
  'this list. Anything else is not sure, which needs an offer of human help first. Cited evidence ids must exist and ' +
  'the explanation must mention every strong sign. On the right is a real rejection from a saved run: the model had ' +
  'asked for human help and then said safe; the gate rejected it with the reason, and the model answered not sure. ' +
  'That is the key rule: once the model is worried, Python never turns that into safe.');

// ================================================================ 7. Demo plan
pres.addSection({ title: 'Demo' });
s = content('Demo', 'Live demo plan', 'Live demo: four runs');
const demo = [
  ['Ordinary', 'likely safe', V_SAFE, 'saved pharmacy; no warning signs'],
  ['Scam', 'likely scam', V_SCAM, 'tools chosen, look-alike link, gate passed'],
  ['Uncertain', 'not sure + help', V_UNSURE, 'ask_human_helper appears after check_sender'],
  ['Guide missing', 'not sure', V_UNSURE, 'TOOL FAILURE shown; the answer is never safe'],
];
for (let i = 0; i < demo.length; i++) {
  const x = LEFT + i * 3.15;
  foldedBox(s, x, 1.95, 2.65, 2.4, WHITE, SAGE, 0.36, demo[i][0]);
  T(s, (i + 1) + ' ' + demo[i][0], { x: x + 0.18, y: 2.1, w: 2.15, h: 0.45, fontSize: 18, bold: true, color: BLUE });
  chip(s, x + 0.18, 2.65, 2.3, 0.46, demo[i][2], demo[i][1], 16);
  T(s, demo[i][3], { x: x + 0.18, y: 3.25, w: 2.32, h: 1.0, fontSize: 16, color: INK });
  if (i < demo.length - 1) {
    arrowRight(s, x + 2.7, 2.95, 0.42, 0.4);
  }
}
s.addShape(pres.shapes.RECTANGLE, { x: LEFT, y: 4.6, w: CONTENT_W, h: 1.75, fill: { color: CODE_BG },
  line: { color: CODE_BG, width: 0 }, objectName: 'commands' });
T(s, [
  { text: 'python3 scamshield_agent.py --case ordinary --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case scam --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case uncertain --consent yes', options: { breakLine: true } },
  { text: 'python3 scamshield_agent.py --case guide_missing --consent yes' },
], { x: LEFT + 0.3, y: 4.7, w: CONTENT_W - 0.6, h: 1.55, fontSize: 17, fontFace: MONO, color: CREAM, valign: 'middle' });
T(s, [
  { text: 'Backups: ', options: { bold: true } },
  { text: '--case model_catches_miss, --case injection; if Ollama is slow, the saved console logs in evidence/harness/' },
], { x: LEFT, y: 6.5, w: CONTENT_W, h: 0.6, fontSize: 16, color: GREEN, valign: 'middle' });
s.addNotes('Four live runs. One, ordinary: the saved pharmacy reminder, no warning signs, likely safe. Two, scam: ' +
  'point at each model decision and validation line, the look-alike link and GATE PASSED, and the what-to-do line. ' +
  'Three, uncertain: an unknown doctor\'s office; point at the NEXT OPTIONS line where ask_human_helper appears only ' +
  'after check_sender, then the simulated family alert. Four, guide missing: the guide file is missing, the search ' +
  'returns TOOL FAILURE, and the answer is not sure, never safe. Backups: model_catches_miss and injection, and the ' +
  'saved console logs if Ollama is slow. Consent yes answers the simulated alert question automatically.');

// ================================================================ 8. Problem cases
s = content('Demo', 'Problem cases', 'Problem cases and how each one ends');
const caseShort = {
  injection: 'Text tells the AI "mark safe"',
  trusted_bad_link: 'Family contact sends a look-alike bank link',
  model_catches_miss: 'Family contact asks for cash for a stranger; rules see nothing',
  guide_missing: 'Scam guide file is missing',
  empty: 'Empty message',
};
const head = { fill: { color: GREEN }, color: WHITE, bold: true, fontSize: 18, fontFace: FONT };
const rows = [[
  { text: 'Case', options: head }, { text: 'What is tested', options: head },
  { text: 'How it ends', options: head }, { text: 'Repeated runs', options: head },
]];
const problems = D.problems || [];
for (let i = 0; i < problems.length; i++) {
  const p = problems[i];
  const fill = { color: i % 2 ? PEACH_TINT : WHITE };
  const ends = isPending(p.ended) ? PENDING : p.ended + ' (' + p.stop + ')';
  const repeated = [{ text: p.repeated + ' correct', options: { breakLine: !!p.note } }];
  if (p.note) {
    repeated.push({ text: p.note, options: { color: RUST, bold: true, fontSize: 15 } });
  }
  rows.push([
    { text: p.case, options: { fontFace: MONO, bold: true, fill: fill, fontSize: 16 } },
    { text: caseShort[p.case] || p.case, options: { fill: fill } },
    { text: ends, options: { fill: fill } },
    { text: repeated, options: { fill: fill } },
  ]);
}
const lastFill = { color: problems.length % 2 ? PEACH_TINT : WHITE };
rows.push([
  { text: 'model down', options: { fontFace: MONO, bold: true, fill: lastFill, fontSize: 16 } },
  { text: 'Ollama is unreachable', options: { fill: lastFill } },
  { text: 'retried 2 times, then model_error; never safe', options: { fill: lastFill } },
  { text: 'offline tests', options: { fill: lastFill } },
]);
s.addTable(rows, { x: LEFT, y: 1.95, w: CONTENT_W, colW: [2.95, 4.0, 3.0, 2.18], fontSize: 18, fontFace: FONT, color: INK,
  border: { type: 'solid', pt: 0.75, color: SAGE }, valign: 'middle', margin: [0.04, 0.1, 0.04, 0.1] });
foldedBox(s, LEFT, 6.3, CONTENT_W, 0.8, BLUE, null, 0.32, 'rule callout');
T(s, 'After a tool failure, invalid input or a model error, the answer can never be "safe".', { x: LEFT + 0.3, y: 6.3,
  w: CONTENT_W - 0.9, h: 0.8, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
const mcm = problems.filter(function (p) { return p.case === 'model_catches_miss'; })[0];
s.addNotes('Each problem case was run repeatedly with the live model. Injection: the hidden instruction is itself a ' +
  'strong warning sign, so only scam passes the gate. Trusted sender with a bad link: a saved contact does not make ' +
  'a look-alike link safe. model_catches_miss: the rules find no warning sign in a cash-courier request from a ' +
  'saved contact, so only the model\'s worry can make it not sure. Be honest here: ' +
  (mcm && mcm.note ? 'it ' + mcm.note + '. ' : 'when the model is not worried, the answer is safe. ') +
  'Guide missing: the search fails, that tool is not offered again, and the answer is not sure, never safe. Empty ' +
  'input stops before the model is called. If Ollama is down, the call is retried twice and the run stops with ' +
  'model_error, which the offline tests cover.');

// ================================================================ 9. How we tested
pres.addSection({ title: 'Results' });
s = content('Results', 'How we tested', 'How we tested ScamShield');
const S = D.sets || {};
const evalSet = S.eval || {};
const t2 = S.test2 || {};
const t3 = S.test3 || {};
const L = D.large || {};
const LR = L.rules;
const LA = L.agent;
const counts = L.counts || {};
function val(value) {
  return isPending(value) ? PENDING : String(value);
}
// harness cases that ended "safe" when they should not have (the false "safe" answers)
const hc = D.harness_cases || {};
const falseSafeCases = Object.keys(hc).filter(function (c) {
  return hc[c].safe > 0 && hc[c].expected !== 'likely_safe';
});
const failCaseWords = falseSafeCases.length === 1 ? 'one hard case (' + falseSafeCases[0] + ')' :
  (falseSafeCases.length ? falseSafeCases.join(', ') : 'none');
const COL_NUM = LEFT + 0.25;
const COL_IS = 3.95;
const COL_PROVES = 8.4;
const W_IS = 4.2;
const W_PROVES = 3.95;
T(s, 'WHAT IT IS', { x: COL_IS, y: 1.78, w: W_IS, h: 0.32, fontSize: 14, bold: true, color: BLUE, charSpacing: 1 });
T(s, 'WHAT IT PROVES', { x: COL_PROVES, y: 1.78, w: W_PROVES, h: 0.32, fontSize: 14, bold: true, color: GREEN,
  charSpacing: 1 });
const layers = [
  { n: '1', name: 'Offline tests', big: isPending(D.tests_passed) ? PENDING : D.tests_passed + '/' + D.tests_total + ' pass',
    color: BLUE, h: 1.12,
    is: [{ text: 'Checks that run without the AI. A fake model sends answers I wrote in advance, some wrong on ' +
      'purpose, like insisting a scam is safe.' }],
    proves: [{ text: 'Python catches the model\'s bad answers.' }] },
  { n: '2', name: 'Break the gate on purpose',
    big: isPending(D.break_gate_failed) ? PENDING : D.break_gate_failed + ' of ' + D.break_gate_total + ' fail',
    color: BLUE, h: 1.0,
    is: [{ text: 'I swapped the safety gate for one that calls every message safe, then ran the same tests again.' }],
    proves: [{ text: 'The tests notice when the safety check breaks, so they test something real.' }] },
  { n: '3', name: 'Live runs, real model', big: isPending(D.live_core_runs) ? PENDING : D.live_core_runs + ' runs',
    sub: isPending(D.live_core_false_safe) ? '' : D.live_core_false_safe + ' false "safe"', color: GREEN, h: 1.36,
    is: [
      { text: 'The real AI (qwen3:8b) checks each message. ' },
      { text: 'Test set 1: ' + val(evalSet.correct) + ' correct', options: { bold: true } },
      { text: ', ' + val(evalSet.false_safe).split(' of ')[0] + ' false "safe". ' },
      { text: 'Demo cases: ' + val(D.harness_total) + ' correct', options: { bold: true } },
      { text: ' (each run ' + val(D.harness_runs_per_case) + ' times).' },
    ],
    proves: [{ text: 'The whole agent works end to end. The ' + val(D.live_core_false_safe) + ' false "safe" answers ' +
      'all come from ' + failCaseWords + '.' }] },
  { n: '4', name: 'Large blind test', big: val(L.messages) + ' messages', color: GREEN, h: 1.0,
    is: [{ text: 'Messages written by a separate AI that never saw our rules. Frozen before testing.' }],
    proves: [{ text: 'How ScamShield copes with wording it was never tuned for. ' },
      { text: 'Results on the next slide.', options: { bold: true, color: BLUE } }] },
];
let rowY = 2.14;
layers.forEach(function (r) {
  foldedBox(s, LEFT, rowY, CONTENT_W, r.h, WHITE, SAGE, 0.3, 'layer ' + r.n);
  T(s, r.n + '  ' + r.name, { x: COL_NUM, y: rowY + 0.1, w: 3.0, h: 0.32, fontSize: 15, bold: true, color: GREEN });
  const pend = r.big === PENDING;
  T(s, r.big, { x: COL_NUM, y: rowY + 0.42, w: 3.0, h: 0.5, fontSize: pend ? 20 : 28, bold: true,
    color: pend ? RUST : r.color, valign: 'middle' });
  if (r.sub) {
    T(s, r.sub, { x: COL_NUM, y: rowY + 0.92, w: 3.0, h: 0.32, fontSize: 16, bold: true, color: RUST });
  }
  T(s, r.is, { x: COL_IS, y: rowY + 0.12, w: W_IS, h: r.h - 0.22, fontSize: 16, color: INK, valign: 'middle' });
  T(s, r.proves, { x: COL_PROVES, y: rowY + 0.12, w: W_PROVES, h: r.h - 0.22, fontSize: 16, color: INK,
    valign: 'middle' });
  rowY += r.h + 0.1;
});
T(s, 'Test sets 2 and 3 don\'t count as fair tests: I used them to fix the rules (live agent ' +
  val(t2.correct) + ' and ' + val(t3.correct) + '). Their runs are in the ' + val(D.live_core_runs) + ' live runs.',
{ x: LEFT, y: rowY + 0.02, w: CONTENT_W, h: 0.34, fontSize: 14, italic: true, color: GREEN, valign: 'middle' });
s.addNotes('I tested ScamShield in four ways, and every number here comes straight from the saved result files. ' +
  'First, the offline tests: ' + val(D.tests) + ' pass. They run without the AI. A fake model sends answers I wrote ' +
  'in advance, and many are wrong on purpose: broken JSON, made-up arguments, "safe" on a scam, an injection, a ' +
  'missing guide, Ollama being down. Passing means Python catches all of those. ' +
  'Second, I broke the gate on purpose. I swapped it for one that calls every message safe and ran the same tests, ' +
  'and ' + val(D.break_gate) + ' of them failed. That is what I wanted to see: the tests notice when the safety check ' +
  'breaks. ' +
  'Third, live runs with the real model, qwen3:8b. On test set 1 it got ' + val(evalSet.correct) + ' right with ' +
  val(evalSet.false_safe) + ' false "safe" answers, and I ran each demo case ' + val(D.harness_runs_per_case) +
  ' times: ' + val(D.harness_total) + ' correct. Counting test sets 2 and 3, that is ' + val(D.live_core_runs) +
  ' live runs with ' + val(D.live_core_false_safe) + ' false "safe" answers, all from ' + failCaseWords + ', where ' +
  'neither the rules nor the model noticed anything wrong. ' +
  'I do not count test sets 2 and 3 as fair tests, because I used them to fix the rules. ' +
  'Fourth, the big blind test with ' + val(L.messages) + ' messages. That is the next slide.');

// ================================================================ 10. Blind test
s = content('Results', 'Blind test', 'Blind test: ' + val(L.messages) + ' messages it had never seen');
// left column: what blind means, the mix of messages, the hardest message types
const LCW = 3.75;
foldedBox(s, LEFT, 1.9, LCW, 2.45, BLUE, null, 0.4, 'what blind means');
T(s, 'What "blind" means', { x: LEFT + 0.22, y: 2.02, w: LCW - 0.75, h: 0.4, fontSize: 18, bold: true, color: CREAM });
T(s, [
  { text: 'A separate AI wrote them without ever seeing our rules.',
    options: { bullet: { indent: 16 }, breakLine: true } },
  { text: 'We froze the set before testing and never changed it to get a better score.',
    options: { bullet: { indent: 16 } } },
], { x: LEFT + 0.22, y: 2.5, w: LCW - 0.4, h: 1.75, fontSize: 16, color: WHITE, paraSpaceAfter: 8 });
const mix = [[counts.scam, 'scams', V_SCAM], [counts.safe, 'safe', V_SAFE], [counts.uncertain, 'not sure', V_UNSURE]];
mix.forEach(function (m, i) {
  const x = LEFT + i * 1.27;
  s.addShape(pres.shapes.RECTANGLE, { x: x, y: 4.5, w: 1.17, h: 0.95, fill: { color: WHITE },
    line: { color: m[2], width: 1.5 }, objectName: 'mix ' + m[1] });
  T(s, val(m[0]), { x: x, y: 4.55, w: 1.17, h: 0.5, fontSize: 24, bold: true, color: m[2], align: 'center',
    valign: 'middle' });
  T(s, m[1], { x: x, y: 5.03, w: 1.17, h: 0.34, fontSize: 14, color: INK, align: 'center', valign: 'middle' });
});
foldedBox(s, LEFT, 5.6, LCW, 1.55, WHITE, SAGE, 0.32, 'weakest');
T(s, 'Hardest types' + (L.weakest_by === 'agent' ? ' (full agent)' : ' (rules alone)'),
  { x: LEFT + 0.2, y: 5.68, w: LCW - 0.55, h: 0.34, fontSize: 15, bold: true, color: GREEN });
const weakRuns = (L.weakest || []).map(function (wk, i) {
  const score = L.weakest_by === 'agent' ? wk.agent : wk.rules;
  return { text: wk.name + ': ' + score, options: { breakLine: i < L.weakest.length - 1 } };
});
T(s, weakRuns.length ? weakRuns : PENDING, { x: LEFT + 0.2, y: 6.04, w: LCW - 0.3, h: 1.05, fontSize: 16, color: INK,
  paraSpaceAfter: 2 });

// right column: rules alone vs full agent
const RX = 4.65;
const PW = 3.95;
const PGAP = 0.18;
function shortRange(ci) {
  return ci ? Math.round(ci[0] * 100) + '–' + Math.round(ci[1] * 100) + '%' : PENDING;
}
function panel(x, kind, title, sub, result) {
  const dark = kind === 'agent';
  const fg = dark ? WHITE : INK;
  foldedBox(s, x, 1.9, PW, 2.8, dark ? BLUE : WHITE, dark ? null : SAGE, 0.4, title);
  T(s, title, { x: x + 0.22, y: 2.02, w: PW - 0.7, h: 0.4, fontSize: 20, bold: true, color: dark ? CREAM : BLUE });
  T(s, sub, { x: x + 0.22, y: 2.42, w: PW - 0.5, h: 0.3, fontSize: 14, color: dark ? WHITE : GREEN });
  if (!result) {
    T(s, 'Live run in progress', { x: x + 0.22, y: 2.95, w: PW - 0.44, h: 0.6, fontSize: 26, bold: true, color: CREAM });
    T(s, 'One live run per message takes about 2 hours. This slide is rebuilt from the results when it finishes.',
      { x: x + 0.22, y: 3.6, w: PW - 0.44, h: 0.95, fontSize: 16, color: WHITE });
    return;
  }
  T(s, result.percent, { x: x + 0.22, y: 2.8, w: 1.75, h: 0.85, fontSize: 48, bold: true,
    color: dark ? CREAM : BLUE, valign: 'middle' });
  T(s, result.score.replace('/', ' of ') + ' correct', { x: x + 1.95, y: 2.8, w: PW - 2.1, h: 0.85, fontSize: 16,
    color: fg, valign: 'middle' });
  const cells = [
    [shortRange(result.ci), '95% range'],
    [result.false_safe.split(' of ')[0], 'false "safe" of ' + result.false_safe.split(' of ')[1]],
    [result.false_alarm.split(' of ')[0], 'false alarms of ' + result.false_alarm.split(' of ')[1]],
  ];
  cells.forEach(function (c, i) {
    const cx = x + 0.22 + i * 1.2;
    T(s, c[0], { x: cx, y: 3.78, w: 1.18, h: 0.4, fontSize: 20, bold: true, color: i === 1 ? (dark ? CREAM : RUST) : fg });
    T(s, c[1], { x: cx, y: 4.18, w: 1.12, h: 0.5, fontSize: 14, color: fg });
  });
}
panel(RX, 'rules', 'Rules alone', 'Python\'s warning-sign rules, no AI', LR);
panel(RX + PW + PGAP, 'agent', 'Full agent', 'AI (qwen3:8b) + Python checks', LA);

// range bars: where the true accuracy very likely lies
const bars = [
  ['Rules alone (' + val(L.messages) + ')', LR ? LR.ci : null, LR ? LR.range : PENDING, GREEN],
  ['Full agent (' + val(L.messages) + ')', LA ? LA.ci : null, LA ? LA.range : 'in progress', BLUE],
  ['Test set 1 (' + val(evalSet.messages) + ')', evalSet.ci || null, val(evalSet.range), SKY],
];
let low = 1;
bars.forEach(function (b) {
  if (b[1]) {
    low = Math.min(low, b[1][0]);
  }
});
const AX0 = Math.max(0, Math.floor((low * 100 - 2) / 10) * 10);
const TRACK_X = 8.0;
const TRACK_W = 4.5;
function ax(percent) {
  return TRACK_X + (percent - AX0) / (100 - AX0) * TRACK_W;
}
T(s, '95% range: where the true accuracy very likely lies', { x: RX, y: 4.85, w: 8.0, h: 0.32, fontSize: 15,
  bold: true, color: GREEN });
bars.forEach(function (b, i) {
  const y = 5.22 + i * 0.36;
  T(s, [{ text: b[0] + ': ', options: { bold: true } }, { text: b[2].replace(' to ', '–') }],
    { x: RX, y: y, w: 3.3, h: 0.3, fontSize: 14, color: INK, valign: 'middle' });
  s.addShape(pres.shapes.RECTANGLE, { x: TRACK_X, y: y + 0.13, w: TRACK_W, h: 0.04, fill: { color: SAGE },
    line: { color: SAGE, width: 0 }, objectName: 'track' });
  if (b[1]) {
    const x0 = ax(b[1][0] * 100);
    const x1 = ax(b[1][1] * 100);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0, y: y + 0.03, w: Math.max(0.08, x1 - x0), h: 0.24,
      rectRadius: 0.12, fill: { color: b[3] }, line: { color: b[3], width: 0 }, objectName: 'range ' + b[0] });
  }
});
for (let t = AX0; t <= 100; t += 10) {
  T(s, t + '%', { x: ax(t) - 0.35, y: 6.3, w: 0.7, h: 0.26, fontSize: 14, color: GREEN, align: 'center' });
}
const halves = [LR, LA].filter(function (r) { return r && r.ci; }).map(function (r) {
  return (r.ci[1] - r.ci[0]) * 50;
});
const half = halves.length ? Math.round(Math.max.apply(null, halves)) : null;
const CMP = L.compare;
const takeaway = (CMP && LA) ?
  'The agent called only ' + LA.false_safe.split(' of ')[0] + ' scams "safe" (rules alone: ' +
  CMP.rules_false_safe + '). When it gets one wrong, it usually says "not sure" and sends you to a person.' :
  'With ' + val(L.messages) + ' messages the true accuracy is very likely within ±' + (half === null ? '?' : half) +
  ' points.';
T(s, takeaway, { x: RX, y: 6.62, w: 8.08, h: 0.55, fontSize: 16, bold: true, color: BLUE, valign: 'middle' });
s.addNotes('This is the fairest test we have. A separate AI wrote these ' + val(L.messages) + ' messages without ' +
  'ever seeing my rules, my code or my other test sets, and I froze the set before testing, so I never changed it to ' +
  'get a better score. There are ' + val(counts.scam) + ' scams, ' + val(counts.safe) + ' safe messages and ' +
  val(counts.uncertain) + ' where the honest answer is "not sure". ' +
  (LR ? 'With no AI at all, the rules get ' + LR.score + ' right, ' + LR.percent + '. But they call ' +
    LR.false_safe.split(' of ')[0] + ' scams "safe", which is the mistake that hurts an older adult most. ' : '') +
  (LA ? 'The full agent gets ' + LA.score + ', ' + LA.percent + ', so slightly lower, but it calls only ' +
    LA.false_safe.split(' of ')[0] + ' scams "safe". ' : 'The full agent run takes about two hours and was still ' +
    'running when this deck was built. ') +
  (CMP ? 'Of the ' + CMP.rules_false_safe + ' messages the rules got dangerously wrong, the agent turned ' +
    CMP.agent_avoided + ' into "not sure". That is the trade: of its ' + CMP.misses + ' mistakes, ' +
    CMP.misses_unsure + ' are "not sure", which means "ask someone you trust" rather than a wrong answer. In ' +
    CMP.gate_stricter + ' of them the model actually said the right thing, but the gate could not find a strong ' +
    'warning sign in the evidence, so it played it safe. ' : '') +
  'The two scams it still called safe both came from saved contacts: one asked Mom to read out a bank code, the other ' +
  'was a fake bank courier coming to collect her card and PIN. I did not fix those after seeing them, because then ' +
  'this would no longer be a blind test. ' +
  'The 95% range is where the true accuracy very likely lies. With ' + val(L.messages) + ' messages it is about ' +
  'plus or minus ' + val(half) + ' points. With the ' + val(evalSet.messages) + ' messages of test set 1 it is ' +
  val(evalSet.range) + ', so a perfect score there says much less. The hardest message types are bottom left.');

// ================================================================ 10. What I learned
pres.addSection({ title: 'Wrap-up' });
s = content('Wrap-up', 'What I learned', 'What I learned');
const learned = (D.learned || []).slice(0, 4);
for (let i = 0; i < learned.length; i++) {
  const x = LEFT + (i % 2) * 6.17;
  const y = 1.95 + Math.floor(i / 2) * 2.55;
  foldedBox(s, x, y, 5.96, 2.3, WHITE, SAGE, 0.4, 'lesson');
  T(s, String(i + 1), { x: x + 0.2, y: y + 0.18, w: 0.6, h: 0.7, fontSize: 36, bold: true, color: BLUE });
  T(s, learned[i].lesson, { x: x + 0.9, y: y + 0.25, w: 4.6, h: 1.35, fontSize: 19, bold: true, color: INK });
  T(s, 'DEVLOG finding ' + learned[i].number + ': ' + learned[i].title, { x: x + 0.9, y: y + 1.65, w: 4.85,
    h: 0.5, fontSize: 15, italic: true, color: GREEN });
}
if (!learned.length) {
  T(s, 'Lessons pending (DEVLOG findings not found)', { x: LEFT, y: 2.2, w: 8, h: 0.6, fontSize: 20, color: RUST });
}
s.addNotes('These come from the findings in my development log. The model invented tool arguments, so Python keeps ' +
  'only the keys a tool declares. The model counted notes like "not a saved contact" as warning signs until the ' +
  'tool said plainly they are not. A rejection that does not say what was expected makes the model guess again. ' +
  'And the model\'s instinct on unknown senders was "safe"; the evidence gate is what kept every answer safe. The ' +
  'main lesson: good answers come from Python checking the model, not from trusting it.');

// ================================================================ 11. Limitations (peach statement)
s = pres.addSlide({ masterName: 'SS_PEACH', sectionTitle: 'Wrap-up' });
poly(s, px([[40, 92], [190, 38], [692, 64], [678, 330], [528, 388], [28, 362]]), CREAM, 'cream sheet');
poly(s, px([[40, 92], [190, 38], [158, 140]]), GREEN, 'corner triangle');
poly(s, px([[678, 330], [528, 388], [562, 288]]), GREEN, 'corner triangle');
T(s, 'Limitations and next steps', { x: 3.65, y: 1.3, w: 8.6, h: 0.8, fontSize: 34, color: BLUE, valign: 'middle' });
function creamList(slide, heading, color, items, x, w) {
  T(slide, heading, { x: x, y: 2.55, w: w, h: 0.45, fontSize: 22, bold: true, color: color });
  const runs = items.map(function (item, i) {
    return { text: item, options: { bullet: { indent: 20 }, breakLine: i < items.length - 1 } };
  });
  T(slide, runs, { x: x, y: 3.1, w: w, h: 2.2, fontSize: 18, color: INK, paraSpaceAfter: 8 });
}
creamList(s, 'Limitations', RUST, ['I wrote the rules, the guide, the evaluation set and test sets 2 and 3',
  'Small local model: often too quick to say "safe"', 'Fictional English texts only; regex rules miss new tricks'],
1.0, 5.4);
creamList(s, 'Next steps', GREEN, ['Test on real, anonymized scam texts', 'Ask older adults if the explanations help',
  'More look-alike tricks, a bigger website list'], 6.75, 5.0);
T(s, 'Thank you. Questions?', { x: 1.0, y: 5.75, w: 6.5, h: 0.6, fontSize: 26, bold: true, color: BLUE, valign: 'middle' });
s.addNotes('Limitations. I wrote the rules, the guide and the smaller test sets myself, which is why the large blind ' +
  'set was written separately. The local model is small and often too quick to say safe; the gate catches that, ' +
  'but it costs steps. The messages are fictional and in English, and regex rules miss new tricks. Next steps: real ' +
  'anonymized scam texts, asking older adults whether the explanations help, and more look-alike tricks. Thank you; ' +
  'I am happy to take questions.');

pres.writeFile({ fileName: outPath }).then(function () {
  console.log('wrote ' + path.basename(outPath) + ' (' + pres.slides.length + ' slides)');
});
