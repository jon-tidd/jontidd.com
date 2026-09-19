# Research prompt — lowest-cost build strategy

Paste the block below into a model with **web search enabled** (Cursor, ChatGPT, Gemini,
Perplexity, Claude — ideally two or three, then compare). Attach or paste `README.md`,
`BUILD-PLAN.md` and `DECISIONS.md` from this folder if the tool accepts files.

It asks for a **routing plan**, not a number. A number from a model that hasn't run your
build is fiction; a routing plan is something you can execute and then measure with
`COST-CALIBRATION.md`.

---

```
I'm building a personal project and I want maximum quality at minimum cost. I need you to
research the CURRENT landscape (search the web — your training data is likely stale on
model pricing and availability) and give me a concrete execution plan.

## The project

An iPad AR app. The camera watches a table where my kids put down trading cards; a 3D
creature floats above each card, they call out attacks by voice, and a simple 1-v-1 battle
resolves with real card math. There's a "Math Mode" where landing a hit depends on
answering a grade-appropriate math question.

A complete specification already exists — roughly 12 documents covering architecture, the
battle state machine, a math-question ladder, an offline content pipeline, a Swift/Unity
native plugin contract, and JSON Schemas. THE DESIGN IS DONE AND IS NOT UP FOR DEBATE. I am
only asking about execution cost.

## The work, by milestone

| # | Milestone | Nature of the work | Relative size |
|---|---|---|---|
| M0 | Content pipeline ("forge") | Python CLI: fetch ~1,300 GLB models + a card database, validate, normalize scale/pivot, auto-detect each model's facing direction via CLIP/VLM, run a classification batch, build asset bundles | 1.00 |
| M1 | AR table demo | Unity 6 + AR Foundation; anchor models to tracked cards | 0.35 |
| M2 | Card identification | iOS Vision rectangle detection + OCR, native Swift plugin, C# integration | 0.90 |
| M3 | Summon sequence | Unity animation timeline + shader dissolve | 0.45 |
| M4 | Combat core | Pure-logic C# state machine, damage pipeline, unit tests, VFX wiring | 1.10 |
| M5 | Audio | Unity AudioMixer wiring, ~30 sound events | 0.35 |
| M6 | Probability mode | Small: config + a statistical test | 0.20 |
| M7 | Math Mode | 10 question generators + 10,000-case tests each, UI, profiles | 1.40 |
| M8 | Voice | iOS Speech via native plugin, fuzzy phrase matching | 0.80 |
| M9 | Damage shader | One Shader Graph material, triplanar projection | 0.40 |
| M10 | Polish | Download flow, stats, integration debugging | 0.70 |

Total ≈ 7.65 × M0. Estimated 7–8 weeks of evening work for one developer with AI
assistance. Languages: Python, C#, Swift, HLSL/Shader Graph.

## Why aggressive cost optimization is unusually safe here

The spec was deliberately written with MACHINE-CHECKABLE acceptance gates:
- Every produced artifact must validate against a JSON Schema.
- The classification batch has a 38-case hand-labelled golden set it must reproduce.
- Math generators must survive 10,000 generated questions per level against explicit
  constraint checks.
- The content pipeline has a `verify` command that exits non-zero on any gap.
- The battle engine is pure logic emitting a deterministic event log, so it is unit-testable
  end to end.

This means cheap-model output can be VERIFIED rather than trusted. Factor that in — it
should make you more aggressive about cheap models than you'd normally be.

## One workload deserves separate analysis

Inside M0 there's a batch classification job: take ~7,500–11,000 short English strings
(average 59 characters) and emit a structured JSON object for each, conforming to a fixed
schema. They're independent, small, and there's a 38-case golden set to verify against.
Estimated $70–102 on Claude Opus 5 via its Batch API.

This looks like the single best candidate in the project for a cheap or open-weights model.
Analyze it separately from the coding work — it's an API batch job, not agentic coding, and
the economics are completely different.

## What I want from you

1. **Current landscape.** What are today's genuinely cost-effective options for agentic
   coding? Cover at minimum: Cursor (and its Auto/router modes), Claude Code, OpenRouter
   with open-weights models, Cline/Roo Code, Aider, Windsurf, GitHub Copilot, and any
   provider batch APIs. Give real current prices with dates and sources — flag anything you
   are inferring rather than reading.

2. **A routing table.** Map task TYPE to the cheapest model that can do it reliably, then
   map that onto my milestones. I expect the answer to differ by task: boilerplate and test
   scaffolding vs. subtle concurrency in a native plugin vs. shader iteration vs. one-shot
   structured classification. Tell me which milestones can run on cheap or open models and
   which genuinely need a frontier model — and say WHY for each, not just which.

3. **Harness recommendation.** Which tool/harness for which milestone, and why. Include
   subscription-vs-metered math at my volume. Flag any harness that meters in a way that
   punishes long agent sessions.

4. **The batch job, separately.** Best quality-per-dollar for ~10,000 structured-output
   classifications with a golden set for verification. Consider open-weights models,
   provider batch APIs (usually ~50% off), and a two-tier approach where a cheap model does
   the bulk and a frontier model re-runs only low-confidence items. Give me an estimated
   cost for each option.

5. **Where NOT to cheap out.** Name the specific places where a cheap model will cost me
   more in rework than it saves, and how I'd recognize it early.

6. **A measurement protocol.** How do I verify your plan is working after the first
   milestone instead of at the end? What do I log, what's the early warning that a cheap
   model is producing expensive rework?

## Ground rules for your answer

- Search for current pricing. Say the date of your sources. Do not quote prices from memory.
- Where you're uncertain, say so explicitly rather than smoothing over it.
- I want a plan I can execute Monday, not a survey of the market.
- Do NOT give me a single total cost estimate as your headline. I will measure the first
  milestone myself and extrapolate. Give me the routing strategy that makes that measured
  number as low as possible without hurting quality.
- Assume I am a competent developer who can review code, but I am doing this on evenings
  and weekends and my time has real value.
```

---

## After you get answers

1. Run the same prompt through **two or three different models** and diff their routing
   tables. Consensus on "this needs frontier" is a strong signal; disagreement tells you
   exactly where to run your own experiment.
2. Pick the cheapest plausible plan and run **M0 only**, per `COST-CALIBRATION.md`.
3. Compare what you actually spent against what the plan predicted. A plan that was 3× off
   on M0 will be 3× off on the project.
4. Track the **rework ratio**, not just spend. A model that costs a third as much but needs
   three attempts at `forge place` saved you nothing and cost you an evening.
