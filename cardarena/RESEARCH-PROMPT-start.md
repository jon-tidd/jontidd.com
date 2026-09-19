# Start prompt — "get me building this week"

Paste the block below into a model with **web search enabled**. Attach `README.md`,
`BUILD-PLAN.md`, `DECISIONS.md` and `HANDOFF.md` from this folder if the tool takes files.

Different from `RESEARCH-PROMPT-cost.md`, which asks for a cost routing plan across the
whole project. **This one asks for a setup you can execute this week, plus an honest verdict
on Cursor versus the alternatives.** Run it in two or three models and compare.

---

```
I have a finished specification for a personal project and I want to start building it this
week. I need a setup plan and an honest tool recommendation, not a redesign.

## The project

An iPad AR app. The camera watches a table where my kids put down trading cards; a 3D
creature floats above each card and the two face each other; a simple 1-v-1 battle resolves
with real card math. Output mirrors to the TV over HDMI. Later additions (optional): voice
commands, a grade-appropriate math gate on landing hits, a full-roster asset pipeline.

The spec is ~13 documents: architecture, battle state machine, math ladder, offline content
pipeline, a Swift/Unity native plugin contract, JSON Schemas, a decision record, and a build
plan. THE DESIGN IS SETTLED. I am asking about execution and tooling only.

## The plan I'm working to

**Part 1 — four evenings, ~12 hours total, this is what I want to start on:**
- N1 Forge-lite: hand-pick ~20 creature species, download those GLB models, hand-write a
  20-line manifest of scale/pivot/facing, pull HP and attacks for ~20 cards from a public
  card database. No automated pipeline of any kind.
- N2 Table demo: Unity 6 + AR Foundation. Two photographed cards as hardcoded image targets.
  Creature above each, hover bob, Y-constrained lookAt so they face each other, HP bars.
- N3 Combat: tap an attack, damage, weakness x2, HP drain, KO. Three generic VFX. The battle
  engine is pure logic emitting a deterministic event log; presentation replays the log.
- N4 Summon: a capsule arcs in, spins, opens, and the creature materialises via a white-hot
  dissolve. Faint is the same timeline reversed. HDMI to the TV.

**Part 2 — optional expansion, any order, none required:** full 1,300-species asset pipeline
with automated facing-detection; card identification via Vision OCR; 55 element-by-archetype
VFX; a luck slider; math mode; voice; audio catalog; a damage-stage shader; profiles and
settings. Roughly 33 more evenings if I did all of it.

Languages: Python (N1), C# (Unity), later Swift (native plugin), HLSL/Shader Graph.

## What makes this spec unusual

It was deliberately written with machine-checkable acceptance gates: every artifact
validates against a JSON Schema; a classification batch has a 38-case hand-labelled golden
set; math generators must survive 10,000 generated cases against explicit constraint checks;
the content pipeline has a `verify` command that exits non-zero on any gap; the battle
engine is unit-testable end to end via its event log. Cheap-model output can be VERIFIED
rather than trusted — factor that into your recommendation.

It also has an explicit rule that test oracles and constraint checkers must be authored by a
stronger model, separately from the implementation they check, because one model writing
both can converge on a self-consistent wrong answer and pass every test.

## What I want from you

### 1. An honest Cursor verdict

I am most likely to use Cursor. Tell me straight whether that's right, covering:
- What Cursor is genuinely best at for THIS project specifically — a mixed Unity C# +
  Python + Swift repo, evenings and weekends, one developer.
- What it costs me in 2026 given that its Auto mode stopped being flat-rate in August 2026.
  Which plan tier, and what actually consumes credits during agent work.
- Where its model routing helps and where it silently spends money.
- How to actually run it BYOK against OpenRouter: what that covers (Agent, Composer, Chat,
  Inline Edit) versus what stays on Cursor's own models (Tab, Apply), which plan tier it
  needs, and the correct base URL. Then tell me whether that setup — subscription for Tab
  and indexing, wholesale tokens for agent work — is better or worse than a fully-open
  harness, and why.

### 2. Cursor versus the alternatives, decided not surveyed

Compare against at minimum: Claude Code, Cline, Aider, GitHub Copilot, Windsurf, and any
router/aggregator worth naming. For each, the one-line reason I'd pick it over Cursor and
the one-line reason I wouldn't.

Then give me a verdict in this shape:
- Best tool for **Part 1 only** (12 hours of work) — and say whether optimizing this is even
  worth my time at that scale.
- Best setup for **Part 2**, if I keep going.
- The switching cost between them, honestly. Config time is real time.

### 3. A setup checklist I can execute in one evening

Concrete: accounts to create, extensions to install, config files to write, model profiles
to define, spend alerts to set, and what to verify works before I start N1. Assume macOS,
Unity 6, an iPad, and that I have not installed any AI coding tool yet.

### 4. A refinement pass on Part 1

Read the four nights above and tell me:
- What is missing that will block me on night 1 or 2 — specifically Unity/AR Foundation
  setup steps, iPad provisioning, or anything about getting GLB models into Unity with
  correct scale and orientation that the plan glosses over.
- Whether the four-night scope is realistic at ~3 hours per night, and if not, what to cut.
- The single most likely reason this stalls before night 4, and how to de-risk it now.

### 5. Ground rules

- Search for current pricing and say the date of your sources. Prices in my spec are
  explicitly not authoritative — several model reviews of this plan returned conflicting
  figures, so verify rather than repeating.
- Where you're uncertain, say so rather than smoothing over it.
- Do not redesign the app. Do not propose a different architecture, engine, or platform.
- I want a plan I can execute this week, not a market survey.
- Assume I am a competent developer whose evenings are scarce and worth real money.
```

---

## After you get answers

1. Run it in two or three models and diff the **verdicts**, not the prose. Where they agree
   on "use X for Part 1", that's signal. Where they split, the disagreement tells you the
   decision doesn't matter much — pick either and move.
2. Sanity-check any price against the vendor's own page before you spend. Five reviews of
   this plan produced five partly-conflicting price tables.
3. Do the §4 refinement answers first. A blocker on night 1 costs more than any routing
   decision in §1–2.
