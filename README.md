# freshwaterphonics.uk

A weekly phonics and maths page for one Reception class, run by a parent. Unofficial; not reviewed by the school.

- `index.html`: the page. It never changes week to week.
- `weeks/YYYY-MM-DD.json`: one file per week. `weeks/current.json` is a copy of the live one.
- `audio/`: spoken clips rendered from the week file with the Mac's British voice.
- `scripts/validate.mjs`: refuses any printed word that uses a sound not yet taught.
- `scripts/build-audio.mjs`: renders the clips.

## Publishing a week

```
node scripts/validate.mjs weeks/2026-10-19.json
node scripts/build-audio.mjs weeks/2026-10-19.json
cp weeks/2026-10-19.json weeks/current.json
git add -A && git commit -m "Week of 19 October" && git push
```

Pictures are emoji (Unicode 11 and earlier, so they render on older phones). Fonts from Google Fonts. No tracking, no accounts, nothing stored.
