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

## 1. Kickoff prompt (paste as the very first message)

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
> **Your task right now: milestone M0 only** (`spec/BUILD-PLAN.md` → "M0 · Forge").
> Do not start M1. Do not scaffold Unity.
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

## Harness notes

The harness is free; the model is the cost. Both of the obvious open options are $0 and
BYOK, so the economics live entirely in which model you point them at:

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

## Definition of done for a milestone
Every acceptance criterion in `spec/BUILD-PLAN.md` for that milestone, demonstrated with
real command output or a screenshot. Not "implemented" — demonstrated.
```

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

| # | Sup. | Prompt |
|---|---|---|
| **M0** | auto | See §1 above. |
| **M1** | check | `Implement M1 (Table demo) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §§4–5 first. Unity 6 LTS + AR Foundation. Two hard-coded reference images; creature prefabs anchored above each; Y-axis-constrained lookAt between them; screen-space HP bars. Use the manifest from M0 for scale/pivot/yaw. Acceptance: 30 fps for 5 minutes on device, models keep facing each other as cards move.` |
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
