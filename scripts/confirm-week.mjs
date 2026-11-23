#!/usr/bin/env node
// Flips a week from "expected" to "confirmed" once the school update arrives, in every place
// it is recorded, and lists what school taught that the page did not cover that week.
// Usage: node scripts/confirm-week.mjs 2026-11-16 --focus "z zz qu ch" --tricky "go, no, to, into" --updated 2026-11-20 [--dry]
// Tricky words need an entry (trickyLetters, note) in the week file or term.json first.
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2), date = args[0];
const opt = k => { const i = args.indexOf("--" + k); return i < 0 ? null : args[i + 1]; };
const dry = args.includes("--dry");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) { console.error('usage: confirm-week.mjs <YYYY-MM-DD> --focus "z zz qu ch" [--tricky "go, no"] [--updated YYYY-MM-DD] [--dry]'); process.exit(2); }
const rd = f => JSON.parse(readFileSync(f, "utf8"));
const wr = (f, o) => { if (!dry) writeFileSync(f, JSON.stringify(o, null, 2) + "\n"); };
const file = `weeks/${date}.json`, W = rd(file), ix = rd("weeks/index.json"), term = rd("term.json");
const focus = (opt("focus") || W.phonics.focus.join(" ")).split(/\s+/).filter(Boolean);
const tricky = (opt("tricky") || "").split(/[,\s]+/).filter(Boolean);
const gaps = [], problems = [];

// what the page actually practised that week
const daySounds = new Set(Object.values(W.phonics.days).map(d => d.sound).filter(Boolean));
const practised = new Set(Object.values(W.phonics.days).flatMap(d => d.game.type === "tricky" ? d.game.words : []));
focus.forEach(g => { if (!daySounds.has(g)) gaps.push(`sound ${g}: no day practised it`); });
tricky.forEach(w => { if (!practised.has(w)) gaps.push(`tricky word ${w}: not in that week's tricky game`); });
focus.forEach(g => { if (!term.graphemes.some(x => x.g === g)) problems.push(`${g} is not in term.json graphemes (and needs a STROKES guide in index.html)`); });
Object.values(W.phonics.days).forEach(d => { if (d.sound && !focus.includes(d.sound) && !W.phonics.taught.includes(d.sound)) gaps.push(`the page ran ${d.sound} on ${d.name}, which school did not teach: rebuild that day`); });

// tricky words: keep the ones already there, add the new ones, drop expected ones school did not name
const have = w => W.phonics.tricky.find(t => t.word === w) || term.tricky.find(t => t.word === w);
const add = [];
tricky.forEach(w => { const t = have(w); if (!t) problems.push(`tricky word ${w} has no entry: add { word, trickyLetters, note } to term.json first`); else { const { expected, ...rest } = t; add.push(rest); } });
if (problems.length) { problems.forEach(p => console.error("error:", p)); process.exit(1); }
const dropped = W.phonics.tricky.filter(t => t.expected && !tricky.includes(t.word)).map(t => t.word);
W.phonics.tricky = W.phonics.tricky.filter(t => !t.expected || tricky.includes(t.word)).map(({ expected, ...rest }) => rest);
add.forEach(t => { const i = W.phonics.tricky.findIndex(x => x.word === t.word); if (i < 0) W.phonics.tricky.push(t); });
add.forEach(t => { if (!term.tricky.some(x => x.word === t.word)) term.tricky.push(t); });
if (dropped.length) gaps.push(`expected tricky words school did not name: ${dropped.join(", ")} (removed from the list; check Friday's game and steps)`);

W.status = "confirmed"; delete W.expectedFrom; if (opt("updated")) W.updated = opt("updated");
W.phonics.focus = focus;
const now = W.journey.find(j => j.state === "now");
if (now) { const tail = now.graphemes.replace(/ \(expected\)/, "").split(", ").slice(1); now.graphemes = [focus.join(" "), ...tail].join(", "); if (tricky.length) now.tricky = tricky.join(", "); }
const e = ix.weeks.find(w => w.weekOf === date);
if (!e) { console.error(`error: ${date} is not in weeks/index.json`); process.exit(1); }
Object.assign(e, { focus, status: "confirmed", tricky: tricky.length ? tricky.join(", ") : e.tricky });

wr(file, W); wr("weeks/index.json", ix); wr("term.json", term);
if (ix.current === date) wr("weeks/current.json", W);
console.log(`${dry ? "dry run: would confirm" : "confirmed"} ${date}: ${focus.join(" ")}${tricky.length ? "; tricky " + tricky.join(", ") : ""}`);
console.log(gaps.length ? "Not covered at home that week (plan the catch-up):\n" + gaps.map(g => "  - " + g).join("\n") : "Home and school were in step: nothing to catch up.");
console.log("Still by hand: school.thisWeekPhonics and school.standing wording in the week file.");
