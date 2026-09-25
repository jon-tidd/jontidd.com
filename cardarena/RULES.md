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
