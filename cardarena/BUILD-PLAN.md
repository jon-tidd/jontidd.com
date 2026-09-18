# Build plan

Ordered so every milestone is demoable on its own and the load-bearing pieces come first.
Tap input is wired before voice so the whole game is testable by hand; Math Mode lands
before voice because multiple-choice tap needs no speech.

Estimates assume evenings/weekends with an AI pair; "AC" = acceptance criteria.

## M0 · Forge (≈ 1 week)
- Fetch models, card DB, species data; integrity pass (0-byte and >4 MB files flagged; fallback recorded).
- Scale + pivot normalization from species height / bounding box.
- Yaw auto-detection: convention clustering → 16-view render vs. official-art CLIP match → VLM tie-break.
- Contact-sheet QA renderer (100 fronts per page) + `forge fix <id> --yaw N` for outliers.
- Effect-IR batch generation for every unique attack text; schema-validated; cached.
- Unity batch step: prefabs with baked transform → Addressables (ASTC, 2 LODs).

**AC:** `forge verify` passes; manifest covers every fetched species; a random 30-species
sample renders front-facing at consistent real-world scale; IR validates against schema
and covers 100 % of attacks with `needsReferee=false` for ≥ 95 %.

## M1 · Table demo (≈ 3 days)
- Two hard-coded cards as reference images; models anchored above them; Y-constrained
  `lookAt`; screen-space HP bars.

**AC:** 30 fps for 5 minutes on the target iPad; models keep facing each other as cards move.

## M2 · Card identification (≈ 1 week)
- Vision rectangles → rectify → OCR name + collector number → local DB → runtime
  `ARReferenceImage` from the card's own art → tracked anchor.
- Tracking-loss grace: hold last pose 3 s, then fade; re-acquire silently.

**AC:** 20 random cards from the kids' binders identified ≥ 90 % within 2 s under living-room light.

## M3 · Summon (≈ 3 days)
- Capsule arc-in → spin → open → white-hot dissolve-in of the species mesh → material lerp.
- Asset load is *inside* this timeline; the sequence is the loading screen.
- Faint = the same timeline reversed.

**AC:** cold-load of an unseen species shows no visible hitch; summon ≤ 2.5 s end to end.

## M4 · Combat core, Pure mode (≈ 1 week)
- Battle FSM, turns, tap-to-attack, damage pipeline, weakness/resistance, coin-flip UI,
  damage popups, HP drain, KO → faint → victory → rematch.
- Element × archetype VFX (11 elements × 3 archetypes), procedural lunge/recoil/hit-stop.

**AC:** a full battle is playable by tap alone with correct math for 20 sampled attacks.

## M5 · Audio (≈ 3 days)
- Event catalog wired; mixer buses; variation (variants + pitch); ducking while mic is open.

**AC:** every FSM transition has sound; no clipping over HDMI; no repeated identical SFX within 3 s.

## M6 · Resolution modes: Luck (≈ 2 days)
- Luck slider; outcome decided at RESOLVING, revealed at impact; dodge/whiff/glance
  animations and popups.

**AC:** 100 simulated attacks at each slider stop hit within ±5 % of the target rate.

## M7 · Math Mode (≈ 1.5 weeks)
- Ladder L1–L10 generators + unit tests; choice and open answer modes; numpad; timer;
  mercy; profiles & sides; parent settings screen; referee strip.

**AC:** generator tests pass for every level (range, no negatives, exact division, simplified
fractions); a 4-year-old profile completes a battle by tap on L1 with no adult input.

## M8 · Voice (≈ 1 week)
- Native plugin; push-to-talk; state-scoped contextual strings; attack-phrase and
  number/fraction parsers; confirmation chip.

**AC:** ≥ 90 % correct attack recognition for an adult at 2 m; ≥ 70 % for the 7-year-old;
number answers ≥ 90 % for both.

## M9 · Damage stages (≈ 3 days)
- Shader driven by `damage01`: triplanar grime, desaturation, red rim at heavy; posture +
  smoke by band.

**AC:** three visibly distinct bands on 10 random species with no per-species tuning.

## M10 · Polish & first-run (≈ 1 week)
- Pack download flow + verification + `isExcludedFromBackup`; stats screen; HDMI test;
  settings gate; crash-free 30-minute session.

## v2 backlog
Streak criticals · adaptive level nudges · instant replay from the event log · bench/switch ·
status conditions · second-device referee remote · custom content packs.
