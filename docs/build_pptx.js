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

// ================================================================ 9. Testing and results
pres.addSection({ title: 'Results' });
s = content('Results', 'Testing and results', 'Testing and results');
const S = D.sets || {};
const evalSet = S.eval || {};
const t2 = S.test2 || {};
const t3 = S.test3 || {};
const stats = [
  [isPending(D.tests_passed) ? PENDING : D.tests_passed + '/' + D.tests_total, 'offline tests pass (scripted model)', BLUE],
  [isPending(D.break_gate_failed) ? PENDING : String(D.break_gate_failed),
    'tests fail when the gate is broken on purpose', BLUE],
  [isPending(D.live_false_safe) ? PENDING : String(D.live_false_safe),
    'false "safe" answers in ' + (isPending(D.live_runs) ? 'all' : D.live_runs) + ' live runs', GREEN],
  [D.harness_total, 'repeated demo runs correct (' + D.harness_runs_per_case + ' per case)', GREEN],
];
for (let i = 0; i < stats.length; i++) {
  const x = LEFT + i * 3.08;
  foldedBox(s, x, 1.95, 2.85, 2.0, WHITE, SAGE, 0.34, 'stat');
  const pend = stats[i][0] === PENDING;
  T(s, stats[i][0], { x: x + 0.15, y: 2.05, w: 2.4, h: 0.85, fontSize: pend ? 26 : 40, bold: true,
    color: pend ? RUST : stats[i][2], valign: 'middle' });
  T(s, stats[i][1], { x: x + 0.15, y: 2.92, w: 2.55, h: 0.95, fontSize: 16, color: INK });
}
const lines = [
  [{ text: 'Test set 1 (' + (evalSet.messages || PENDING) + ' messages): ', options: { bold: true } },
    { text: 'live agent ' + evalSet.correct + ' correct, false "safe" ' + evalSet.false_safe }],
  [{ text: 'Test sets 2 and 3: ', options: { bold: true } },
    { text: 'live agent ' + t2.correct + ' and ' + t3.correct + ' correct. Written before rule fixes, then used ' +
      'to fix the rules, so no longer held out.' }],
];
const runsList = [];
lines.forEach(function (parts, i) {
  parts.forEach(function (part, j) {
    const options = Object.assign({}, part.options || {});
    if (j === 0) {
      options.bullet = { indent: 20 };
    }
    if (j === parts.length - 1 && i < lines.length - 1) {
      options.breakLine = true;
    }
    runsList.push({ text: part.text, options: options });
  });
});
T(s, runsList, { x: LEFT, y: 4.15, w: CONTENT_W, h: 1.35, fontSize: 18, color: INK, paraSpaceAfter: 8 });
const L = D.large || {};
const LR = L.rules;
const LA = L.agent;
foldedBox(s, LEFT, 5.6, CONTENT_W, 1.45, BLUE, null, 0.42, 'large test callout');
T(s, [
  { text: 'Large blind test set: ', options: { bold: true } },
  { text: L.messages + ' messages written by a separate AI agent that never saw the rules (frozen). ' },
  { text: 'Rules only: ' + (LR ? LR.score + ' (' + LR.percent + ', 95% range ' + LR.range + ')' : PENDING) + '. ',
    options: { bold: true } },
  { text: (LA ? 'Live agent: ' + LA.score + ' (' + LA.percent + ', 95% range ' + LA.range + ').' : 'Live run of all 614: not done (about 2 hours), future work.'),
    options: { bold: true } },
], { x: LEFT + 0.3, y: 5.7, w: CONTENT_W - 0.9, h: 1.25, fontSize: 18, color: WHITE, valign: 'middle' });
s.addNotes('Every number here is read from the saved evidence files when the deck is built. ' +
  'The offline tests use a scripted model that gives deliberately wrong answers: bad JSON, invented arguments, ' +
  '"safe" on a scam, injection, a missing guide, Ollama down. When I break the gate on purpose so it always says ' +
  'safe, ' + D.break_gate + ' tests fail, so the tests really check the gate. Over all live runs: ' + D.live_total +
  '. The demo cases were each run ' + D.harness_runs_per_case + ' times. Test sets 2 and 3 were written before ' +
  'rule fixes and then used to fix the rules, so I no longer call them held out. The large blind test set has ' +
  L.messages + ' messages written by a separate AI agent that never saw the rules; it is frozen. The 95% range ' +
  'says where the true score very likely lies. ' +
  (LA ? 'The live agent scored ' + LA.score + '.' : 'The live agent run on it was not finished when this deck was built.') +
  (D.live_wrong && D.live_wrong.length ? ' Wrong answers on the smaller sets: ' + D.live_wrong.join(', ') + '.' : ''));

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
