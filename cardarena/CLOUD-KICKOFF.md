# CLOUD-KICKOFF — hand Night 1 to a Cursor cloud agent from your phone

Cursor cloud agents run in an Ubuntu VM on Cursor's infrastructure. They clone a repo, work
on a branch, and open a PR. You can start one from the **Cursor iOS app** or
**cursor.com/agents**. This is the path when you're away from the Mac.

## What the cloud can and cannot do — read this first

| Can do in the cloud | Cannot, from any cloud, ever |
|---|---|
| **N1** Forge-lite (Python) | **N2–N4** — Unity Editor on your Mac + a physical iPad |
| Later: **M0** the real forge, **M4/M6/M7** logic | Anything on-device, anything you have to look at on a table |

So the honest shape of "hand it all over": the cloud does N1 tonight; you do N2–N4 at the
Mac in three evenings; the cloud can then take M0, M4, M6, M7. This is the same limit that
applies to Grok Bot or anything else — it's physics, not tooling.

## Phone steps (~5 minutes)

1. **Create a new PRIVATE GitHub repo** named `cardarena-engine`. Empty — no README, no
   .gitignore. (GitHub iOS app → + → New repository, or github.com/new in Safari.)
   **Private matters** — see `README.md` "Legal posture".
2. **Open the Cursor app → Cloud Agents** (or cursor.com/agents). If it asks to connect
   GitHub, connect it and grant access to `cardarena-engine`.
3. **Pick `cardarena-engine`** as the repo. Base branch `main`.
4. **Model: Auto is fine.** You have a free month of Pro+ with ~$70 included; N1 won't
   dent it. BYOK cost optimization is for later and doesn't apply to cloud agents anyway.
5. **Paste the prompt below. Send. Put the phone down.**
6. When the PR arrives, open it on your phone. It will include a **contact sheet image** so
   you can check which way each creature faces without a computer. Reply on the PR with
   any corrections (e.g. "Charizard faces backwards, yaw 180").

If GitHub connection fights you in the app, Cursor's repo picker also offers **Start from
scratch** (a Cursor-hosted repo). The prompt works the same; you can push to GitHub later.

## The prompt

Copy everything between the lines.

---

You are bootstrapping and then implementing **Night 1** of CardArena, an iPad AR
trading-card battler. A complete specification exists in a public repo. Do exactly the
following, in order, and stop where told. Do not redesign anything.

**STEP 1 — Pull the spec into this repo**

```
git clone --depth 1 -b claude/pokemon-card-ar-battle-q6f5p6 https://github.com/jon-tidd/jontidd.com /tmp/src
mkdir -p spec forge unity
cp -r /tmp/src/cardarena/. spec/
cp spec/RULES.md AGENTS.md
cp spec/RULES.md .cursorrules
printf 'pack/\nforge/pack/\n*.glb\n*.gltf\n*.png\n*.jpg\n__pycache__/\n.venv/\n' > .gitignore
git add -A && git commit -m "spec: import unmodified from jontidd.com; add agent rules"
```

**STEP 2 — Read these in full before writing code**
`spec/README.md`, `spec/DECISIONS.md`, `spec/BUILD-PLAN.md` (Part 1 especially),
`spec/SETUP.md`, `spec/schemas/manifest.schema.json`.

**STEP 3 — Implement N1 · Forge-lite ONLY** (`spec/BUILD-PLAN.md` → Part 1 → N1)

This is deliberately the small version. **Do not build the M0 pipeline** — no CLIP, no VLM,
no contact-sheet QA renderer, no effect-IR batch, no Addressables. Twenty species, done
simply.

Build `forge/lite.py` (Python 3.10+, stdlib + `requests` only unless you truly need more):

1. **Species list** in `forge/species.txt`, one dex number per line, easy to edit. Default
   to 20 iconic species spanning as many energy types as possible — e.g. Pikachu (25),
   Charizard (6), Blastoise (9), Venusaur (3), Gengar (94), Machamp (68), Alakazam (65),
   Gyarados (130), Snorlax (143), Eevee (133), Lucario (448), Garchomp (445), Mewtwo (150),
   Dragonite (149), Umbreon (197), Metagross (376), Sylveon (700), Rayquaza (384),
   Greninja (658), Arcanine (59). Jon will replace these with his kids' actual cards.
2. **Download GLBs** for each id from
   `https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/{id}.glb`
   into `pack/models/` (gitignored). Report any that are 0 bytes, missing, or over 4 MB.
3. **Card data:** fetch `https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json`
   for the set list, then each `https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{setId}.json`.
   For each species pick **one** Pokémon card by name (prefer the most recent printing with
   ≥ 1 attack). Write `pack/cards.json` (gitignored) with id, name, hp, types, weaknesses,
   resistances, and up to 2 attacks (name, cost, damage, text). Cache the downloaded set
   files so re-runs are fast.
4. **Manifest:** write `forge/manifest.json` (committed — it is numbers only). For each
   species compute `scale` from the GLB bounding box against a real height (use PokéAPI
   `https://pokeapi.co/api/v2/pokemon/{id}` → `height` in decimetres), `pivot` so the
   bounding-box floor-centre is at the origin, `yaw: 0`, `yawSource: "manual"`,
   `heightM`, `tris` if easy, `fallback: "none"`. It **must validate** against
   `spec/schemas/manifest.schema.json` — write that check into the script and run it.
5. **Contact sheet for facing:** if you can render a front-ish thumbnail per model in this
   VM within ~20 minutes of effort (e.g. `trimesh` + `pyrender` headless, or any
   lightweight approach), write `pack/contact-sheet.png` (gitignored) with the 20
   thumbnails labelled by id, and **attach the image to the PR description** so Jon can
   check facing from his phone. If that isn't feasible here, say so plainly and move on —
   all yaw stays 0 and Jon will fix at the Mac.
6. **Tests:** a small `forge/test_lite.py` that validates the manifest against the schema
   and checks every species in `species.txt` has a manifest entry and a card entry.
   Run it. Paste the output.

**STEP 4 — Stop.**
Commit and **open a PR**. In the description: the 20 species and their chosen card ids; any
GLB that failed or looked broken; the test output; the contact sheet if you made one; and
**every place you had to guess.** Do **not** start N2. N2–N4 need the Unity Editor and a
physical iPad and cannot be done in this environment.

**Constraints — non-negotiable**
- Never modify anything under `spec/`. If something in it seems wrong, say so in the PR;
  don't work around it. Check `spec/DECISIONS.md` first — it was probably considered.
- Never commit a 3D model, texture, card image, or card text. `pack/` is gitignored on
  purpose; commit the **scripts** that produce it, never the output. See `spec/README.md`
  "Legal posture".
- Every artifact you commit validates against `spec/schemas/`.
- Run what you write and show real output. "Should work" is not done.
- No franchise names in code, identifiers, or the repo description. The summon object is a
  "capsule".

---
