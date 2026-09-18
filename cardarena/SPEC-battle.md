# SPEC · Battle

The battle engine is pure logic with no rendering or I/O dependencies. It consumes a
`BattleConfig`, two `Profile`s, two card records + their effect IR, and a seeded RNG; it
emits an ordered **event log** that the presentation layer plays back. This makes it unit-
testable, deterministic, and replayable.

## 1. State machine

```
SETUP ──► SCANNING ──► READY ──► DECLARED ──► [QUESTION] ──► RESOLVING ──► [COIN] ──► ANIMATING ──► APPLIED ──┬─► READY (swap turn)
  ▲                      ▲                                                                                     └─► KO ──► VICTORY ──► SETUP | SCANNING
  └──────────────────────┴───────────────────────── PAUSED (referee) can enter/exit from any state ────────────────────────────────┘
```

| State | Enter when | Exit when |
|---|---|---|
| `SETUP` | app start / rematch | sides bound to profiles, config chosen |
| `SCANNING` | setup done | both sides have an identified, tracked card |
| `READY` | both creatures summoned | attack declared by the **active side** |
| `DECLARED` | attack chosen (voice / tap / referee) | confirmed (auto after 1.5 s, or "Go", or tap) — cancel returns to READY |
| `QUESTION` | `gate == math` | answered, timed out, or referee-skipped |
| `RESOLVING` | always | outcome computed (synchronous) |
| `COIN` | outcome ≠ MISS **and** IR.coinFlips > 0 | all flips done |
| `ANIMATING` | always | presentation reports impact + settle complete |
| `APPLIED` | damage applied | HP > 0 → READY (turn swaps) · HP ≤ 0 → KO |
| `KO` | defender HP ≤ 0 | faint animation done → VICTORY |
| `VICTORY` | — | rematch (same cards, full HP) → READY · new cards → SCANNING |
| `PAUSED` | referee | referee resumes to the previous state |

**Card swap rule.** If a side's tracked card changes while in `READY`, the old creature
recalls (reverse summon) and the new one summons at **full HP** (it's a new creature) —
unless the same card id is re-detected within 30 s, in which case HP is restored.
Tracking loss alone never changes state (see SPEC-app §2.4).

**Turns.** Alternating; first turn to the side chosen in SETUP (default: a coin). Only
the active side's attacks are accepted from voice/tap; the referee can force a side.
Turn indicator is always visible on the HUD.

## 2. Resolution

Resolution decides whether a declared attack **connects**, before any card rule runs.
It is the only place chance enters (other than card coin flips, which are the card's own rule).

### 2.1 Config

```jsonc
{
  "gate": "none" | "math",         // Pure / Luck use "none"; Math Mode uses "math"
  "luckMiss": 0.0,                 // "none" gate: P(miss). UI stops: 0, .15, .30, .50
  "wrongPenalty": 0.5,             // "math" gate, wrong answer: P(miss). UI stops: 0, .35, .70, 1.0
  "firstTurn": "coin" | "left" | "right"
}
```

Two sliders, each shown only in its mode. Kept separate on purpose: the Luck slider is
capped at a coin flip so Pure-ish play never feels miserable; the Math penalty can go to
"always miss" for an older kid who wants stakes.

- **Pure mode** = `gate: none, luckMiss: 0`. Straight card math.
- **Luck mode** = `gate: none, luckMiss > 0`.
- **Math mode** = `gate: math`. Right answer ⇒ guaranteed `HIT`. Wrong / timeout ⇒ roll `wrongPenalty`.

### 2.2 Algorithm

```
resolve(cfg, attackerProfile, answer?) -> Outcome
  pMiss = cfg.gate == "math"
            ? (answer.correct ? 0 : coalesce(attackerProfile.wrongPenalty, cfg.wrongPenalty))
            : cfg.luckMiss
  if rng.next() < pMiss:
      return attackerProfile.mercy ? GLANCE : MISS
  return HIT
```

`mercy` (per profile, default **on** for math level ≤ 3): a failed roll becomes a
**GLANCE** (half damage) instead of a MISS, so the youngest never swings for nothing.

### 2.3 Suspense is in the reveal, not the roll

The outcome is computed at `RESOLVING` (deterministic, seeded) but **revealed at the
moment of impact**. The presentation plays the wind-up and launch identically for all
outcomes; on `MISS` the defender side-steps and the projectile/beam/lunge whiffs; on
`GLANCE` the impact is smaller with a "Glancing!" popup; on `HIT` full impact with
hit-stop. Add a 250–400 ms slow-motion beat just before impact in Luck/Math modes.

## 3. Damage pipeline

```
base   = evaluateDamage(ir.damage, ctx)           // §3.1
dmg    = outcome == MISS   ? 0
       : outcome == GLANCE ? round10(base / 2)
       : base
dmg    = round10(dmg * attackerProfile.damageScale)   // handicap, default 1.0
if dmg > 0:
    dmg = applyWeakness(dmg, attackerCard.types, defenderCard.weaknesses)     // "×2" or "+N"
    dmg = applyResistance(dmg, attackerCard.types, defenderCard.resistances) // "−N"
dmg    = max(0, round10(dmg))
defender.hp = max(0, defender.hp − dmg)
```

Weakness/resistance apply only when damage > 0 (TCG rule) and match the **attacker's card
type** against the defender's listed type. Values are normalized by the forge to
`{op: "mul"|"add", value: n}`.

### 3.1 `evaluateDamage`

The IR gives one of:

| `damage.kind` | Meaning | Evaluation |
|---|---|---|
| `fixed` | "30" | `value` |
| `plus` | "40+" | `base + perUnit × units` where `units` from `source` (below), capped by `cap` |
| `times` | "20×" | `perUnit × units` |
| `none` | text-only attack | 0 (still animates; effect text shown) |

`units.source` ∈ `coinHeads` (from the COIN state) · `energyCount` · `damageCounters` ·
`prompt` (referee enters a number) · `constant`. In v1 without a bench/energy model,
`energyCount` and `damageCounters` fall back to `prompt` with a sensible default of 0
(and the referee can override). `needsReferee=true` in the IR flags these for the HUD.

### 3.2 Coin flips

`ir.coinFlips = { count: n | "untilTails", onHeads: {...}, onTails: {...} }`. The COIN state
runs only if the attack **connected** (no flipping for a miss). Each flip is a 1.2 s
animation with sound; results feed `units.source = coinHeads` and any `onHeads` damage
adders. Status effects in `onHeads/onTails` are surfaced as popups only in v1.

## 4. Sides & profiles

- SETUP binds `left` and `right` to profiles (persisted; defaults to the last binding).
- The attacking profile is always the **active side's** profile — no speaker identification needed.
- Profile fields used by the battle: `mathLevel`, `answerMode`, `timerSeconds`, `mercy`,
  `wrongPenalty` (nullable override), `damageScale`. See `schemas/profile.schema.json`.
- Stats written after each question and each battle: asked/correct/streak per level, wins.

## 5. Referee strip (parent-only, small, bottom edge)

`Pause` · `Skip question (counts as correct)` · `Force HIT / MISS` · `+15 s` · `Coin` ·
`Undo last` · `Swap turn` · `Settings`. Opened by a 1-second press on a corner; never
shown to the TV view if a separate render target is used (v2), otherwise kept small.

## 6. Determinism & event log

The RNG is seeded per battle (`seed` in the log header). Every transition emits an event:

```jsonc
{ "t": 12.41, "type": "resolve", "side": "left", "attack": "Fire Spin",
  "gate": "math", "answerCorrect": false, "pMiss": 0.5, "roll": 0.31, "outcome": "MISS" }
```

Presentation is a pure function of the log. This gives free unit tests, "instant replay"
(v2), and precise debugging when a kid says "it cheated."
