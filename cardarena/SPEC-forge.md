# SPEC · The Forge (offline content pipeline)

Runs on a Mac. Python for everything except the final Unity batch step. Idempotent; every
stage caches by content hash; `forge verify` is the gate before a pack is used.

```
forge fetch     → raw/models/*.glb, raw/cards/*.json, raw/species.json, raw/cries/*.ogg (opt)
forge check     → integrity report (0-byte, >4 MB, unloadable, missing textures)
forge place     → manifest.json  (scale, pivot, yaw per species)   ← auto + bulk QA
forge ir        → effect-ir.json (every attack, schema-validated)
forge build     → pack/ (Addressables, ASTC, LODs, card art, SQLite)   [Unity batch mode]
forge verify    → all of the above cross-checked; exit non-zero on any gap
```

## 1. Sources
- Models: the community GLB library (`models/opt/regular/{id}.glb`, plus forms). Measured
  mean ≈ 196 KB, total ≈ 250 MB. Some entries are 0 bytes; one or two exceed 4 MB.
- Cards: `pokemon-tcg-data` JSON (English sets).
- Species: PokéAPI `height` (dm), names, official artwork (front-facing, used as ground truth), optional cries.

## 2. Integrity (`check`)
Flag: size 0, size > 4 MB, glTF validator errors, missing textures, > 100 k tris.
Flagged species get `fallback: "billboard"` in the manifest; the app never sees a broken file.

## 3. Placement (`place`) — fully automatic, verified in bulk

**Scale.** Compute the mesh bounding box; `scale = species.height_m / bbox.height`.
Clamp the *displayed* height in-app (8–35 cm); the manifest stores the true-scale factor.

**Pivot.** Translate so the bbox floor-center sits at the origin.

**Yaw (which way is the face).** Three passes, no hand labelling:
1. *Convention clustering.* Group files by source batch; if ≥ 80 % of a batch agree under
   pass 2, apply the batch's yaw to the rest and mark them `yawSource: "cluster"`.
2. *Render-and-match.* Headless render (Blender `--background` or a small pyrender script)
   at 16 yaws, 15° elevation; CLIP-embed each render and the species' official artwork;
   `yaw = argmax cosine`. Record the margin. `yawSource: "clip"`.
3. *VLM tie-break* when the CLIP margin < 0.03: send the 16-tile contact sheet to a vision
   model, ask for the tile index showing the face. `yawSource: "vlm"`.

**Bulk QA.** `forge sheet` renders every chosen front into 100-per-page contact sheets. A
back or side view stands out instantly in a grid of faces; fix outliers with
`forge fix <id> --yaw 180`, which writes `yawSource: "manual"`. Expect ≈ 3 % touch-ups.

Front-emission point for VFX is derived at runtime from the bbox, not stored.

## 4. Effect IR (`ir`) — one LLM batch, cached forever

Fully specified in **[SPEC-ir.md](SPEC-ir.md)**: the field-ownership split (the forge
computes `element`, `intensity`, `needsReferee`, `hash`, `cardIds`; the model decides the
rest), the exact rubric prompt, the derived structured-output schema, batch mechanics on
`claude-opus-5` (adaptive thinking on by default, no `temperature` — determinism comes from
the rubric, structured outputs, validation, and the cache), the per-item failure path, cost
by model, and the 38-case golden acceptance test in `forge/golden-attacks.json`.

The IR stores no card text — it is keyed by attack hash and card id — so it ships in the
public repo. Weakness/resistance strings (`"×2"`, `"+20"`, `"-30"`) are normalized
deterministically (no LLM) into `{op, value}` in the card SQLite.

## 5. Build (`build`) *(Unity batch mode)*
Import GLB → apply manifest transform to a prefab root → generate LOD1 (mesh simplifier,
25 %) → textures ASTC 6×6 (max 1024) → Addressables group per generation → card art JPEG
q80 → SQLite → `pack.manifest` with file hashes and pack version.
Expected pack size ≈ 600–800 MB with ASTC (measured raw GLBs ≈ 250 MB).

## 6. Outputs & ownership

| File | Contents | Public repo? |
|---|---|---|
| `manifest.json` | numbers only: per species `scale, pivot, yaw, yawSource, fallback` | **yes** |
| `effect-ir.json` | structured attack semantics, keyed by ids/hashes, no card text | **yes** |
| `pack/` | meshes, textures, card art, cries, SQLite with card text | **no** — device only |
| `sheets/` | QA contact sheets | no (contain models) |

## 7. `verify`
- Every species in `species.json` has a manifest entry (placed or fallback).
- Every attack in the card DB has an IR entry that validates.
- Every manifest yaw has a source; manual overrides ≤ 5 % (else re-run pass 2 with a fix).
- Pack hashes match; total size reported; exit 0.
