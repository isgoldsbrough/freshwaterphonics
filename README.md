# Freshwater Phonics

Live at https://freshwaterphonics.vercel.app (Vercel, auto-deploys from `main`; also served by GitHub Pages at https://isgoldsbrough.github.io/freshwaterphonics/).

A weekly phonics and maths page for one Reception class, run by a parent. Unofficial; not reviewed by the school.

- `index.html`: the page. It never changes week to week.
- `weeks/YYYY-MM-DD.json`: one file per week. `weeks/current.json` is a copy of the live one.
- `audio/`: spoken clips rendered from the week file with the Mac's British voice.
- `pictures/` and `pictures.json`: OpenMoji pictures, one per word; `scripts/build-pictures.mjs` fetches any new ones.
- `sample/`: the approved look-and-feel sample, kept for reference.
- `scripts/validate.mjs`: refuses any printed word that uses a sound not yet taught.
- `scripts/build-audio.mjs`: renders the clips.

## Publishing a week

```
node scripts/validate.mjs weeks/2026-10-19.json
node scripts/build-pictures.mjs
node scripts/build-audio.mjs weeks/2026-10-19.json
cp weeks/2026-10-19.json weeks/current.json
git add -A && git commit -m "Week of 19 October" && git push
```

Pictures by OpenMoji (CC BY-SA 4.0). Fonts: ABeeZee and Fredoka from Google Fonts. Designed for a laptop; works on a phone. No tracking, no accounts, nothing stored.
