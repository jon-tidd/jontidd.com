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

## Definition of done for a milestone
Every acceptance criterion in `spec/BUILD-PLAN.md` for that milestone, demonstrated with
real command output or a screenshot. Not "implemented" — demonstrated.
