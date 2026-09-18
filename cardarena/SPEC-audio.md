# SPEC · Audio

## 1. Buses *(Unity AudioMixer)*
`Master` → `SFX` · `UI` · `Music` · `Cries`. Snapshots: `Normal`, `Listening` (SFX/Music
−12 dB, Cries −18 dB, 80 ms transition) applied whenever a push-to-talk button is held —
the TV speakers are in the same room as the iPad mic.

## 2. Variation
Every event has 2–3 variants chosen round-robin-random (never the same twice in a row) and
±6 % random pitch; impacts also ±2 dB. Heavy hits add an 80–120 ms **hit-stop** in sync.

## 3. Event catalog

| Event | Bus | Notes |
|---|---|---|
| `card.locked` | UI | soft chime; distinct per side (L lower, R higher) |
| `card.lost` | UI | short muted tick |
| `summon.arc` `summon.spin` `summon.open` `summon.materialize` `summon.recall` | SFX | capsule set; `open` layered with a burst |
| `attack.windup.<archetype>` | SFX | crouch/rear-back/charge |
| `attack.launch.<element>.<archetype>` | SFX | 11 elements × 3 (melee/projectile/beam); aoe uses element + `slam` |
| `impact.hit` `impact.heavy` `impact.glance` `impact.miss` | SFX | layered under the element's impact tail; `miss` = whiff + dodge swoosh |
| `damage.tick` | UI | HP bar drain tick, pitch rises as HP falls |
| `ko.faint` `ko.victory` | SFX/Music | descending + fanfare |
| `coin.spin` `coin.heads` `coin.tails` | UI | |
| `question.show` `question.correct` `question.wrong` `question.timeout` `timer.tick` | UI | `wrong` is gentle for level ≤ 3 |
| `ui.tap` `ui.confirm` `ui.cancel` `ui.listen.start` `ui.listen.stop` | UI | |
| `cry.<speciesId>` | Cries | **content pack only**; played at materialize and at KO (pitched −3 st) |
| `music.arena` | Music | optional low bed, ducked under any SFX |

## 4. Sourcing
Engine-shipped SFX must be CC0 / permissively licensed: Kenney audio packs, freesound
(CC0 filter), Sonniss GDC bundles. Element layers are built from these in a DAW; keep the
source manifest in `audio/SOURCES.md`. Species cries and any franchise chime are content-
pack assets fetched by the user's forge, never committed.

## 5. Read-aloud
`AVSpeechSynthesizer` (native plugin) reads `question.spoken` when the profile has
`readAloud: true` (default on for level ≤ 2). The timer starts after speech ends.
