# SPEC · Math Mode

Math Mode is a self-contained module: `generate(level, rng, flavorCtx?) -> Question` and
`check(question, answer) -> bool`, plus answer-input parsing. No rendering, no network.
It ships in the public repo.

## 1. The ladder

One **1–10 slider** per profile, labelled by the curriculum stage it maps to. The five
stages the family asked for are the anchors; intermediate rungs give a gentle ramp inside
each stage. Suggested starts: 4 yo → L1–2, 7 yo → L6–7, 8–9 yo → L9–10.

| L | Label | Ops | Constraints (all answers non-negative, integers unless fractions) |
|---|---|---|---|
| 1 | Counting & add within 5 | `+` | a,b ∈ [1,4], a+b ≤ 5. Optional dot-visuals. Choice mode only. |
| 2 | Basic add/sub within 10 | `+ −` | a,b ∈ [0,10]; a+b ≤ 10; a ≥ b for subtraction |
| 3 | Add/sub within 20 (crossing 10) | `+ −` | a+b ≤ 20 with max(a,b) ≥ 5; a ∈ [10,20] for subtraction |
| 4 | Two-digit, no regrouping | `+ −` | a,b ∈ [10,89]; no digit-column carry/borrow; a+b ≤ 99 |
| 5 | **Advanced add/sub** (regrouping) | `+ −` | a,b ∈ [10,89]; at least one carry/borrow; occasionally 3 addends ≤ 30 |
| 6 | **Basic mult/div** facts 1–5, ×10 | `× ÷` | a ∈ [1,5] ∪ {10}, b ∈ [1,10]; division is the exact inverse |
| 7 | Mult/div facts 1–10 | `× ÷` | a,b ∈ [1,10]; division exact |
| 8 | **Advanced mult/div** | `× ÷` | facts to 12; 2-digit × 1-digit (a ∈ [11,49], b ∈ [2,9]); 2-digit ÷ 1-digit exact |
| 9 | **Fractions I** | frac | unit fraction *of* a number (½ of 12, ¼ of 20 — always integer); equivalents (½ = ?/4); compare (choice) |
| 10 | Fractions II | frac | same-denominator add/sub (¼+¼, ¾−¼); non-unit *of* (¾ of 12); simplify; mixed ↔ improper (denominators ≤ 8) |

Rules common to all levels: never repeat the previous question; distractors in choice
mode are near-misses (±1, ±2, ±10, swapped digits, off-by-one-fact) and never negative;
the correct answer position is random; fractions are stored and compared **simplified**.

## 2. Question object

```jsonc
{
  "id": "q_8f3a", "level": 7, "kind": "arith" | "fraction",
  "prompt": "7 × 8", "spoken": "seven times eight",
  "answer": { "type": "int", "value": 56 }          // or {"type":"frac","num":3,"den":4}
  "choices": [48, 54, 56, 63],                       // present in choice mode
  "thematic": "Charizard has 120 HP and takes 50 damage. How much HP is left?",  // optional
  "timerSeconds": 20
}
```

`spoken` is used for the optional read-aloud (AVSpeechSynthesizer via the native plugin)
so a pre-reader can play L1–L2 without an adult.

## 3. Answer input

Two per-profile modes:

- **`choice`** — 3 options at L1–2, 4 at L3+. Big TV-readable buttons. Answered by tap or
  by voice (say the number; the recognizer's contextual strings are exactly the choices).
- **`open`** — free answer by voice or the on-screen numpad (`0–9`, `/`, `⌫`, `✓`).

The iPad sits on a stand pointed at the table, so **voice is primary and tap is the
fallback** for kids; the referee can tap on a child's behalf.

### 3.1 Parsing spoken answers

- Integers: number words → int ("twenty-three", "a hundred", "fourteen" vs "forty" both kept as candidates; disambiguate against choices when present).
- Fractions: "three quarters" / "three fourths" / "three over four" → 3/4; "a half", "one half" → 1/2; "one and a half" → 3/2.
- Accept the first parse that matches a choice; in open mode accept the highest-confidence parse; on no parse, show "Say it again or tap".

### 3.2 Timer

Per profile `timerSeconds` (null = none). Defaults by level: L1–2 none · L3–5 30 s ·
L6–8 20 s · L9–10 25 s. Timeout counts as wrong. Referee `+15 s` and `Pause` always available.
Timer starts after the question is fully rendered (and after read-aloud finishes, if on).

## 4. Mercy, penalty, handicap (per profile)

- `mercy` — failed roll becomes GLANCE, not MISS. Default on for level ≤ 3.
- `wrongPenalty` — nullable override of the global Math penalty.
- `damageScale` — multiplier on the child's damage (default 1.0; e.g. 1.2 for the younger sibling).

## 5. Thematic questions (`thematic: true`, L3+)

Same generator constraints, wrapped in battle context using the real numbers on screen
where they fit the level: HP remaining, total damage over two hits, "how many coins were
heads". Falls back to the bare prompt when no template fits the generated operands.

## 6. Stats & adaptivity

Per profile, per level: asked, correct, current streak, best streak, median answer time.
Shown in the parent settings screen. **v1 never changes a level automatically.** v2 may
suggest a nudge when accuracy ≥ 80 % over the last 20 with median time under half the timer.

## 7. Tests (must exist before M7 closes)

For each level, 10 000 generated questions: constraints hold, answer is correct by
independent evaluation, no negatives, division exact, fractions simplified, choices unique
and contain exactly one correct, no immediate repeats. Parser tests for number words and
fraction phrasings above.
