#!/usr/bin/env node
// Downloads the OpenMoji picture for every word in pictures.json into pictures/.
// Usage: node scripts/build-pictures.mjs   (skips files already present)
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const map = JSON.parse(readFileSync("pictures.json", "utf8"));
mkdirSync("pictures", { recursive: true });
let made = 0, kept = 0;
for (const [word, code] of Object.entries(map)) {
  const out = `pictures/${word}.svg`;
  if (existsSync(out)) { kept++; continue; }
  const url = `https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg/${code}.svg`;
  const r = await fetch(url);
  if (!r.ok) { console.error(`missing: ${word} (${code}) ${r.status}`); process.exitCode = 1; continue; }
  writeFileSync(out, await r.text());
  made++;
}
console.log(`pictures: ${made} downloaded, ${kept} already present`);
