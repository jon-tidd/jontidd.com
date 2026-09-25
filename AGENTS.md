# AGENTS.md — jontidd.com

Static portfolio site, no build step, no dependencies. Vercel deploys `main`.

- Pages are plain folders with an `index.html`. Keep the existing dark theme and the homepage's project-card pattern when adding a page.
- Apps with a backend do **not** live here. They get their own repo and Vercel project and are mounted with a rewrite in `vercel.json` (see the table in README.md). Don't add `api/` or `middleware.js` to this repo.
- `fantasyengine/` and `fantasyagents/` are written by the Fantasy Engine's scheduled runs; cloud tasks also read `fantasyengine/index.html` from this repo. Don't rename or move them.
- `mars/` is the public write-up; the scanner is in `jon-tidd/mars-hunt`.
- Work on a branch and open a PR to `main` from a cloud session; direct pushes to `main` are for Jon's machine only.
- Test: `npx serve .` and click through the changed page; for rewrites, check the path on the preview deployment URL.
