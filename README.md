# jontidd.com

Personal site for [Jon Tidd](https://jontidd.com) — AI developer building tools at the intersection of technology, classical wisdom, and human flourishing. Pure HTML/CSS/JS, no build step. Hosted on Vercel (project `jontidd-homepage`); every push to `main` deploys.

## Project index

Two kinds of things live at jontidd.com: **pages** that are folders in this repo, and **apps** that have their own repo and Vercel project and are proxied in through rewrites in `vercel.json`.

| Path | What | Where the code lives | Deploys as |
|---|---|---|---|
| `/` | Portfolio homepage | this repo, `index.html` | jontidd-homepage |
| `/mars` | Mars Hunt write-up ("Looking for Straight Lines on Mars") | this repo, `mars/` — the scanner itself is [`jon-tidd/mars-hunt`](https://github.com/jon-tidd/mars-hunt) | jontidd-homepage |
| `/fantasyengine`, `/fantasyagents` | Fantasy Engine dashboard + agents page (published by the engine) | this repo, `fantasyengine/`, `fantasyagents/` — engine code in [`jon-tidd/fantasy-engine`](https://github.com/jon-tidd/fantasy-engine) | jontidd-homepage |
| `/floorplan/` | IGCE Plan Studio (password) | [`jon-tidd/igce`](https://github.com/jon-tidd/igce) | `igce` → rewrite |
| `/sitescreener/` | IGCE Site Screener (password) | [`jon-tidd/igce`](https://github.com/jon-tidd/igce) | `igce` → rewrite |
| `/battleplan`, `/projectplan` | Nova Plan | [`jon-tidd/nova-plan`](https://github.com/jon-tidd/nova-plan) | `nova-plan` → rewrite |
| `/tiger/`, `/tylerplace/`, `/writing/`, `/familyhistory/`, `/MRIReport/` | Static pages | this repo | jontidd-homepage |

Rule of thumb: a static page you alone edit is a folder here. Anything with an API, secrets, a database, or other people editing it gets its own repo and Vercel project and a rewrite here.

## Run locally

```bash
npx serve -l 3456 .
```

Rewrites to other projects only work on Vercel (`npx vercel dev` honors them).
