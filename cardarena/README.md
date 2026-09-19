# CardArena — AR Trading-Card Battler (build-ready spec)

An iPad app that looks at a table, recognizes the two trading cards the kids put down,
floats an animated 3D creature above each card, and runs a simple one-on-one battle
driven by voice ("Charizard, Fire Spin!"), card math (HP / damage / weakness / coin
flips), and an optional **Math Mode** where landing a hit depends on answering a
grade-appropriate math question. Output mirrors to the TV over HDMI.

`CardArena` is the engine. Pokémon is a **content pack** that lives on the user's
device and never in this repo. See *Legal posture* below — it shapes the architecture.

This folder is the spec. It is written to be built from directly.

| Doc | What it pins down |
|---|---|
| [SPEC-battle.md](SPEC-battle.md) | Battle state machine, turn flow, resolution modes (Pure / Luck / Math), damage pipeline, coin flips, KO, sides & profiles, referee controls |
| [SPEC-math.md](SPEC-math.md) | The 10-level math ladder, question generators, answer input (voice / choice / numpad), parsing, timers, mercy, thematic questions |
| [SPEC-app.md](SPEC-app.md) | Runtime: card detection + OCR + tracking, asset loading, summon sequence, animation & VFX, damage-stage shader, voice, audio, HUD, storage, TV out |
| [SPEC-forge.md](SPEC-forge.md) | Offline content pipeline: fetch, integrity, scale/pivot/yaw auto-detection, effect-IR generation, texture/LOD build, outputs |
| [SPEC-ir.md](SPEC-ir.md) | The effect-IR batch: field ownership, the exact rubric prompt, structured-output schema derivation, batch mechanics, cost, golden acceptance test |
| [SPEC-native.md](SPEC-native.md) | Swift ⇄ Unity plugin contract: C ABI, configs, event catalog, threading, Editor mock, runtime reference images |
| [SPEC-audio.md](SPEC-audio.md) | Sound event catalog, sourcing, mixer buses, ducking, variation |
| [BUILD-PLAN.md](BUILD-PLAN.md) | Milestones in build order, each with acceptance criteria |
| [DECISIONS.md](DECISIONS.md) | Why the spec is the way it is: 24 decisions, each with the alternative rejected, the reasoning, and what would change my mind |
| [RESEARCH-PROMPT-cost.md](RESEARCH-PROMPT-cost.md) | A paste-ready prompt for other models: research the current landscape and return a model-routing plan for building this at lowest cost |
| [HANDOFF.md](HANDOFF.md) | Running this build in another tool: setup, kickoff prompt, always-loaded rules, per-milestone prompts, the two risk spikes |
| [COST-CALIBRATION.md](COST-CALIBRATION.md) | Measuring real agent spend: protocol, milestone weight table, extrapolation, `cost-log.csv` |
| [schemas/](schemas/) | JSON Schemas for `manifest`, `effect-ir`, `profile`, `battle-config`, `content-pack` |
| [forge/golden-attacks.json](forge/golden-attacks.json) | 38 hand-labelled attacks the IR batch must reproduce (card ids + expected IR; no card text) |

---

## Goals

1. Two kids (profiles: e.g. **Mason**, 4 and **Miles**, 7) can play a full 1-v-1 with no adult
   at the iPad after setup. A parent has a small **referee strip** for overrides.
2. Every card in the English card database is recognized. Every species in the model
   library renders, faces its opponent, attacks, takes damage, and faints.
3. Zero network in the battle loop. One asset download on first launch, then offline forever.
4. Everything per-species is produced by an automated pipeline, verified in bulk, never hand-authored.
5. The engine is publishable; the Pokémon content is not, and the split is enforced by structure.

## Non-goals (v1)

- Full TCG rules engine: no bench, energy attachment, trainer cards, abilities, status
  conditions beyond a damage popup, prize cards, or deck handling.
- Multi-device play, accounts, cloud sync, App Store distribution.
- Per-attack bespoke animations. Attacks animate by **element × archetype** (see SPEC-app).

## Architecture — three layers, one network touch

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 · THE FORGE  (your Mac, offline, run once per content update)   │
│  fetch models + card DB + species data → integrity → scale/pivot/yaw     │
│  auto-detect → effect-IR via one LLM batch → ASTC + LODs → pack build    │
│  OUT: pack.bundle (assets)  +  manifest.json (numbers)  +  effect-ir.json │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ one-time download on first launch (~250 MB models)
┌──────────────────────────────▼───────────────────────────────────────────┐
│  LAYER 2 · THE APP  (iPad, fully offline after first run)                │
│  camera → Vision rectangles → OCR name+number → local card DB →          │
│  runtime ARReferenceImage → 6DoF anchor → summon → battle FSM →          │
│  resolution (Pure/Luck/Math) → VFX/audio → HP → KO                       │
│  local JSON: profiles, config, stats                                     │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 3 · THE PUBLIC REPO                                                │
│  engine (no assets) · forge scripts · manifest.json · math module ·       │
│  CC0 SFX · content-pack spec · fetch script the USER runs                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why fully local:** latency (kids notice 300 ms), reliability (one mid-battle failure
and they stop believing in it), it all fits (~250 MB models measured, ~50 MB card JSON),
privacy (camera + mic never leave the device), and — decisively — **legal**: a server
that serves the models is *you distributing copyrighted assets*. Device-local assets the
user fetched from a third party is a different posture entirely.

**One consequence worth stating: a battle costs $0.** No per-turn inference, no card-
recognition API, no cloud database, no backend, no per-player bandwidth. Vision OCR and
Speech both run on-device; combat, math, RNG, assets and the card database are all local.
Every dollar in this project is spent during the build; the finished thing has no marginal
cost per play and cannot acquire one unless someone deliberately adds a service.

## Legal posture (drives the design)

| Ships in the public repo | Lives only in the content pack (user-fetched) |
|---|---|
| Engine source (Unity project, zero creature assets) | Every mesh and texture |
| Forge scripts | Card images and card text |
| `manifest.json` — per-species yaw / scale / pivot **numbers** | Species cries (audio) |
| `effect-ir.json` keyed by card id, **no reproduced card text** | Anything with the franchise name in it |
| Math module, battle engine, CC0 sound effects, Poké-Ball-like *generic* "capsule" | The real Poké Ball design and chime |
| Content-pack spec + fetch script | |

Naming: the app, repo, bundle id, and icon never contain "Pokémon", "Poké", or "Pokéball".
The summon object is a generic **capsule** in the engine; the content pack may swap the model.

## Stack (decided)

- **Unity 6 LTS + AR Foundation (ARKit XR plugin)**. Chosen because ~80 % of the work is
  content pipeline, shaders (Shader Graph), VFX (VFX Graph / particles), audio mixing,
  and Addressables — all far cheaper in Unity than RealityKit.
- **One small native Swift plugin** (~300 lines) exposing iOS Vision (rectangle + text
  recognition) and Speech (`SpeechAnalyzer` on iOS 26+, `SFSpeechRecognizer` fallback).
  This is the only native code.
- **Forge**: Python (fetch, normalize, yaw, IR) + a Unity batch-mode step (import →
  prefab with baked yaw/scale/pivot → Addressables with ASTC + LODs).
- Target: any iPad with an A12+ chip, iPadOS 17+. USB-C → HDMI for the TV.

If a native-Swift/RealityKit build is preferred, every spec here is stack-agnostic except
the parts marked *(Unity)*.

## Glossary

- **Side** — left/right play area; a side is bound to a **profile** for the battle.
- **Profile** — a kid: name, math level, answer mode, timer, mercy, damage scale, stats.
- **Gate** — what an attack must pass before it can land: `none` or `math`.
- **Luck** — miss chance applied to ungated / failed attacks.
- **Outcome** — `HIT` · `GLANCE` (half damage) · `MISS`.
- **Effect IR** — the structured, precomputed description of an attack (see SPEC-forge).
- **Manifest** — per-species placement numbers produced by the forge.
- **Capsule** — the generic summon object (content pack may skin it).
