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

## 5. Cost (order of magnitude; measure on the golden set first)

~15 000 unique attacks, ~120 input tokens each plus the ~1 800-token cached rubric, ~600
output tokens including thinking. Batch pricing:

| Model | Approx. full run | Notes |
|---|---|---|
| `claude-opus-5` | ~$125 | the default; output/thinking tokens dominate |
| `claude-sonnet-5` | ~$50 | user's call; run `confidence < 0.7` + golden failures again on Opus 5 |
| `claude-haiku-4-5` | ~$25 | user's call; same re-run rule |

The golden set alone costs cents and is the first thing to run after any rubric change.

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
