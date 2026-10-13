#!/usr/bin/env node
// Renders every spoken line in a week file to a small m4a clip using the Mac's
// built-in British English voice, so every phone hears the same thing.
// Usage: node scripts/build-audio.mjs weeks/2026-10-12.json
// Needs macOS (`say`, `afconvert`). Skips clips that already exist.
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const VOICE = "Daniel";
const file = process.argv[2];
if (!file) { console.error("usage: build-audio.mjs <week.json>"); process.exit(2); }
const week = JSON.parse(readFileSync(file, "utf8"));
mkdirSync("audio", { recursive: true });

// Text -> filename slug, same function as in the page.
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const lines = new Set();
const add = t => { if (t && t.trim()) lines.add(t.trim()); };

// Fixed phrases the page uses for feedback
[
  "Which row is a pattern?",
  "Match the letter to a picture that starts with that sound.",
  "Which one rhymes with this?",
  "Say each sound. Tap next when you are ready. No timer.",
  "Well done.",
  "Not that one. Listen again.",
  "Try again.",
  "That is the one.",
  "All done. Well played.",
  "Say the word, then tap the picture.",
  "Say the new word, then tap the letter that changed.",
  "Say the word, then tap the tricky part."
].forEach(add);

const p = week.phonics;
for (const d of Object.values(p.days)) {
  add(d.game.say);
  const g = d.game;
  if (g.type === "hunt") g.items.forEach(i => add(i.word));
  if (g.type === "blendpick") g.words.forEach(w => { add(w.word); w.distractors.forEach(x => add(x.word)); });
  if (g.type === "ladder") g.words.forEach(add);
  if (g.type === "tricky") g.words.forEach(add);
}
for (const d of Object.values(p.days)) {
  const s = d.stretch; if (!s) continue;
  add(s.say);
  if (s.type === "segment") s.words.forEach(w => add(w.word));
  if (s.type === "alien") s.items.forEach(i => add(i.word));
  if (s.type === "caption") s.items.forEach(i => { add(i.text); i.options.forEach(o => add(o.say)); });
  if (s.type === "mark") s.words.forEach(add);
}
["Real word.", "Alien word.", "Listen again."].forEach(add);
(p.memory || []).forEach(m => add(m.word));
(p.rhymes || []).forEach(r => { add(r.target.word); r.options.forEach(o => add(o.word)); });
p.tricky.forEach(t => add(t.word));

// Maths: each question read aloud from its tiles
const tileName = t => (t === "?" ? "something" : t);
for (const d of Object.values(week.maths.days)) {
  for (const block of [d.check, d.stretch]) {
    add(block.say);
    block.questions.forEach(q => {
      if (q.kind === "which") return;
      const spoken = q.pattern.map(tileName).join(", ");
      const tail = q.kind === "next" ? "What comes next?" : q.kind === "missing" ? "Which piece is missing?" : "Which row is the same?";
      add(`${spoken}. ${tail}`);
    });
  }
}


let made = 0, kept = 0;
const manifest = {};
for (const text of lines) {
  const name = slug(text);
  const out = `audio/${name}.m4a`;
  manifest[text] = name;
  if (existsSync(out)) { kept++; continue; }
  const aiff = `audio/${name}.aiff`;
  execFileSync("say", ["-v", VOICE, "-r", "150", "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "40000", aiff, out]);
  unlinkSync(aiff);
  made++;
}
writeFileSync("audio/manifest.json", JSON.stringify(manifest, null, 1));
console.log(`audio: ${made} rendered, ${kept} already present, ${lines.size} total`);
