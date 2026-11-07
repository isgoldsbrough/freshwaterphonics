#!/usr/bin/env node
// Whole-site check, run at the end of every weekly refresh (before asking to push)
// and again after the push with --live.
//
//   node scripts/check-site.mjs          data checks + every week, day, tab and game in headless Chrome
//   node scripts/check-site.mjs --live   also confirm the live site serves exactly these files
//
// Exit code 0 = no errors (warnings are listed but don't fail). Anything marked ERROR must be fixed.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = "https://freshwaterphonics.vercel.app";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);
const json = p => JSON.parse(readFileSync(join(SITE, p), "utf8"));

// ---------- 1. data ----------
const IDX = json("weeks/index.json");
const PICS = json("pictures.json");
const html = readFileSync(join(SITE, "index.html"), "utf8");
const strokesBlock = html.slice(html.indexOf("const STROKES = {"), html.indexOf("};", html.indexOf("const STROKES = {")));
const STROKES = new Set([...strokesBlock.matchAll(/^\s*"?([a-z]{1,3})"?\s*:\s*\{/gm)].map(m => m[1]));

if (!IDX.weeks.some(w => w.weekOf === IDX.current)) err(`index.json: current ${IDX.current} has no week entry`);
const weeks = IDX.weeks.filter(w => w.file);
for (const w of IDX.weeks) {
  if (w.file && !existsSync(join(SITE, "weeks", w.file))) err(`index.json: ${w.weekOf} points at missing weeks/${w.file}`);
  if (w.book) {
    const f = join(SITE, w.book.file);
    if (!existsSync(f)) err(`index.json: ${w.weekOf} book file ${w.book.file} is missing`);
    else {
      const b = readFileSync(f, "utf8");
      if (!b.includes("Back to Freshwater Phonics")) err(`${w.book.file}: no "Back to Freshwater Phonics" link`);
      const bad = b.match(/\b(smed|smoo|bear|silly|spell|witch|nonsense) word\b/i);
      if (bad) err(`${w.book.file}: made-up words are called "${bad[0]}"; they must be "alien word"`);
    }
  }
}
const cur = IDX.weeks.find(w => w.weekOf === IDX.current);
// a review week with no new sounds should only happen when school says it is revising
if (cur && cur.status === "review" && !(cur.focus || []).length)
  warn(`current week ${cur.weekOf} is a review week with no new sounds. If school didn't say it's revising, use the next group from "Expected order" in school/reception/phonics-progress.md, marked expected`);
if (cur && cur.file && readFileSync(join(SITE, "weeks/current.json"), "utf8") !== readFileSync(join(SITE, "weeks", cur.file), "utf8"))
  err(`weeks/current.json is not an exact copy of weeks/${cur.file}`);

const picWords = new Set();
const isWord = x => typeof x === "string" && /^[a-z][a-z-]*$/.test(x);
for (const w of weeks) {
  const W = json("weeks/" + w.file);
  const r = spawnSync("node", [join(SITE, "scripts/validate.mjs"), join(SITE, "weeks", w.file)], { encoding: "utf8" });
  if (r.status !== 0) err(`validate.mjs ${w.file}:\n    ` + (r.stdout + r.stderr).trim().split("\n").filter(l => /error/i.test(l)).join("\n    "));
  if (JSON.stringify(W.phonics.focus) !== JSON.stringify(w.focus)) err(`${w.file}: focus ${W.phonics.focus.join(" ")} differs from index.json (${w.focus.join(" ")})`);
  for (const g of W.phonics.focus) if (!STROKES.has(g)) err(`index.html STROKES: no letter-trace guide for "${g}" (${w.file})`);
  for (const [n, d] of Object.entries(W.phonics.days || {})) {
    if (!d.game) err(`${w.file} day ${n}: no main game`);
    if (!d.stretch) warn(`${w.file} day ${n}: no stretch game`);
    if (d.sound && !W.phonics.focus.includes(d.sound) && !W.phonics.taught.includes(d.sound)) err(`${w.file} day ${n}: sound ${d.sound} is not in focus or taught`);
    for (const g of [d.game, d.stretch, d.challenge].filter(Boolean)) {
      (g.items || []).forEach(i => { if (["hunt"].includes(g.type)) picWords.add(i.word); });
      (g.words || []).forEach(i => { if (g.type === "blendpick") { picWords.add(i.word); (i.distractors || []).forEach(x => picWords.add(x.word)); } });
      if (g.type === "caption") (g.items || []).forEach(i => i.options.forEach(o => o.pics.forEach(p => picWords.add(p))));
    }
  }
  if (!W.phonics.weekend) warn(`${w.file}: no weekend note`);
  (W.phonics.memory || []).forEach(m => picWords.add(m.word));
  (W.phonics.rhymes || []).forEach(r => { picWords.add(r.target.word); r.options.forEach(o => picWords.add(o.word)); });
  for (const d of Object.values(W.maths.days || {}))
    for (const q of [d.check, d.stretch, d.challenge].filter(Boolean).flatMap(x => x.questions))
      [...(q.pattern || []), ...q.options.flat()].filter(isWord).forEach(x => picWords.add(x));
  for (const k of ["lastWeek", "asks", "standing"]) if (!W.school || !Array.isArray(W.school[k])) err(`${w.file}: school.${k} missing`);
  if (!W.journey || !W.journey.length) err(`${w.file}: journey missing`);
}
for (const p of picWords) {
  if (!(p in PICS)) err(`picture missing: "${p}" has no entry in pictures.json (the game would show the word instead)`);
  else if (!existsSync(join(SITE, "pictures", p + ".svg"))) err(`picture missing: pictures/${p}.svg (run scripts/build-pictures.mjs)`);
}

// ---------- 2. the page in Chrome ----------
const HARNESS = `<!doctype html><meta charset="utf-8"><pre id="out">running</pre>
<iframe id="f" src="index.html" style="width:1280px;height:1000px;border:0"></iframe>
<iframe id="p" src="index.html" style="width:390px;height:800px;border:0"></iframe>
<script>
const R = { errors: [], warnings: [], log: [] }, E = m => R.errors.push(m), Wn = m => R.warnings.push(m);
const wait = ms => new Promise(r => setTimeout(r, ms));
const loaded = el => new Promise(r => el.addEventListener("load", r, { once: true }));
const hook = (w, where) => {
  w.addEventListener("error", e => E(where + ": script error: " + e.message + " (line " + e.lineno + ")"));
  w.addEventListener("unhandledrejection", e => E(where + ": unhandled: " + (e.reason && e.reason.message || e.reason)));
  const ce = w.console.error; w.console.error = (...a) => { E(where + ": console.error: " + a.join(" ")); ce.apply(w.console, a); };
};
const visible = el => el && !el.hidden && !el.closest("[hidden]");
(async () => {
  const F = document.getElementById("f"), P = document.getElementById("p");
  await Promise.all([loaded(F), loaded(P)]);
  hook(F.contentWindow, "desktop"); hook(P.contentWindow, "phone");
  await wait(2000);
  const d = F.contentDocument, $ = id => d.getElementById(id);
  const IDX = await (await fetch("weeks/index.json")).json();
  const brokenImgs = () => [...d.querySelectorAll("img")].filter(i => i.complete && i.naturalWidth === 0 && visible(i)).map(i => i.getAttribute("src"));
  async function openAll(scope, where) {
    const btns = [...scope.querySelectorAll("button.play")].filter(visible);
    for (const b of btns) {
      const name = (b.closest(".launch") || b).querySelector("h3")?.textContent || b.dataset.launch;
      b.click(); await wait(400);
      if (!visible($("play"))) { E(where + ": game '" + name + "' did not open"); continue; }
      if (!$("stage").innerHTML.trim()) E(where + ": game '" + name + "' opened empty");
      const bi = brokenImgs(); if (bi.length) E(where + ": game '" + name + "' has broken pictures " + bi.join(", "));
      $("pm-close").click(); await wait(150);
    }
    return btns.length;
  }
  const tab = async t => { $("tab-btn-" + t).click(); await wait(250); };
  for (const entry of IDX.weeks.filter(w => w.file)) {
    const W = await (await fetch("weeks/" + entry.file)).json();
    const sel = $("week-select"); sel.value = entry.weekOf; sel.dispatchEvent(new Event("change")); await wait(700);
    const tag = W.weekOf;
    const head = $("week-letters").textContent.trim(), want = W.phonics.focus.length ? W.phonics.focus.join(" ") : "review";
    if (head !== want) E(tag + ": heading shows '" + head + "', expected '" + want + "'");
    await tab("today");
    const dayBtns = [...d.querySelectorAll("#daypick button")];
    if (W.phonics.days && W.phonics.days[1]) {
      if (dayBtns.length !== 6) E(tag + ": " + dayBtns.length + " day buttons, expected 6");
      for (let n = 1; n <= 5; n++) {
        const pd = W.phonics.days[n], md = W.maths.days[n], b = dayBtns[n - 1];
        if (!pd) { E(tag + ": no phonics day " + n); continue; }
        const lab = (b && b.querySelector(".l, span")?.textContent || b?.textContent || "").trim();
        const wantLab = pd.sound || (pd.review ? pd.review[0] + "…" : "✓");
        if (b && !b.textContent.includes(wantLab)) E(tag + " " + pd.name + ": day button shows '" + b.textContent.trim() + "', expected '" + wantLab + "'");
        b && b.click(); await wait(300);
        await tab("today");
        const where = tag + " " + pd.name + " phonics";
        const need = ["main" + n].concat(pd.stretch ? ["stretch" + n] : [], pd.challenge ? ["challenge" + n] : []);
        for (const id of need) if (!$("launch-" + id)) E(where + ": missing the " + id.replace(/\\d/, "") + " game on the right");
        if (!visible($("daypick-head"))) E(where + ": the 'Choose a day' heading is missing");
        if (!$("ph-script").textContent.trim()) E(where + ": the day plan on the left is empty");
        if (!d.querySelector("#ph-side .launch.book") && IDX.weeks.some(w => w.book && w.weekOf <= W.weekOf)) E(where + ": book of the week card missing");
        R.log.push(where + ": " + await openAll($("ph-side"), where) + " games opened");
        await tab("maths");
        const mw = tag + " " + pd.name + " maths";
        if (md) {
          for (const id of ["mcheck" + n, "mstretch" + n].concat(md.challenge ? ["mchallenge" + n] : [])) if (!$("launch-" + id)) E(mw + ": missing " + id.replace(/\\d/, ""));
          await openAll($("panel-maths"), mw);
        } else E(mw + ": no maths day");
      }
      // rest day and the extra games
      dayBtns[5] && dayBtns[5].click(); await wait(300); await tab("today");
      if (!$("ph-side").textContent.trim()) E(tag + " rest: right-hand side is empty");
    }
    await tab("week");
    if (W.phonics.days && W.phonics.days[1] && $("wk-tt").children.length !== 5) E(tag + " week tab: timetable has " + $("wk-tt").children.length + " rows, expected 5");
    if (!$("wk-last").children.length) E(tag + " week tab: 'at school' list is empty");
    if (!$("wk-journey").children.length) E(tag + " week tab: 'sounds so far' is empty");
    const bi = brokenImgs(); if (bi.length) E(tag + ": broken pictures " + bi.join(", "));
  }
  // back to the current week: More ways to play, and help
  $("week-select").value = IDX.current; $("week-select").dispatchEvent(new Event("change")); await wait(700);
  await tab("today");
  const more = [...d.querySelectorAll(".chips button, [data-more]")].filter(visible);
  for (const m of more) { m.click(); await wait(300); }
  await tab("help"); if (!$("panel-help").textContent.trim()) E("help tab is empty");
  // phone width: nothing wider than the screen
  const pd = P.contentDocument, pe = pd.documentElement;
  if (pe.scrollWidth > pe.clientWidth + 2) {
    const wide = [...pd.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > pe.clientWidth + 2 && getComputedStyle(e).position !== "fixed" && !e.closest("[style*=overflow], .ribbon"); }).slice(0, 5).map(e => e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "") + (e.id ? "#" + e.id : ""));
    Wn("phone width: page is " + pe.scrollWidth + "px wide on a " + pe.clientWidth + "px screen" + (wide.length ? " (" + wide.join(", ") + ")" : ""));
  }
  R.done = true;
  document.getElementById("out").textContent = JSON.stringify(R);
})().catch(e => { R.errors.push("harness: " + e.message); document.getElementById("out").textContent = JSON.stringify(R); });
</script>`;

const TYPES = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".m4a": "audio/mp4", ".css": "text/css" };
const server = createServer((q, s) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/__check.html") { s.writeHead(200, { "content-type": "text/html" }); return s.end(HARNESS); }
  const f = join(SITE, u === "/" ? "index.html" : u);
  if (!f.startsWith(SITE) || !existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); s.end(readFileSync(f));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
if (!existsSync(CHROME)) err("Google Chrome not found, so the page checks did not run");
else {
  const dom = await new Promise(res => {
    import("node:child_process").then(({ execFile }) => execFile(CHROME, ["--headless=new", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--virtual-time-budget=600000", "--dump-dom", `http://127.0.0.1:${port}/__check.html`], { maxBuffer: 1 << 26, timeout: 300000 }, (e, out) => res(out || "")));
  });
  const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  const raw = m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : "";
  let R = null; try { R = JSON.parse(raw); } catch (e) {}
  if (!R || !R.done) err("page checks did not finish" + (R ? ": " + R.errors.join("; ") : " (no result from Chrome)"));
  if (R) { R.errors.forEach(err); R.warnings.forEach(warn); if (process.argv.includes("--verbose")) R.log.forEach(l => console.log("  " + l)); }
  if (R && R.log) console.log(`page: ${R.log.length} phonics days checked, every game opened`);
}
server.close();

// ---------- 3. live site ----------
if (process.argv.includes("--live")) {
  const files = ["index.html", "term.json", "pictures.json", ...readdirSync(join(SITE, "weeks")).map(f => "weeks/" + f), ...readdirSync(join(SITE, "books")).filter(f => f.endsWith(".html")).map(f => "books/" + f)];
  let same = 0;
  for (const f of files) {
    try {
      const r = await fetch(`${LIVE}/${f}?check=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) { err(`live: ${f} returns ${r.status}`); continue; }
      const body = Buffer.from(await r.arrayBuffer());
      if (!body.equals(readFileSync(join(SITE, f)))) err(`live: ${f} differs from this copy (not pushed yet, or Vercel still deploying)`); else same++;
    } catch (e) { err(`live: could not fetch ${f}: ${e.message}`); }
  }
  console.log(`live: ${same} of ${files.length} files match`);
}

for (const w of warnings) console.log("warning: " + w);
for (const e of errors) console.log("ERROR: " + e);
console.log(errors.length ? `\n${errors.length} error(s), ${warnings.length} warning(s)` : `\nall clear (${warnings.length} warning(s))`);
process.exit(errors.length ? 1 : 0);
