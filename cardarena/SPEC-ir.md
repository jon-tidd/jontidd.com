# SPEC · Effect IR generation (the forge's one LLM batch)

The single highest-leverage artifact in the project: one batch run turns every attack in
the card database into the structured `effect-ir` the engine interprets. Get the rubric
right once; the output is cached forever and shipped in the public repo (it contains no
card text). This document is the rubric, the exact prompt, the API mechanics, the cost,
and the acceptance test.

## 1. Division of labour

| Field | Who decides | Rule |
|---|---|---|
| `element` | **forge (deterministic)** | `firstNonColorless(cost) ?? (elementHint if ≠ "None") ?? "Colorless"` |
| `intensity` | **forge (deterministic)** | `clamp(ref / eraMax, 0.1, 1.0)` rounded to 2 dp; `ref` = `fixed.value` · `plus.base` · `times.perUnit × 2`; text-only = 0.15. `eraMax` by set release year: ≤ 2010 → 100 · 2011–2016 → 150 · 2017–2022 → 250 · ≥ 2023 → 300 |
| `needsReferee` | **forge (derived)** | `units.source ∈ {prompt, energyCount}` or `copyAttack` anywhere or damage string unparseable |
| `hash`, `cardIds` | forge | `sha1(name\|text\|damage)`; every card carrying that exact attack |
| `damage.kind` | forge validates | fixed by the damage string; the model must agree or the item is re-run |
| everything else | **model** | per the rubric below |

The model never sees or decides anything the forge can compute. This keeps the batch
cheap, the output stable across runs, and the review surface small.

## 2. Structured output schema

The LLM-facing schema is **derived** from `schemas/effect-ir.schema.json` by removing the
forge-owned keys `hash, cardIds, element, intensity, needsReferee`, and marking every
remaining key `required` (recursively; `additionalProperties: false` is already set).
`forge verify` asserts the derived schema is a strict subset of the canonical one. The
canonical schema is written flat (no `oneOf`, no `$ref`, no `null` inside `enum`;
"None" sentinels instead) precisely so this derivation is mechanical.

## 3. The prompt

**System** (cached across the batch — `cache_control: {"type": "ephemeral"}` on this block):

```text
You classify one trading-card attack into a fixed JSON structure that a game engine
animates and evaluates. Output only the JSON object described by the schema. Rules take
priority over intuition; when two rules conflict, the earlier rule wins.

INPUT: {"name", "cost": [energy types], "damage": string, "text": string}

1. DAMAGE (damage.kind is fixed by the damage string; you fill the rest)
- digits only -> kind fixed; value = digits; base = perUnit = 0; cap = null; units.source = none.
- ends with "+" -> kind plus; base = digits. From the text: perUnit = the "N more damage"
  amount; units.source = what it is counted per (section 2); cap = the maximum ADDED damage
  when the text limits it (e.g. "extra Energy after the 2nd doesn't count" with 10 per ->
  cap 20; a flat "if X, 50 more damage" -> perUnit 50, cap 50); otherwise null.
- ends with "x" (multiplication sign) -> kind times; perUnit = digits; units.source = what
  it is multiplied by; base = 0; cap = null.
- empty or anything else -> kind none; every number 0; cap null.

2. units.source (first that applies)
- coinHeads: per heads flipped.
- damageCounters: per damage counter on a Pokémon; of = self or defender.
- defenderDamaged: a flat bonus if the opponent's Active already has damage counters; of = defender.
- energyCount: per Energy attached; of = self or defender. promptType = count.
- prompt: any other condition the engine cannot know (a Knock Out last turn, cards in
  hand, ...). promptType = yesNo for a flat bonus, count for per-something. promptLabel = your
  own question for a referee, at most 40 characters, in your own words - never quote the text.
- constant: the text fixes the number; set constant.
- none: no units.
units.of defaults to self. promptType is none unless source is prompt or energyCount.
promptLabel is "" unless promptType is not none.

3. COIN FLIPS
- count = number of coins ("Flip a coin" = 1, "Flip 2 coins" = 2). "until you get tails" ->
  untilTails true, count 0.
- Effects conditional on heads go in onHeads, on tails in onTails: extraDamage (flat),
  status (on the defender), selfDamage, attackFails ("this attack does nothing"), sideEffects.
- When the damage itself scales per heads, that is units.source = coinHeads, NOT onHeads.extraDamage.
- A coin that only decides a side effect (e.g. prevent damage next turn) still sets count.

4. UNCONDITIONAL EFFECTS (conditional ones live under coinFlips)
- status: Special Condition applied to the defender ("The Defending Pokémon is now Asleep").
- selfStatus: applied to the attacker ("This Pokémon is now Confused").
- selfDamage: "does N damage to itself" / "also does N damage to itself".
- heal: "remove N damage counters" -> N x 10; "remove all damage counters" -> healAll true, heal 0.

5. sideEffects - list every one that applies:
discardSelfEnergy, discardDefenderEnergy, cantAttackNextTurn ("can't attack during your
next turn"), cantUseThisAttackNextTurn, preventDamageNextTurn, switchDefender, benchEffect
(anything about Benched Pokémon), copyAttack (uses another Pokémon's attack),
recoverConditions, searchOrDraw (deck / discard pile / hand), other.

6. precondition: none; defenderAsleep ("can't use unless the Defending Pokémon is Asleep");
defenderDamaged; other (any other "you can't use this attack unless ...").

7. ARCHETYPE - how the attack is animated. Apply in this order; first match wins.
a. self - damage.kind is none AND nothing targets the defender (heal, protect, search, copy,
   switch, bench-only). A status-only attack on the defender is NOT self.
b. aoe - the name or text implies the ground, weather, a storm, an explosion, a whirlpool
   or tornado, a body slam from above (quake, stomp), effects on several Pokémon, or a
   Gigantamax / Dynamax scale attack (names with G-Max or Max).
c. melee - the name contains a contact word: Tackle, Slam, Punch, Jab, Kick, Bite, Claw,
   Scratch, Stab, Hammer, Headbutt, Crunch, Slash, Toss, Charge, Edge, Impact, Gnaw, Flail,
   Knuckle, Fang, Horn, Tail, Attack, Assault, Wound, Bash, Agility, Quick, Dash, Rush.
d. projectile - the name contains a thrown-object word: Sting, Needle, Jolt, Shot, Shock,
   Bomb, Missile, Spit, Seed, Leaf, Rock, Ball, Sphere, Orb, Star, Spike, Web, Bubble, Gun,
   Toxic, Poison.
e. beam - the name contains a stream word: Beam, Ray, Blast, Bolt, Thunder, Flame, Fire,
   Spin, Breath, Wave, Pulse, Psychic, Psy, Hypnosis, Sing, Screech, Laser, Cannon, Pump.
f. otherwise default by the first coloured Energy in cost: Fire, Water, Lightning, Psychic,
   Dragon, Fairy -> beam; Fighting, Grass, Metal, Darkness, or no coloured Energy -> melee.
Word matching is case-insensitive substring ("Blaster" matches Blast, "Twineedle" matches Needle).

8. elementHint - only when the attack NAME plainly names an element: Fire/Flame/Burn -> Fire;
Water/Hydro/Aqua/Bubble/Pump -> Water; Thunder/Electric/Volt/Shock/Spark -> Lightning;
Psychic/Psy/Confuse/Hypno -> Psychic; Leaf/Solar/Seed/Vine -> Grass; Dark/Shadow -> Darkness;
Metal/Iron/Steel -> Metal; Fairy/Moon -> Fairy; Dragon -> Dragon; Rock/Karate -> Fighting.
Otherwise "None". The engine uses this only when the cost has no coloured Energy.

9. confidence - 1.0 when every field follows directly from these rules; lower when you had to
interpret. Below 0.7 the attack is routed to human review.
```

**User** (one per unique attack): the input object as JSON, nothing else.

```json
{"name": "Hydro Pump", "cost": ["Water","Water","Water"], "damage": "40+",
 "text": "Does 40 damage plus 10 more damage for each Water Energy attached to Blastoise but not used to pay for this attack's Energy cost. Extra Water Energy after the 2nd doesn't count."}
```

## 4. API mechanics (Python forge)

- **Model:** `claude-opus-5` (adaptive thinking is on by default — omit `thinking`; do not
  send `temperature`, it is rejected on this model). `output_config: {"effort": "medium",
  "format": {"type": "json_schema", "schema": <derived schema>}}`. `max_tokens: 2048`.
- **Transport:** the Message Batches API (`client.messages.batches.create(requests=[...])`,
  poll `processing_status == "ended"`, iterate `client.messages.batches.results(id)`), keyed by
  `custom_id = hash`. Results arrive in any order. 50 % of list price. Chunk at 10 000
  requests per batch.
- **Caching:** the system block carries `cache_control: {"type": "ephemeral"}`. Verify on the
  golden run that `usage.cache_read_input_tokens > 0`; if it is 0 the rubric is under the
  model's minimum cacheable prefix and caching simply doesn't apply (≈ 5 % cost impact).
- **Per-item failure path:** `result.type == "errored"` with a server error → resubmit;
  schema-invalid or `damage.kind` disagreement → one single-shot re-run with
  `client.messages.parse(...)`; `stop_reason == "refusal"` (unlikely for card text) → re-run
  single-shot with `fallbacks: "default"` and beta `server-side-fallback-2026-07-01`.
  Still failing → write a stub: `archetype` by rule 7f, all effects empty, `confidence: 0`,
  `needsReferee: true`, and log to `review/failed.jsonl`.
- **Post-processing (forge):** compute `element`, `intensity`, `needsReferee`, `hash`, `cardIds`;
  validate against the canonical schema; write `effect-ir.json` sorted by hash.
- **Cache:** results keyed by `hash` + rubric version. A rubric edit bumps the version and
  only re-runs items whose rule outcome could change (or everything, if in doubt — it's cheap
  relative to the argument).

## 5. Cost (measured inputs, not guessed)

Measured from the real card data rather than estimated:

- **176 English sets, 20,530 cards**; Pokemon cards (the only ones with attacks) are ~62 %
  of that, so **~12,700 cards**.
- **1.32 attacks per card** (measured across an 8-set sample spanning ex1 → sv1).
- **Deduplication**: unique-attack ratio falls steadily as the corpus grows — 0.96 at one
  set, 0.77 at eight, still declining. Across 176 sets expect **0.45–0.65**.
- **~7,500–11,000 unique attacks** to classify.
- **Attack text averages 59 characters (~15 tokens)** — input per item is tiny; output and
  thinking dominate the bill.

Per item, packed 20 to a request: **~140 input tokens** (the ~1,800-token rubric amortised
across the pack, plus ~50 for the attack itself) and **~300 output tokens** (the IR object;
measure it, it is the variable that moves the bill). At 10,000 items that is ~1.4M input and
~3M output. Batch API pricing (50 % off):

| Option | Full run |
|---|---|
| Cheapest structured-output tier (GPT-5-nano class, Gemini Flash-Lite) | **~$2** |
| `claude-haiku-4-5` batch | ~$8 |
| `claude-sonnet-5` batch | ~$16 |
| `claude-opus-5` batch | ~$41 |
| **Two-tier: cheapest bulk + Sonnet 5 on a ~10 % tail** | **~$4** |
| **Two-tier, Anthropic only: Haiku bulk + Opus 5 on a ~10 % tail** | **~$12** |

**This is not a cost decision.** The entire spread is under $40 — less than one evening of
your time. Pick on *quality* via the tournament below and take whichever passes; only run
`--dry-run` to confirm the count and the output-token figure, because that last one moves
the projection by ~2× and is the only number here worth measuring.

### 5.1 Two free levers, applied before choosing a model

**Pack 10–20 attacks per request.** The ~1,800-token rubric dominates input when each
request carries one item. Packing amortizes it across the batch: input per item drops from
~1,850 tokens to ~140, roughly halving the total bill with no quality trade and no reliance
on caching. Prompt caching inside a 24-hour batch window is unreliable (short TTL), so
packing is the deterministic version of the same saving. One malformed response costs 20
items instead of 1 — the schema-validate-and-retry loop already handles that; retry the
pack, then fall back to single items for a pack that fails twice.

**Use `strict: true` on the tool schema** so arguments are guaranteed schema-valid and the
JSON Schema gate never sees malformed output.

### 5.2 Day one: run a model tournament on the golden set

Do not pick a model and hope. Before any M0 coding, run the **exact production prompt and
schema** against all 38 goldens on several candidates at once. It costs a few dollars, takes
under an hour, and decides a $70 question with your own data instead of a leaderboard.

Candidates, cheapest first: an ultra-cheap structured-output model (e.g. a GPT-5.6-mini
class or `claude-haiku-4-5`), a cheap open-weights model, `claude-sonnet-5`, and
`claude-opus-5` as the quality ceiling for reference.

Score each on: `schema_valid`, exact semantic match, `damage.kind` agreement with the
deterministic derivation, `needsReferee` agreement, `archetype` agreement, retry count, and
mean output tokens.

**Decision rule: the cheapest candidate that clears 38/38 with no schema failures wins.**
When one misses by a little, step *one rung* up the ladder — never jump from "missed two"
to Opus. Sonnet 5 Batch is ~$28 and Opus is ~$34 packed; the whole spread is a rounding
error against one evening of your time, so stop optimizing once something passes.

Production run: bulk on the winner, then escalate only suspicious rows to one tier up.
Escalate on a `confidence` below 0.7, any enum outside the expected distribution,
disagreement with the deterministic `damage.kind`, a schema failure that survives one
retry, or a random 3 % audit. At a 5–15 % escalation rate this adds a couple of dollars.

**Token-mix caveat for `--dry-run`:** output per item swings roughly 250 → 700 tokens
depending on whether the model reasons before emitting. A cheap model in pure
structured-output mode sits near the bottom of that range; an Anthropic model with adaptive
thinking sits near the top. Measure it from a 100-item sample rather than assuming — that
one variable moves the projection by ~2×.

**`forge ir --dry-run` is mandatory before any paid run.** It must print the exact unique
count after dedup, the token estimate from a 100-item sample, and the projected cost per
model, then exit without calling the API. No one should ever discover the size of this
bill by receiving it. `forge ir --golden` (38 cases) costs cents and gates correctness.

## 6. Acceptance (`forge ir --golden`)

`forge/golden-attacks.json` holds 38 hand-labelled attacks spanning every damage kind,
both `units.of` values, coin-flip shapes (per-heads damage, on-tails self damage,
heads-only status, heads-only side effect, coin-gated copy), unconditional status / self
status / self damage / heal-all, every side-effect class, a precondition, an all-Colorless
elementHint case, and all three eras. The fixture stores card ids + expected IR only; the
test loads attack text from the local card DB, so no card text is reproduced in the repo.

Pass criteria: 38/38 exact on `damage`, `coinFlips`, `status`, `selfStatus`, `selfDamage`,
`heal`, `healAll`, `sideEffects`, `precondition`, `elementHint`; `archetype` may disagree on
at most 2 (it is aesthetic); deterministic fields must match the forge's own rules. Then
sample 200 at random plus every `confidence < 0.7` for a human skim; expected touch-up
rate ≤ 3 %.
