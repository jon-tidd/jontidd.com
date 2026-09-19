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
> 2. `spec/BUILD-PLAN.md` — milestones M0–M10 with acceptance criteria
> 3. `spec/SPEC-forge.md` and `spec/SPEC-ir.md` — the offline content pipeline
> 4. `spec/schemas/*.json` — every artifact you produce must validate against these
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
- Validate every produced artifact against its schema, in code, as a test.
- Run what you write and paste real output. Never report success you haven't observed.
- Keep the engine franchise-neutral: no franchise names in code, identifiers, UI
  strings, the app name, or the bundle id. The summon object is a "capsule".
- Prefer small, verifiable steps. Finish and verify one CLI subcommand before the next.
- When a spec is ambiguous, say so and propose an interpretation. Don't guess silently.

## Definition of done for a milestone
Every acceptance criterion in `spec/BUILD-PLAN.md` for that milestone, demonstrated with
real command output or a screenshot. Not "implemented" — demonstrated.
```

## 3. Per-milestone prompts

Each assumes the kickoff prompt ran earlier in the same session, or that `AGENTS.md` is
auto-loaded in a fresh one. Start a **fresh session per milestone** — it keeps context
small, which is the single biggest lever on cost.

| # | Prompt |
|---|---|
| **M0** | See §1 above. |
| **M1** | `Implement M1 (Table demo) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §§4–5 first. Unity 6 LTS + AR Foundation. Two hard-coded reference images; creature prefabs anchored above each; Y-axis-constrained lookAt between them; screen-space HP bars. Use the manifest from M0 for scale/pivot/yaw. Acceptance: 30 fps for 5 minutes on device, models keep facing each other as cards move.` |
| **M2** | `Implement M2 (Card identification) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §2 (all of it, including §2.5 unknown-card flow) and spec/SPEC-native.md in full. Build the native plugin against the C ABI in SPEC-native §2 exactly — signatures and event JSON must match. Implement EditorMockBackend first so this is testable without a device, then IosBackend. Include the pHash known-cards learning in §2.5.` |
| **M3** | `Implement M3 (Summon) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §4. The capsule sequence must hide asset loading — the load starts at t=0 and the mesh materializes at t=1.25s. Faint is the same timeline reversed. Acceptance: cold-load of an unseen species shows no visible hitch.` |
| **M4** | `Implement M4 (Combat core, Pure mode) from spec/BUILD-PLAN.md. Read spec/SPEC-battle.md in full and spec/SPEC-app.md §6. The battle engine is PURE LOGIC: no rendering or I/O dependencies, consumes config + cards + IR + seeded RNG, emits the event log in SPEC-battle §6. Presentation replays the log. Write unit tests for the damage pipeline against 20 sampled attacks before wiring any visuals.` |
| **M5** | `Implement M5 (Audio) from spec/BUILD-PLAN.md. Read spec/SPEC-audio.md. Wire every event in the §3 catalog, the mixer buses and the Listening snapshot ducking, and the variation rules. Engine SFX must be CC0 — log every source in audio/SOURCES.md.` |
| **M6** | `Implement M6 (Luck mode) from spec/BUILD-PLAN.md. Read spec/SPEC-battle.md §2. Outcome is decided at RESOLVING and revealed at impact — wind-up and launch are identical for every outcome. Acceptance: 100 simulated attacks at each slider stop hit within ±5% of target rate.` |
| **M7** | `Implement M7 (Math Mode) from spec/BUILD-PLAN.md. Read spec/SPEC-math.md in full. Generators for all 10 levels with the stated constraints, plus the 10,000-question test per level from §7 — write the tests first. Then choice/open answer input, numpad, timer, mercy, profiles, parent settings, referee strip. Use spec/examples/profiles.json as the fixture.` |
| **M8** | `Implement M8 (Voice) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §8 and spec/SPEC-native.md §§3–4. Push-to-talk only, no wake word. State-scoped contextual strings. Matching is Levenshtein + Double Metaphone with the stated thresholds. Tap fallback must always remain available.` |
| **M9** | `Implement M9 (Damage stages) from spec/BUILD-PLAN.md. Read spec/SPEC-app.md §7. ONE Shader Graph material driven by a damage01 float, using triplanar projection so it needs no per-species UV knowledge. Acceptance: three visibly distinct bands on 10 random species with zero per-species tuning.` |
| **M10** | `Implement M10 (Polish and first-run) from spec/BUILD-PLAN.md. Pack download + hash verification + isExcludedFromBackup, stats screen, HDMI-out test, parent-gated settings. Acceptance: crash-free 30-minute session on device.` |

## 4. Two things that are not agent work

- **The IR batch** (`forge ir`, inside M0) makes ~15,000 Anthropic API calls. That is a
  **direct API bill of roughly $125 on `claude-opus-5` via the Batch API**, separate from
  any IDE subscription or credits. Run `forge ir --golden` (38 cases, costs cents) and get
  it passing before you spend the full run. Details and cheaper model options in
  `spec/SPEC-ir.md` §5.
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
