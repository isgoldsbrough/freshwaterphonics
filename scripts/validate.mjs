#!/usr/bin/env node
// Validates a week file: every word shown in print must be decodable with the
// graphemes taught so far, all five days exist, every game is well formed.
// Usage: node scripts/validate.mjs weeks/2026-10-12.json
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: validate.mjs <week.json>"); process.exit(2); }
const week = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const warn = [];
const PICS = JSON.parse(readFileSync("pictures.json", "utf8"));
const needPic = (w, where) => { if (!(w in PICS)) errors.push(`${where}: no picture for "${w}" in pictures.json`); };

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const taught = new Set([...week.phonics.taught, ...week.phonics.focus]);
const graphemes = [...taught].sort((a, b) => b.length - a.length);

// Greedy longest-match segmentation against the taught set.
function segment(word) {
  const out = [];
  let i = 0;
  const w = word.toLowerCase();
  while (i < w.length) {
    const g = graphemes.find(g => w.startsWith(g, i));
    if (!g) return null;
    out.push(g);
    i += g.length;
  }
  return out;
}

// Phase 2 print rule: only taught graphemes, one vowel, no adjacent consonants.
function checkPrintWord(word, where) {
  const segs = segment(word);
  if (!segs) { errors.push(`${where}: "${word}" uses a sound not yet taught`); return; }
  const vowels = segs.filter(s => VOWELS.has(s)).length;
  if (vowels !== 1) { errors.push(`${where}: "${word}" has ${vowels} vowel sounds; Phase 2 print words have one`); return; }
  for (let i = 1; i < segs.length; i++) {
    if (!VOWELS.has(segs[i]) && !VOWELS.has(segs[i - 1])) {
      errors.push(`${where}: "${word}" has adjacent consonants (${segs[i - 1]}${segs[i]}); not before Phase 4`);
      return;
    }
  }
}

const days = week.phonics.days || {};
for (const n of ["1", "2", "3", "4", "5"]) {
  const d = days[n];
  if (!d) { errors.push(`phonics day ${n} missing`); continue; }
  if (!Array.isArray(d.steps) || d.steps.length < 3) errors.push(`phonics day ${n}: fewer than 3 steps`);
  const g = d.game;
  if (!g) { errors.push(`phonics day ${n}: no game`); continue; }
  const where = `phonics day ${n} (${g.type})`;
  if (g.type === "hunt") {
    const targets = g.items.filter(i => i.match).length;
    if (g.items.length < 4 || targets < 2) errors.push(`${where}: needs at least 4 items and 2 targets`);
    g.items.forEach(i => needPic(i.pic || i.word, where));
    // hunt words are spoken, not printed: no decodability check
  } else if (g.type === "blendpick") {
    for (const w of g.words) {
      checkPrintWord(w.word, where);
      if (w.segments.join("") !== w.word) errors.push(`${where}: segments for "${w.word}" do not spell it`);
      for (const s of w.segments) if (!taught.has(s)) errors.push(`${where}: segment "${s}" in "${w.word}" not taught`);
      if (!w.distractors || w.distractors.length < 2) errors.push(`${where}: "${w.word}" needs 2 distractors`);
      needPic(w.pic || w.word, where); (w.distractors || []).forEach(d => needPic(d.pic || d.word, where));
    }
  } else if (g.type === "ladder") {
    g.words.forEach(w => checkPrintWord(w, where));
    for (let i = 1; i < g.words.length; i++) {
      const a = segment(g.words[i - 1]), b = segment(g.words[i]);
      if (!a || !b || a.length !== b.length) { errors.push(`${where}: "${g.words[i - 1]}" to "${g.words[i]}" changes length`); continue; }
      const diff = a.filter((s, k) => s !== b[k]).length;
      if (diff !== 1) errors.push(`${where}: "${g.words[i - 1]}" to "${g.words[i]}" changes ${diff} letters, not 1`);
    }
  } else if (g.type === "tricky") {
    const known = new Set(week.phonics.tricky.map(t => t.word));
    g.words.forEach(w => { if (!known.has(w)) errors.push(`${where}: "${w}" is not in phonics.tricky`); });
  } else {
    errors.push(`${where}: unknown game type`);
  }
}

// Stretch games: same print rule, same sounds, harder skill
const trickySet = new Set(week.phonics.tricky.map(t => t.word));
for (const n of ["1", "2", "3", "4", "5"]) {
  const s = days[n] && days[n].stretch;
  if (!s) { errors.push(`phonics day ${n}: no stretch`); continue; }
  const where = `phonics day ${n} stretch (${s.type})`;
  if (s.type === "segment") {
    for (const w of s.words) {
      checkPrintWord(w.word, where);
      if (w.segments.join("") !== w.word) errors.push(`${where}: segments for "${w.word}" do not spell it`);
      if (new Set(w.segments).size !== w.segments.length) errors.push(`${where}: "${w.word}" repeats a sound; the bank cannot handle that`);
      needPic(w.pic || w.word, where);
    }
  } else if (s.type === "alien") {
    s.items.forEach(it => checkPrintWord(it.word, where));
    if (s.items.filter(i => i.real).length < 2 || s.items.filter(i => !i.real).length < 2) errors.push(`${where}: needs at least 2 real and 2 alien`);
  } else if (s.type === "caption") {
    for (const it of s.items) {
      it.text.split(/\s+/).forEach(wd => { if (!trickySet.has(wd)) checkPrintWord(wd, `${where} "${it.text}"`); });
      if (it.options.length < 3 || it.correct == null || it.correct >= it.options.length) errors.push(`${where}: "${it.text}" needs 3 options and a correct index`);
      it.options.forEach(o => { if (!o.pics || !o.say) errors.push(`${where}: "${it.text}" option needs pics and say`); (o.pics || []).forEach(pw => needPic(pw, where)); });
    }
  } else if (s.type === "mark") {
    s.words.forEach(wd => checkPrintWord(wd, where));
    if (s.words.length < 6) errors.push(`${where}: fewer than 6 words`);
  } else {
    errors.push(`${where}: unknown stretch type`);
  }
}

// Memory pairs: grapheme to a word starting with it (first-sound rule), word printed
for (const p of week.phonics.memory || []) {
  if (!taught.has(p.grapheme)) errors.push(`memory: grapheme "${p.grapheme}" not taught`);
  if (!p.word.startsWith(p.grapheme)) errors.push(`memory: "${p.word}" does not start with "${p.grapheme}"`);
  checkPrintWord(p.word, "memory");
  needPic(p.pic || p.word, "memory");
}

// Rhyme picker: words are spoken with pictures, not printed; check rhymes agree and distractors don't rhyme
const rime = w => w.replace(/^[^aeiou]+/, "");
for (const r of week.phonics.rhymes || []) {
  const right = r.options.filter(o => o.right);
  if (right.length !== 1) errors.push(`rhymes: "${r.target.word}" needs exactly one right answer`);
  needPic(r.target.pic || r.target.word, "rhymes");
  for (const o of r.options) {
    needPic(o.pic || o.word, "rhymes");
    const same = rime(o.word) === rime(r.target.word);
    if (o.right && !same) warn.push(`rhymes: "${o.word}" may not rhyme with "${r.target.word}"`);
    if (!o.right && same) errors.push(`rhymes: distractor "${o.word}" rhymes with "${r.target.word}"`);
  }
}

// Maths
const mdays = week.maths.days || {};
for (const n of ["1", "2", "3", "4", "5"]) {
  const d = mdays[n];
  if (!d) { errors.push(`maths day ${n} missing`); continue; }
  for (const [label, block] of [["check", d.check], ["stretch", d.stretch]]) {
    if (!block) { errors.push(`maths day ${n}: no ${label}`); continue; }
    block.questions.forEach((q, i) => {
      const where = `maths day ${n} ${label} q${i + 1}`;
      if (q.options.length < 2) errors.push(`${where}: fewer than 2 options`);
      if (q.correct == null || q.correct >= q.options.length) errors.push(`${where}: bad correct index`);
      const all = [...(q.pattern || []), ...q.options.flat()];
      all.forEach(t => { if (t !== "?") needPic(t, where); });
      if (q.kind !== "which" && !q.pattern) errors.push(`${where}: ${q.kind} needs a pattern`);
      if (q.kind === "missing" && !q.pattern.includes("?")) errors.push(`${where}: missing needs a "?" in the pattern`);
      if (q.kind === "next" && q.options.some(o => o.length !== 1)) errors.push(`${where}: next options are single tiles`);
    });
  }
}

// Tricky words have their tricky letters in range
for (const t of week.phonics.tricky) {
  t.trickyLetters.forEach(i => { if (i >= t.word.length) errors.push(`tricky: "${t.word}" index ${i} out of range`); });
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(week.weekOf)) errors.push("weekOf must be YYYY-MM-DD");
if (new Date(week.weekOf).getDay() !== 1) warn.push("weekOf is not a Monday");
if (!["confirmed", "expected"].includes(week.status)) errors.push("status must be confirmed or expected");

warn.forEach(w => console.warn("warning:", w));
if (errors.length) {
  errors.forEach(e => console.error("error:", e));
  console.error(`${errors.length} error(s) in ${file}`);
  process.exit(1);
}
console.log(`${file}: ok (${warn.length} warning(s))`);

// ---- term.json: the half-term and archive bank ----
try {
  const term = JSON.parse(readFileSync("term.json", "utf8"));
  const termErrors = [];
  const tg = term.graphemes.map(x => x.g);
  const all = new Set(tg);
  const allSorted = [...all].sort((a, b) => b.length - a.length);
  const seg = w => { const out = []; let i = 0; while (i < w.length) { const g = allSorted.find(g => w.startsWith(g, i)); if (!g) return null; out.push(g); i += g.length; } return out; };
  for (const [w, segs] of Object.entries(term.words)) {
    if (segs.join("") !== w) termErrors.push(`term words: "${w}" segments do not spell it`);
    segs.forEach(s => { if (!all.has(s)) termErrors.push(`term words: "${w}" uses untaught "${s}"`); });
    const v = segs.filter(s => VOWELS.has(s)).length; if (v !== 1) termErrors.push(`term words: "${w}" has ${v} vowels`);
    for (let i = 1; i < segs.length; i++) if (!VOWELS.has(segs[i]) && !VOWELS.has(segs[i - 1])) termErrors.push(`term words: "${w}" has adjacent consonants`);
    if (!(w in PICS)) termErrors.push(`term words: no picture for "${w}"`);
  }
  for (const [g, list] of Object.entries(term.oral)) {
    if (!all.has(g)) termErrors.push(`term oral: unknown grapheme "${g}"`);
    if (list.length < 3) termErrors.push(`term oral: "${g}" needs 3 words`);
    list.forEach(w => { if (!(w in PICS)) termErrors.push(`term oral: no picture for "${w}"`); if (!w.includes(g)) termErrors.push(`term oral: "${w}" does not contain "${g}"`); });
    const blendable = Object.entries(term.words).filter(([w, s]) => s.includes(g)).length;
    if (blendable < 2) termErrors.push(`term words: fewer than 2 blendable words contain "${g}" (${blendable})`);
  }
  term.maths.questions.forEach((q, i) => {
    const where = `term maths q${i + 1}`;
    if (q.correct == null || q.correct >= q.options.length) termErrors.push(`${where}: bad correct index`);
    [...(q.pattern || []), ...q.options.flat()].forEach(t => { if (t !== "?" && !(t in PICS)) termErrors.push(`${where}: no picture for "${t}"`); });
    if (q.kind === "which" && !q.say) termErrors.push(`${where}: which needs a say line`);
  });
  if (termErrors.length) { termErrors.forEach(e => console.error("error:", e)); console.error(`${termErrors.length} error(s) in term.json`); process.exit(1); }
  console.log("term.json: ok");
} catch (e) { if (e.code !== "ENOENT") throw e; }
