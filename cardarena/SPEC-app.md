# SPEC · App runtime

Everything here runs on the iPad with no network. Subsystems are listed in data-flow order.

## 1. Physical setup & ergonomics

- iPad on a stand/tripod at ~45°, 50–80 cm above the table, framing both play areas.
  Cards sit in two fixed-ish zones (left / right); the app doesn't require exact placement.
- USB-C → HDMI to the TV (near-zero latency; AirPlay adds 100–300 ms and softens the feed).
  Audio rides the HDMI link; the mic stays on the iPad — see SPEC-audio ducking.
- Kids interact by **voice** (push-to-talk button, large, one per side) and by walking up to
  tap; the parent uses the referee strip. All type is TV-readable (≥ 40 px at 1080p).

## 2. Card detection, identification, tracking

### 2.1 Why not image targets for identification
ARKit's reference-image library is practical to ~100 images and tracks ≤ 4 at once; the
card database is > 20 000 cards. So identification is **OCR**, and image tracking is used
only *after* identification, with a reference image built at runtime.

### 2.2 Pipeline (native plugin + Unity)
1. AR Foundation provides camera frames (CPU image, ~10 fps sampling in SCANNING).
2. Plugin: `VNDetectRectanglesRequest` (aspect ≈ 0.716, min size 8 % of frame) → up to 2 candidates per zone.
3. Rectify each candidate to 512×716; `VNRecognizeTextRequest` (accurate, language en) on
   the **name band** (top 12 %) and the **collector-number band** (bottom-left 10 %).
4. Match: name fuzzy-matched (≤ 2 edits) against the card DB, then disambiguated by
   `number/setTotal` if read; else pick the most common printing. Require 3 consistent
   reads over ~0.5 s before locking.
5. On lock: fetch the card's own art from the pack (`cards/{id}.jpg`), create an
   `ARReferenceImage` (physical width 63 mm) at runtime, add to the session's tracked set.
6. The tracked image anchor is the creature's root transform. Two tracked images max.

### 2.3 Card DB
`pokemon-tcg-data` JSON compacted by the forge into a single SQLite (name, id, set, number,
hp, types, weaknesses, resistances, attack ids) ≈ 50 MB with images. FTS on name.

### 2.4 Tracking loss
On anchor loss: hold the last pose 3 s (creature keeps idling), then fade to 40 % and show a
"lost card" glyph on that side's HUD. Re-acquisition is silent. State never changes on loss.
A *different* card locked on that side triggers the swap rule (SPEC-battle §1).

## 3. Asset loading

- Pack lives in `Application Support/CardArena/pack/`, `isExcludedFromBackup = true`.
- Addressables *(Unity)* keyed by species id; ASTC 6×6 textures; LOD0 ≤ 30 k tris, LOD1 ≤ 8 k.
- Load starts the instant a card locks and is hidden inside the summon sequence (§4).
  Budget: ≤ 400 ms to first frame from local disk; two creatures resident (~20–40 MB).
- Missing/corrupt asset → **billboard fallback**: the card's art as an upright quad with
  the same VFX, HP bar, and damage shader. The game never blocks on a missing model.

## 4. Summon sequence (also the loading screen)

```
0.00  capsule arcs in from the side's edge, lands on the card       (asset load begins)
0.60  capsule spins, seam glows, ramps hum
1.20  snap-open: white flash + radial burst
1.25  creature mesh appears in unlit white-hot emissive, scale 0→1 over 0.5 s with noise dissolve
1.75  material lerps to real textures over 0.4 s; capsule closes and fades; idle begins
```
If the asset isn't ready by 1.20 the capsule keeps spinning (max +2 s), then falls back to §3.
**Faint** plays the same timeline reversed (dissolve to white, shrink, recall into capsule).
The capsule is a generic engine asset; the content pack may override its model/sounds.

## 5. Placement, facing, idle

- Root = card anchor + `manifest.pivot`; rotate by `manifest.yaw`; scale by `manifest.scale`
  so heights are real-world consistent (via species height), clamped to 8–35 cm for the table.
- Hover: root elevated 3 cm + sine bob (amplitude 0.6 cm, 0.8 Hz, phase random per creature).
- Facing: every frame, yaw toward the opponent's root, **Y-axis only**, slerp 6 rad/s. With
  one creature present, face the camera.
- Idle animation: use the GLB's first animation clip if present; otherwise procedural
  (bob + 2° sway + occasional 5 % squash "breath").

## 6. Attack animation = element × archetype

Effect IR supplies `element` (11 TCG energy types) and `archetype` ∈ `melee | projectile | beam | aoe | self`.
Everything is procedural on the root transform or emitted as VFX, so it works on any mesh.

| Archetype | Attacker motion | Delivery | Impact |
|---|---|---|---|
| melee | crouch 0.2 s → lunge to 70 % of the gap 0.15 s → recoil | none | at arrival |
| projectile | rear back → snap | element projectile, 0.35 s flight, arc | on arrival |
| beam | 0.4 s charge glow at bbox-front-top → hold | element beam 0.5 s | at beam start + 0.1 s |
| aoe | hop → slam | element ring expands from defender's floor | at ring reach |
| self | glow pulse | none | none (effect popup only) |

Impact (all): defender flash white 2 frames → red tint 0.3 s → knockback 4 cm + 8° tilt →
hit-stop 80 ms (heavy: 120 ms) → damage popup → HP bar drains over 0.6 s → camera shake
(screen-space, 0.3 s). **MISS**: defender side-steps 6 cm at impact-time; delivery continues
past. **GLANCE**: half-size impact, "Glancing!" popup, no hit-stop.

Emission point for beams/projectiles: bounding-box front-top-center (works without a rig).

## 7. Damage stages shader (one material, all species)

Input `damage01 = 1 − hp/maxHp`. Bands: clean < 0.34 ≤ light < 0.67 ≤ heavy.

- Triplanar grime/scorch overlay, weight = smoothstep(0.2, 0.9, damage01) — no UVs needed.
- Albedo desaturation 0 → 45 % and darkening 0 → 20 % across the range.
- Heavy: slow red rim pulse (0.5 Hz), idle bob amplitude −40 %, lean forward 6°, stagger
  every 6–10 s, persistent smoke wisp from bbox top.
- Light: occasional spark burst every 4–8 s.
Billboard fallback receives the same material.

## 8. Voice

- Native plugin wraps `SpeechAnalyzer` (iOS 26+) / `SFSpeechRecognizer` (on-device, en-US).
- **Push-to-talk** per side (big button). No wake word in v1.
- **State-scoped contextual strings**: `READY` → active side's creature name + its attack
  names (+ "go", "cancel"); `QUESTION` → the choices, or number/fraction words.
- Matching: normalize → Levenshtein + Double Metaphone against the current grammar; accept
  if best score ≥ 0.75 and margin over second ≥ 0.15; else show the top 2 as tap chips.
- Attack phrase forms accepted: "<name> <attack>", "<attack>", "use <attack>", "<name>, use <attack>".
- Confirmation chip shows the parsed attack for 1.5 s; "go"/tap confirms, "no"/tap cancels.

## 9. HUD (screen-space, TV-first)

Top: two HP bars with numeric HP, creature names, type glyphs, turn marker. Center: damage
popups, coin, question card. Bottom: push-to-talk buttons L/R, attack chips for the active
side (tap fallback), referee strip (hidden until long-press). Everything ≥ 40 px at 1080p.

## 10. Storage

`profiles.json`, `config.json`, `stats.json`, `battles/<seed>.log.jsonl` in Application
Support (backed up — they're tiny); the pack directory excluded from backup.
Settings are parent-gated by a 1-second long-press on the corner glyph.

## 11. Performance targets

30 fps sustained (60 on Pro), ≤ 250 MB resident, thermal-safe for 30 min. Camera sampling
for OCR drops to 2 fps once both cards are locked. AR session pauses in the settings screen.
