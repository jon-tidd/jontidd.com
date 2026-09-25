# HANDOFF — running this build in another tool

Everything needed to hand CardArena to a coding agent (Cursor, Windsurf, Copilot
Workspace, Claude Code, a bare API loop) with no memory of the conversation that
produced these specs. Prompts below are self-contained — paste verbatim.

Pair this with **[COST-CALIBRATION.md](COST-CALIBRATION.md)** to turn one measured
milestone into a real project estimate.

---

## 0. Setup (once)

1. Create an empty repo for the engine, e.g. `cardarena-engine`. **Do not build inside
   the jontidd.com site repo** — that's where the spec lives, not the app.
2. Copy this entire `cardarena/` folder into it as `spec/`. It is ~184 KB of Markdown and
   JSON; no binaries, no assets.
3. Commit it untouched as the first commit, so any later drift from the contract is visible
   in `git diff`.
4. Put `spec/RULES.md` (§2 below) at the repo root as `AGENTS.md` **and** `.cursorrules`
   (or `CLAUDE.md` — whatever your tool auto-loads). Both names, same content: tools differ.

### Assumed setup: Cursor Pro + OpenRouter BYOK

These instructions assume **Cursor Pro ($20/mo) with BYOK pointed at OpenRouter**. It is the
best-fit default for this project: Tab completion and repo indexing stay on the subscription
(Tab is what Cursor does best and you'll lean on it constantly in Unity C#), while every
agent token bills to OpenRouter at wholesale on whatever model you pick.

One-time config, ~10 minutes:

1. Cursor Pro. The paid tier is required for BYOK with a custom base URL in Agent.
2. OpenRouter account, load credit, create a key.
3. Cursor → Settings → Models → **OpenAI** provider → enable "Use own API key".
4. Paste the OpenRouter key. Set **Override Base URL** to
   `https://openrouter.ai/api/v1/cursor` — the trailing `/cursor` is required; plain
   `/api/v1` breaks tool calls.
5. Add the model ids you want to the custom model list.
6. Set a spend alert in OpenRouter. BYOK has no ceiling; a runaway agent session has no cap.
7. **Turn Auto off.** Auto and Cursor's own Composer models bill to Cursor, not your key,
   which defeats the setup.

Verify before starting: open Agent mode, ask it to read a file, confirm the request shows up
in your OpenRouter activity log. If it doesn't, you're still spending Cursor credits.

### Which model for which milestone

Map the supervision column in §3 straight onto model tier — the supervision level *is* the
risk level:

| Supervision | Model tier | Why |
|---|---|---|
| **auto** | cheapest capable open-weights (Qwen/DeepSeek/GLM class, ~$0.07–0.30/M) | A gate catches every failure. `forge verify`, the golden set, and the 10k-case tests are the oracle, not the model. |
| **check** | mid-tier | *You* are the oracle here, so iteration speed matters more than model quality. Don't overpay for work you're going to eyeball anyway. |
| **watch** | frontier (Sonnet/Opus class) | Failures are silent or device-only. This is where rework costs an evening and the model cost is noise. |

Switching tier is a dropdown. Change it deliberately per task class rather than letting a
router decide — and log which one you used (`cost-log.csv`), or you can't tell later whether
the cheap tier was actually cheap.

```
cardarena-engine/
├── AGENTS.md          # = spec/RULES.md, auto-loaded context
├── .cursorrules       # same file, Cursor's name for it
├── spec/              # this folder, verbatim
│   ├── README.md  BUILD-PLAN.md  SPEC-*.md
│   ├── schemas/  examples/  forge/golden-attacks.json
├── forge/             # M0 lives here (Python)
└── unity/             # M1+ lives here
```

---

## 1. Kickoff prompt — Night 1 (paste as the very first message)

**Start here unless you have a reason not to.** `BUILD-PLAN.md` Part 1 is four evenings
and produces a playable thing on your table. Part 2 is optional expansion.

> You are implementing **CardArena**, an iPad AR trading-card battler. A complete
> specification exists in `spec/`. It is the contract — you implement it, you do not
> redesign it.
>
> **Read first, in full:** `spec/README.md`, `spec/DECISIONS.md` (why the spec is the way
> it is — read this before concluding any part of it is wrong), and `spec/BUILD-PLAN.md`.
>
> **Your task: Night 1 (N1 · Forge-lite) only.** Part 1 of the build plan, nothing else.
>
> This is deliberately the *small* version. Twenty species, hand-checked, no automated yaw
> detection, no effect-IR batch, no asset bundles. Do not build the M0 pipeline — it exists
> for 1,300 species and we have 20.
>
> Write a short Python script that, given a list of ~20 species ids, downloads those GLBs
> and extracts HP, types, weaknesses and up to two attacks per card from `pokemon-tcg-data`
> into one JSON. Then give me a checklist for hand-noting each model's facing direction, and
> a `manifest.json` skeleton matching `spec/schemas/manifest.schema.json` for me to fill in.
>
> Constraints: never modify `spec/`; never commit a model, texture, card image or card text;
> everything you emit validates against `spec/schemas/`; run what you write and show output.

## 1b. Kickoff prompt — the full pipeline (only if you need all 1,300 species)

> You are implementing **CardArena**, an iPad AR trading-card battler. A complete
> specification already exists in `spec/`. It is the contract — you implement it, you do
> not redesign it.
>
> **Read these in order before writing any code, in full, not skimmed:**
> 1. `spec/README.md` — goals, three-layer architecture, legal posture, stack
> 2. `spec/DECISIONS.md` — why the spec is the way it is, and what was rejected. Read this
>    before you conclude any part of the spec is wrong.
> 3. `spec/BUILD-PLAN.md` — milestones M0–M10 with acceptance criteria
> 4. `spec/SPEC-forge.md` and `spec/SPEC-ir.md` — the offline content pipeline
> 5. `spec/schemas/*.json` — every artifact you produce must validate against these
>
> Then read the remaining `spec/SPEC-*.md` files as each milestone needs them.
>
> **Your task right now: M0 only** (`spec/BUILD-PLAN.md` Part 2 → "M0 · The real forge").
> Do not start any other milestone. Do not scaffold Unity.
>
> Build the Python side first, as a CLI named `forge` with subcommands in this order:
> `fetch`, `check`, `place`, `sheet`, `ir`, `verify`. Implement and verify each subcommand
> before starting the next. For `place`, begin with a **20-species spike** of the CLIP
> yaw-detection described in `spec/SPEC-forge.md` §3 and report the hit rate before
> running the full library.
>
> Before you write code, give me a short plan: the module layout, the CLI surface, and
> which spec section each module implements. Wait for my go-ahead on the plan.
>
> Constraints, non-negotiable:
> - Never modify anything in `spec/`. If a spec seems wrong, stop and tell me — do not
>   silently work around it.
> - Never commit a 3D model, texture, card image, or card text to this repository.
> - Every output artifact validates against its schema in `spec/schemas/` before you
>   claim a step is done.
> - Run the code you write. "Should work" is not done; show me output.

## 2. RULES.md — the always-loaded contract

Save as `AGENTS.md` and `.cursorrules` at the repo root:

The canonical copy lives in **[RULES.md](RULES.md)** — copy that file verbatim.

```markdown
# CardArena — agent rules

`spec/` is a contract, not a suggestion. Implement it; do not redesign it.

## Never, without asking first
- Edit any file under `spec/`.
- Change a JSON Schema in `spec/schemas/`, or emit an artifact that doesn't validate.
- Change the resolution model in `spec/SPEC-battle.md` §2 (gate + luckMiss +
  wrongPenalty + mercy). It is deliberate and load-bearing.
- Change the effect-IR field ownership in `spec/SPEC-ir.md` §1 — the forge computes
  element, intensity, needsReferee, hash, cardIds; the model decides the rest.
- Commit any 3D model, texture, card image, card text, or audio from the content pack.
  This repo ships code, schemas, and derived numbers only. See `spec/README.md`
  "Legal posture".
- Add a runtime network dependency to the battle loop. The app is offline after the
  one-time pack download.

## Always
- Read the relevant `spec/SPEC-*.md` section before implementing a feature.
- Before deciding any spec choice is wrong, check `spec/DECISIONS.md` — the alternative you
  are about to propose was probably considered and rejected for a stated reason.
- Validate every produced artifact against its schema, in code, as a test.
- Run what you write and paste real output. Never report success you haven't observed.
- Keep the engine franchise-neutral: no franchise names in code, identifiers, UI
  strings, the app name, or the bundle id. The summon object is a "capsule".
- Prefer small, verifiable steps. Finish and verify one CLI subcommand before the next.
- When a spec is ambiguous, say so and propose an interpretation. Don't guess silently.

## Oracle authorship — the rule that protects every other rule

The spec's defence is that output is *verified*, not trusted. That holds only where the
verifier is independent of the thing it verifies.

- **Independent already:** the JSON Schemas, the 38-case golden set, `forge verify`. These
  are hand-authored and live in `spec/`. Never let a model edit them.
- **NOT independent:** any test, constraint checker or oracle written *as part of* a
  milestone — above all M7's 10,000-case generator checks.

So: **write every oracle with the strongest model available, before and separately from the
implementation it checks.** Then let a cheap model grind against it. A single model that
authors both a generator and its constraint checker can converge on a self-consistent wrong
answer, pass 10,000 cases, and tell you it is done. That failure is silent and survives to
production.

If one model must do both, author the oracle in a separate session that has not seen the
implementation, and review it yourself before the implementation is written.

Aider has this built in: `--editor-model` splits architect from editor, so a strong model
designs and writes the checks while a cheap one implements against them. If your harness
offers that split, use it here.

## Definition of done for a milestone
Every acceptance criterion in `spec/BUILD-PLAN.md` for that milestone, demonstrated with
real command output or a screenshot. Not "implemented" — demonstrated.
```

## A note on prices in this repo

Five model reviews of this plan produced **conflicting current prices** for the same models
and disagreed on whether a given router tier is available to individuals. The landscape moves
faster than any document in here can track.

So: **no price in this repo is authoritative.** Every cost figure is an order-of-magnitude
sanity check, and every decision that depends on one is expressed as a *method* instead —
the golden-set tournament (`SPEC-ir.md` §5.2), `--dry-run` before any paid run (D24), and
measure-then-extrapolate (`COST-CALIBRATION.md`). Check live pricing at the moment you
spend, and trust your own measurement over any table, including these.

## Harness notes

**BYOK** — "bring your own key" — means the tool sends requests using *your* provider API
key and bills *you* at wholesale token rates, instead of consuming the tool's own credits.
The harness becomes a steering wheel; you choose the engine.

**Cursor supports BYOK**, and this is the setup worth knowing:

- Works with your key: **Chat, Composer, Agent Mode, and Inline Edit** — i.e. all the
  expensive agentic work.
- Always stays on Cursor's own models: **Tab completion and Apply.** You want this — Tab is
  what Cursor is best at, it's fast, and it's covered by the subscription.
- Providers: OpenAI, Anthropic, Gemini, Azure, Bedrock, and any **OpenAI-compatible host** —
  which is how OpenRouter gets you 200+ models including open weights.
- Requires a **paid plan** ($20 Pro minimum) for BYOK with a custom base URL in Agent.
- **OpenRouter gotcha:** the base URL must be `https://openrouter.ai/api/v1/cursor`. Plain
  `/api/v1` breaks tool calls.
- Don't use Auto while on BYOK — Auto and Cursor's own Composer models bill to Cursor, not
  to your key, which defeats the point.

So **Cursor Pro + OpenRouter BYOK** gets you Tab completion and repo indexing on the
subscription, and agent tokens at wholesale on whatever model you pick. That is a strong
default and removes the main structural argument for leaving Cursor.

The fully-open alternatives are $0 for the tool and BYOK by default:

- **Cline** (VS Code) — autonomous agent, strong at multi-file, multi-language, tool-using
  work. Better fit for M1, M2, M3, M8, M9, M10 where Unity, the editor and the device are
  all in play.
- **Aider** (terminal) — tight implement → test → fix → commit loops, excellent Git
  awareness, and the architect/editor split above. Better fit for M0, M4, M5, M6, M7 —
  bounded, code-heavy, test-verified work.

Configure named model profiles once (bounded-cheap / cheap-agent / frontier / escalation)
and switch deliberately by task class rather than letting a router spend for you. **Do not
use Roo Code** — archived read-only since 2026-05-15, unmaintained, and it will drift as
provider APIs change.

One caveat on the cheapest tier: very small coding models are fine for *bounded* edits with
a test oracle, and unreliable as long-horizon autonomous agents. Use them as a cheap pair,
not as "go build M2 while I eat dinner".


## 2b. What you cannot delegate

Roughly **45 % of this project by weight (M0, M4, M6, M7) can run nearly unattended**,
because each has an oracle that does not need you: `forge verify` exits 0 or it doesn't,
the 38-case golden set passes or it doesn't, the battle engine's tests are deterministic,
the generators face 10,000 constraint checks. Give those long leashes and read the gates in
the morning. That was the point of building machine-checkable acceptance everywhere (D23).

The rest needs a person, and not because agents are weak — because the work is physical:

1. **The table.** The app watches real cards under your actual living-room light through a
   camera on a stand. M1, M3 and M9's criteria are literally *does it look right* — a
   creature floating too high, facing backwards, an HP bar unreadable from the couch, the
   iPad throttling after 20 minutes. There is no oracle but your eyes.
2. **Your kids' actual cards.** The OCR spike is not "does OCR work", it's "does it read a
   sleeved, bent, thumbprinted card at 8pm under a warm bulb". That needs those cards.
3. **Deployment.** Sideloading needs your Apple ID, your Mac, your cable, your iPad.
4. **The real success criterion.** Is L1 right for a four-year-old? Is mercy patronising to
   the older one? Does the capsule opening feel *magical*? That is the entire point of the
   project and no test has an opinion about whether your kids light up.
5. **The legal call.** Fetching the content pack is your decision about your own risk (D4).
   Not something an agent should do in your name.

### Unattended is plausibly *more* expensive, not less

Every routing decision here assumes a human notices "tests green, behaviour still wrong"
and escalates. Remove that and three things break at once: an agent builds M1 that passes
its checks and renders wrong, then builds M3 on it, then M4 on that — the error surfaces
three milestones later and unwinding it costs more than the routing saved; the escalation
rate and churn metrics in `COST-CALIBRATION.md` §4 have nothing measuring them; and a
runaway loop has no ceiling. Budget supervision as cost control, not as overhead.

### Where an autonomous agent platform does and doesn't fit

Platforms like **Grok Bot** (xAI, launched Aug 2026) give each agent its own cloud computer,
sign in with your credentials, run 24/7 with your laptop closed, and escalate only for
decisions. That shape maps onto this project unusually cleanly — but only onto half of it.

**Genuinely good fit — the `auto` milestones:**
- **M0 forge.** A headless Python CLI with `forge verify` as an oracle. Fetching 1,300
  models, the integrity pass, normalization, and iterating until verify exits 0 is exactly
  overnight work that needs no human.
- **The IR batch.** Long-running, retry-heavy, zero judgment once the golden set passes.
- **M7 generators, M4 combat core, M6.** Pure logic with tests as the oracle.
- **Contact-sheet rendering.** Have the QA sheets waiting for you in the morning.

**Structurally cannot help, regardless of model quality:**
- **Anything in Unity** (N2–N4, M1, M3, M5, M9). The Editor is a GUI app on your Mac, and
  the iteration is visual — is the creature the right height, is the shader stretching.
- **Anything on-device.** Sideloading needs your Mac, your cable, your iPad, your Apple ID.
  A cloud VM cannot plug into your iPad.
- **The table.** Unchanged from above.

**Two credential cautions.** Don't hand an autonomous agent your Apple Developer credentials
or anything that can publish. And the content-pack fetch (D4) is a decision about your own
legal risk — don't delegate it to an agent acting under your identity.

Note that this fit map is identical to the `auto` / `check` / `watch` column in §3. That is
not a coincidence: the milestones safe to hand to an autonomous platform are exactly the ones
with a machine-checkable oracle.

Separately: **Grok models are just a routing choice.** Point Cursor's BYOK at Grok 4.x via
OpenRouter and you are "building in Grok" with no commitment. Put it in the golden-set
tournament (`SPEC-ir.md` §5.2) and let 38 hand-labelled cases decide rather than a benchmark.

### Batch your involvement — the edges, not the middle

| When | What | Time |
|---|---|---|
| Week 1 | Both spikes: CLIP yaw hit rate, OCR on the binders (§5) | one evening |
| After M0 | Read the contact sheets, spot the ~40 bad-facing outliers | 5 minutes |
| After M1–M3 | One session with the iPad on the stand, judging all three together | one evening |
| After M9 | Look at the damage shader on 10 species | 20 minutes |
| M10 | Play a full battle with your boys | the good part |

That is about **four evenings of genuinely irreplaceable presence across three months.**
Everything between them can run while you sleep.

## 3. Per-milestone prompts

Each assumes the kickoff prompt ran earlier in the same session, or that `AGENTS.md` is
auto-loaded in a fresh one. Start a **fresh session per milestone** — it keeps context
small, which is the single biggest lever on cost.

Supervision column: **auto** = long leash, check the gate in the morning · **check** =
run unattended, then judge the result with your own eyes before building on it ·
**watch** = stay in the loop, failures are silent or only show on device.

**Part 1 (the four nights)** — N1 is §1 above. N2–N4:

| # | Sup. | Prompt |
|---|---|---|
| **N2** | check | `Implement N2 (Table demo) from spec/BUILD-PLAN.md Part 1. Read spec/SPEC-app.md §§4-5 first. Unity 6 + AR Foundation. Two photographed cards as hardcoded ARReferenceImage targets — no OCR, no recognition. Creature above each, hover bob, Y-constrained lookAt so they face each other, screen-space HP bars. Use the hand-written manifest from N1.` |
| **N3** | auto | `Implement N3 (Combat) from spec/BUILD-PLAN.md Part 1. Read spec/SPEC-battle.md §§1-3 in full. Build the FSM and damage pipeline properly — Part 2 builds on this. Pure mode only, no gates. Three generic VFX (melee lunge, projectile, beam), not the full element matrix. Tap to attack. Unit-test the damage pipeline before wiring visuals.` |
| **N4** | check | `Implement N4 (The capsule) from spec/BUILD-PLAN.md Part 1. Read spec/SPEC-app.md §4. Capsule arcs in, spins, opens, white-hot dissolve-in of the mesh, material lerp. Faint is the same timeline reversed. The mesh materializes using its own geometry with a swapped unlit emissive material, so it works on any model.` |

**Part 2 (expansion)** — any order, none required:

| # | Sup. | Prompt |
|---|---|---|
| **M0** | auto | See §1b above. |
| **M1** | check | *(superseded by N2)* `Implement M1 (Table demo) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §§4–5 first. Unity 6 LTS + AR Foundation. Two hard-coded reference images; creature prefabs anchored above each; Y-axis-constrained lookAt between them; screen-space HP bars. Use the manifest from M0 for scale/pivot/yaw. Acceptance: 30 fps for 5 minutes on device, models keep facing each other as cards move.` |
| **M2** | watch | `Implement M2 (Card identification) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §2 (all of it, including §2.5 unknown-card flow) and spec/SPEC-native.md in full. Build the native plugin against the C ABI in SPEC-native §2 exactly — signatures and event JSON must match. Implement EditorMockBackend first so this is testable without a device, then IosBackend. Include the pHash known-cards learning in §2.5.` |
| **M3** | check | `Implement M3 (Summon) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §4. The capsule sequence must hide asset loading — the load starts at t=0 and the mesh materializes at t=1.25s. Faint is the same timeline reversed. Acceptance: cold-load of an unseen species shows no visible hitch.` |
| **M4** | auto | `Implement M4 (Combat core, Pure mode) from spec/BUILD-PLAN.md. Read spec/SPEC-battle.md in full and spec/SPEC-app.md §6. The battle engine is PURE LOGIC: no rendering or I/O dependencies, consumes config + cards + IR + seeded RNG, emits the event log in SPEC-battle §6. Presentation replays the log. Write unit tests for the damage pipeline against 20 sampled attacks before wiring any visuals.` |
| **M5** | auto | `Implement M5 (Audio) from spec/BUILD-PLAN.md. Read spec/SPEC-audio.md. Wire every event in the §3 catalog, the mixer buses and the Listening snapshot ducking, and the variation rules. Engine SFX must be CC0 — log every source in audio/SOURCES.md.` |
| **M6** | auto | `Implement M6 (Luck mode) from spec/BUILD-PLAN.md. Read spec/SPEC-battle.md §2. Outcome is decided at RESOLVING and revealed at impact — wind-up and launch are identical for every outcome. Acceptance: 100 simulated attacks at each slider stop hit within ±5% of target rate.` |
| **M7** | auto | `Implement M7 (Math Mode) from spec/BUILD-PLAN.md. Read spec/SPEC-math.md in full. Generators for all 10 levels with the stated constraints, plus the 10,000-question test per level from §7 — write the tests first. Then choice/open answer input, numpad, timer, mercy, profiles, parent settings, referee strip. Use spec/examples/profiles.json as the fixture.` |
| **M8** | watch | `Implement M8 (Voice) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §8 and spec/SPEC-native.md §§3–4. Push-to-talk only, no wake word. State-scoped contextual strings. Matching is Levenshtein + Double Metaphone with the stated thresholds. Tap fallback must always remain available.` |
| **M9** | check | `Implement M9 (Damage stages) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §7. ONE Shader Graph material driven by a damage01 float, using triplanar projection so it needs no per-species UV knowledge. Acceptance: three visibly distinct bands on 10 random species with zero per-species tuning.` |
| **M10** | watch | `Implement M10 (Polish and first-run) from spec/BUILD-PLAN.md. Pack download + hash verification + isExcludedFromBackup, stats screen, HDMI-out test, parent-gated settings. Acceptance: crash-free 30-minute session on device.` |

## 4. Two things that are not agent work

- **The IR batch** (`forge ir`, inside M0) classifies every unique attack in the card
  database — measured at **~7,500–11,000 items** after dedup. That is a **direct Anthropic
  API bill of $70–$102 on `claude-opus-5`** via the Batch API ($28–41 on Sonnet 5, $14–21
  on Haiku 4.5), separate from any IDE subscription or credits. Always run
  `forge ir --dry-run` first — it prints the exact count and projected cost without calling
  the API — then `forge ir --golden` (38 cases, cents) to gate correctness. Full derivation
  in `spec/SPEC-ir.md` §5.
- **The content pack** must be fetched by you on your own machine from third-party
  sources. Never host it, never commit it. See `spec/README.md` "Legal posture".

## 5. Two spikes that decide real risk

Neither is a coding problem; both need your Mac and your kids' binders. Do them early —
they're the only places the plan could be wrong in a way that matters.

1. **Yaw detection** (inside M0): does CLIP-vs-official-artwork actually pick the front of
   a low-poly game rip? Run the 20-species spike and report the hit rate. Below ~80 %, the
   VLM fallback in `SPEC-forge.md` §3 becomes the primary path, not the tie-break.
2. **OCR hit rate** (M2): 20 real cards from the binders, on the table, under your actual
   living-room light, at the real camera angle. Below ~90 % at 2 s, the unknown-card flow
   in `SPEC-app.md` §2.5 carries more weight than planned and should be built first.
