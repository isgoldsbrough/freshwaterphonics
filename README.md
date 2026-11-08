# Freshwater Phonics

Live at https://freshwaterphonics.vercel.app (Vercel, auto-deploys from `main`; also served by GitHub Pages at https://isgoldsbrough.github.io/freshwaterphonics/).

A weekly phonics and maths page for one Reception class, run by a parent. Unofficial; not reviewed by the school.

- `index.html`: the page. It never changes week to week.
- `weeks/YYYY-MM-DD.json`: one file per week. Never delete one: every past week keeps its day-by-day sounds, its games, stretch, challenge and maths, and the week dropdown plays them again (all of Autumn 1 has full files, the first four rebuilt on 1 Nov from the school updates). `weeks/current.json` is a copy of the live one.
- `weeks/index.json`: the list of weeks for the week dropdown (`current`, each week's sounds and topic, and the half-term `break` dates). Add a row and move `current` each week. A week without a `file` shows its sounds to play, not a day plan.
- Every day follows the Home Phonics Protocol (https://claude.ai/code/artifact/6379be13-18e8-44e6-8022-82e9ab41bf3b): Revisit, Newest sound, Blend, Spell and write, Books. The page adds Revisit and Books itself; a day in the week file holds the middle three as `{ "label": "Blend", "min": 3, "do": "...", "say": "..." }`. `do` is the action, `say` (optional) the exact words for the parent, shown as a speech bubble. Never write our own pronunciation tips: the page links to Little Wandle's videos and sound sheet. All wording British English.
- Each phonics and maths day has a `stretch` (one step up, same sounds) and may have a `challenge` (a big step up, shown as a blue card after the stretch). Phonics challenges use the same game types (`mark`, `segment`, `caption`, `alien`); their words may have adjacent consonants and two parts, but no sound not yet taught. Maths challenges may use number tiles and `+` `=`, may go ahead of school, and need a spoken `say` on every question (`hint` is spoken on a wrong answer). Both can carry a `paper` line, shown under the card as "Off screen". The half-term plan for challenges is in `../school/reception/stretch-plan.md`.
- If a week ran as home review but school taught new sounds, give it school's sounds as `focus`, `status: "confirmed"` and `"homeReview": true`. The heading shows school's sounds, the status says "this page was on review", and the review days keep their own first step without an extra Revisit.
- If school hasn't said what comes next, the week is built from Little Wandle's order of sounds (`../school/reception/phonics-progress.md`, "Expected order") with `status: "expected"` and `"expectedFrom": "littlewandle"`. The status line then reads "expected from Little Wandle's order of sounds", linking to their programme progression. Without `expectedFrom`, it says "expected, not yet confirmed by school" (school named the sounds).
- `term.json`: the whole term's word bank, oral word lists per sound, tricky words and a maths pool. Drives the half-term tab and the past-week views. Add new sounds and words here as the term goes on. `words` need a picture; `blend` holds extra words for the daily Blend it card (no picture needed). Blend it picks five words a day from both: they contain that day's sound (Friday: the week's sounds) and use only sounds taught by then. A day in a week file can set its own list with `"blend": ["hat", ...]`. When a two-letter sound such as ck is taught, words with it get a line under those letters instead of a dot; when ff, ll, ss arrive, add them to `graphemes` and words such as `bell` to `blend`.
- `books/`: one game per class book, built by the `book-of-the-week` skill (`../.claude/skills/book-of-the-week/`) from `../school/reception/books/<slug>.json`. Don't edit these by hand; rebuild them. A week entry in `weeks/index.json` can have a `book` (`title`, `by`, `file`, `game`). The phonics tab shows the newest book up to the week on screen as a purple "book of the week" card at the bottom of the day's games on the right.
- Letter trace draws each letter from the `STROKES` table in `index.html`. When school teaches a new letter or digraph, add its strokes there (100 × 150 box; digraphs 170 wide). Letters without strokes are skipped, not broken.
- A week file's `school.term` fills the "This term at school" section on the term tab: `theme`, `question`, `stem`, `word`, `meaning`, `home`, `coming` and `source`. Each week takes one row from `../school/reception/term-plan-<term>.md`, which is made from the school's knowledge organiser. The word is for talking, not reading, so the validator doesn't check it. Leave `term` out and the section stays hidden.
- `organisers.json`: each school knowledge organiser, summarised in our own words (big questions and answers, words, books to share, maths with ticks, areas of learning, dates). The term tab shows the one whose `from`/`to` covers the week on screen. Add a new entry for each organiser; tick a maths topic by giving it `done` (the week school did it). No book covers or copied text.
- Each maths day has a `short` label (a few characters, e.g. "+1", "mix") shown on the day buttons on the maths tab; the phonics tab shows the day's sound. Without `short`, the full title is used and the site check warns.
- More ways to play has number trace (0 to 10), using the number entries at the top of `STROKES`.
- Shapes (`circle`, `triangle`, `square`, `rectangle`) are hand-drawn SVGs in `pictures/`, marked `"local"` in `pictures.json`. `build-pictures.mjs` skips them because the files exist.
- `audio/`: spoken clips rendered from the week file with the Mac's British voice.
- `pictures/` and `pictures.json`: OpenMoji pictures, one per word; `scripts/build-pictures.mjs` fetches any new ones.
- `sample/`: the approved look-and-feel sample, kept for reference.
- `scripts/validate.mjs`: refuses any printed word that uses a sound not yet taught.
- `scripts/build-audio.mjs`: renders the clips.
- `scripts/check-site.mjs`: the whole-site check, run before every push (`--live` after it). It checks the data and opens every week, day, tab and game in headless Chrome. See `../.claude/skills/site-check/SKILL.md`.

## Publishing a week

```
node scripts/validate.mjs weeks/2026-10-19.json
node scripts/build-pictures.mjs
node scripts/build-audio.mjs   # every week file, so all weeks keep their clips
cp weeks/2026-10-19.json weeks/current.json
git add -A && git commit -m "Week of 19 October" && git push
```

Pictures by OpenMoji (CC BY-SA 4.0). Fonts: ABeeZee and Fredoka from Google Fonts. Designed for a laptop; works on a phone. No tracking and no accounts. The daily time counter (up to 25 minutes a day) is kept in the browser's local storage on that computer only.
