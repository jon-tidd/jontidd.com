# Build plan

Two parts. **Part 1 is four evenings and gives you a real thing on the table.** Part 2 is
everything else, in any order, none of it required.

Estimates are evenings (~3 h) with an AI pair. "AC" = acceptance criteria.

---

# Part 1 · The four nights (~12 hours)

Creatures floating above your boys' actual cards, facing each other, battling, on the TV.
This is the whole original idea, and it deliberately skips every pipeline in Part 2.

What it skips, on purpose: no yaw auto-detection, no effect-IR batch, no OCR, no
Addressables, no voice, no math, no audio catalog, no damage shader. Those are Part 2 and
you may never want some of them.

## N1 · Forge-lite (1 evening)
- Hand-pick **~20 species** your boys actually play. Download those GLBs directly.
- Open each in any glTF viewer, note which way it faces, hand-write a 20-line
  `manifest.json` (yaw, scale, pivot). **Twenty models is twenty minutes of eyeballing** —
  the whole automated yaw pipeline (M0) exists only because 1,300 is not 20.
- Pull HP, types, weakness and 2 attacks for those cards straight out of
  `pokemon-tcg-data` with a short script. Hand-fix anything odd. **No IR batch.**
- Drop the GLBs in a Unity folder. No bundles, no packs.

**AC:** 20 prefabs, correctly sized and facing +Z, and a JSON with their card data.

## N2 · Table demo (1 evening)
- Unity 6 + AR Foundation. Photograph your boys' two favourite cards, use those two images
  as `ARReferenceImage` targets — hardcoded, no recognition.
- Creature spawns above each card, hovers with a sine bob, Y-constrained `lookAt` so the
  two face each other. Screen-space HP bars.

**AC:** both creatures on the table, facing each other as you move the cards, 30 fps.

## N3 · Combat (1 evening)
- Tap an attack chip → damage → weakness ×2 → HP drain → KO → victory → rematch.
- **Three** generic VFX (melee lunge, projectile, beam), not 55. Hit flash, knockback,
  damage popup, screen shake.
- Read `spec/SPEC-battle.md` §§1–3 — implement the FSM and damage pipeline properly even
  here, because Part 2 builds on it. Skip §2's gates: Pure mode only.

**AC:** a full battle playable by tap with correct math on 10 sampled attacks.

## N4 · The capsule (1 evening)
- Summon: capsule arcs in → spins → opens → white-hot dissolve-in of the mesh → material
  lerp to real textures. Faint is the same timeline reversed.
- USB-C → HDMI to the TV.

**AC:** your boys react. That is the acceptance criterion.

> **Stop here if you want.** Four nights, near-zero cost, and a thing they will ask to play
> again. What they react to tells you which of Part 2 to build — better information than
> any plan.

---

# Part 2 · Expansion (any order, none required)

Each item stands alone and is demoable on its own. Milestone IDs are kept stable because
`HANDOFF.md`, `COST-CALIBRATION.md` and the SPEC files reference them.

## M0 · The real forge (≈ 1 week) — *unlocks: every species, every attack*
Replaces N1 once 20 species isn't enough.
- Fetch models, card DB, species data; integrity pass (0-byte and >4 MB files flagged).
- Scale + pivot normalization from species height / bounding box.
- Yaw auto-detection: convention clustering → 16-view render vs. official-art CLIP match →
  VLM tie-break. Contact-sheet QA (100 fronts per page) + `forge fix <id> --yaw N`.
- Effect-IR batch for every unique attack; schema-validated; cached. `--dry-run` and
  `--golden` must both exist and be used before any paid run. Pack 10–20 attacks per
  request and run the day-one model tournament (SPEC-ir §§5.1–5.2).
- Unity batch step: prefabs with baked transform → Addressables (ASTC, 2 LODs).

**AC:** `forge verify` passes; manifest covers every fetched species; a random 30-species
sample renders front-facing at consistent real-world scale; `forge ir --golden` passes per
SPEC-ir §6; full IR validates and is `needsReferee=false` for ≥ 95 % of attacks.

## M2 · Card identification (≈ 1 week) — *unlocks: any card, not just two*
- Vision rectangles → rectify → OCR name + collector number → local DB → runtime
  `ARReferenceImage` from the camera crop → tracked anchor.
- Tracking-loss grace: hold last pose 3 s, then fade; re-acquire silently.
- Unknown-card flow (Recent / Search / Manual) and `known-cards.json` pHash learning.

**AC:** 20 random cards from the binders identified ≥ 90 % within 2 s under living-room
light; an obscured card reaches a playable state via Pick-a-card in ≤ 15 s; a card picked
manually once locks by pHash next time without OCR.

## M4+ · Full combat VFX (≈ 3 evenings) — *unlocks: attacks that look like their element*
- Element × archetype VFX (11 elements × 5 archetypes) replacing N3's three.
- Coin-flip UI driven by the effect IR; procedural lunge/recoil/hit-stop per archetype.

**AC:** correct math on 20 sampled attacks; each element visibly distinct.

## M6 · Luck & mercy (≈ 1 evening) — *unlocks: suspense*
- Luck slider; outcome decided at RESOLVING, revealed at impact; dodge/whiff/glance.

**AC:** 100 simulated attacks at each slider stop hit within ±5 % of target rate.

## M7 · Math Mode core (≈ 2 evenings) — *unlocks: it teaches them something*
**This is smaller than it looks.** The ten generators are ~300–400 lines total: L1 is
`a,b ∈ [1,4], a+b ≤ 5`; L9–L10 are the only fiddly ones and a `Fraction` type handles most
of it. Everything that used to make this milestone look like 1.5 weeks has moved to where
it belongs — the spoken-number parser to M8, profiles and the parent screen to M10.
- **Constraint checkers first, authored separately from the generators** (see `HANDOFF.md`
  "Oracle authorship"). Use the strongest model available for the checkers.
- Ladder L1–L10 generators + the 10,000-case test per level.
- Choice mode only: 3–4 big TV-readable buttons with near-miss distractors. Tap to answer.
- Wire into the battle as `gate: math` (SPEC-battle §2) with a fixed default penalty.

**AC:** generator tests pass for every level (range, no negatives, exact division,
simplified fractions, unique choices with exactly one correct); a 4-year-old completes a
battle by tap on L1 with no adult input.

## M8 · Voice (≈ 1 week) — *unlocks: calling out attacks*
- Native plugin per `SPEC-native.md` (Editor mock first, device second); push-to-talk;
  state-scoped contextual strings; confirmation chip.
- **Both parsers live here** — attack phrases *and* spoken numbers/fractions. Same
  contextual-strings machinery, same fuzzy matcher; splitting them across milestones was a
  filing error.
- Open answer mode for Math Mode: numpad + voice.

**AC:** ≥ 90 % attack recognition for an adult at 2 m; ≥ 70 % for the 7-year-old; number
answers ≥ 90 % for both. Tap fallback always available.

## M5 · Audio (≈ 3 evenings) — *unlocks: it sounds like a game*
- Event catalog wired; mixer buses; variation (variants + pitch); ducking while mic is open.

**AC:** every FSM transition has sound; no clipping over HDMI; no identical SFX within 3 s.

## M9 · Damage stages (≈ 3 evenings) — *unlocks: they look hurt*
- One shader driven by `damage01`: triplanar grime, desaturation, red rim at heavy;
  posture + smoke by band.

**AC:** three visibly distinct bands on 10 random species with no per-species tuning.

## M3+ · Summon polish (≈ 1 evening)
- Asset load moved *inside* the capsule timeline so it hides Addressables streaming.

**AC:** cold-load of an unseen species shows no visible hitch; summon ≤ 2.5 s.

## M10 · Profiles, settings & first-run (≈ 1 week) — *unlocks: two kids, different levels*
Absorbs everything that was misfiled under Math Mode.
- Profiles & side binding; per-kid math level, answer mode, timer, mercy, `damageScale`,
  thematic, read-aloud. Parent-gated settings screen. Referee strip. Stats per level.
- Pack download + hash verification + `isExcludedFromBackup`; HDMI test.

**AC:** both boys' profiles configured and bound to sides; crash-free 30-minute session.

---

## Weights (for `COST-CALIBRATION.md`)

Relative agent-token weight, M0 = 1.00. Part 1 is ~0.50 in total.

| Item | Weight |
|---|---:|
| N1–N4 (all four nights) | 0.50 |
| M0 real forge | 1.00 |
| M2 card identification | 0.90 |
| M4+ full VFX | 0.45 |
| M6 luck & mercy | 0.20 |
| **M7 math core** | **0.45** |
| M8 voice (both parsers) | 0.95 |
| M5 audio | 0.35 |
| M9 damage stages | 0.40 |
| M3+ summon polish | 0.20 |
| M10 profiles, settings, first-run | 1.05 |
| **Everything** | **6.45** |

## v2 backlog
Streak criticals · adaptive level nudges · instant replay from the event log · bench/switch ·
status conditions · second-device referee remote · custom content packs.
