# DECISIONS — why the spec is the way it is

The `SPEC-*.md` files say **what** to build. This says **why**, and what was rejected.

Read this before "fixing" anything that looks odd. Most entries exist because the obvious
approach was tried on paper and failed for a reason that isn't visible from the code.

Each entry: the decision · what was rejected · why · **what would change my mind**.
That last field is the useful one — it tells you when a decision is genuinely due for
revisiting versus when you're about to break something load-bearing.

---

## Content & assets

### D1 · Build every species, don't curate a shortlist
**Rejected:** hand-pick ~30 species the kids actually play.
**Why:** the curation instinct came from assuming each species needs hand-authored
animation. Once attacks animate by *element × archetype* (D2), almost nothing is
per-species. What remains — scale, pivot, facing — is a batch pipeline (D11), not craft.
Curation would also break the magic the moment a kid puts down a card you didn't pick.
**Changes my mind:** if the yaw pipeline (D11) lands below ~80 % accuracy and the manual
touch-up tail is hundreds of species rather than dozens.

### D2 · Animate by element × archetype, never per attack
**Rejected:** unique animation per named attack.
**Why:** there are ~7,500–11,000 unique attacks in the card database. Per-attack animation
is unbounded and nobody has authored it. Eleven energy types × five archetypes is 55
combinations, built once, and reads correctly to a child: "Charizard used Fire Spin" looks
like fire, from the mouth, as a beam. This single reframing is what makes the project
finite.
**Changes my mind:** nothing at this scope. A future version could special-case a dozen
signature attacks on top of the generic system.

### D3 · 3D models, not 2D sprites
**Rejected:** billboarded animated sprites (Gen-5 style), far cheaper and always
camera-facing.
**Why:** the "always facing the opponent" requirement was explicit, and a billboard can't
turn to face anything — it's always facing *you*. The turn-toward-each-other behaviour is
most of what makes it feel like a battle rather than a sticker.
**Changes my mind:** nothing — but note the billboard fallback (SPEC-app §3) exists for
broken models, so the code path is already there.

### D4 · Engine and content pack are separate; the pack is never hosted
**Rejected:** ship a Pokémon app; or serve models from a small cloud backend.
**Why:** the models, card text, art and audio are Nintendo/Creatures/GAME FREAK property —
the asset library's own README says so. **Hosting them is you distributing copyrighted
assets**, which is the act that draws takedowns. Device-local assets that the user fetched
themselves from a third party is a categorically different posture. The split costs almost
nothing if done on day one and is a painful refactor in month three.
**Changes my mind:** an actual license. Nothing else.

---

## Runtime architecture

### D5 · Fully local; zero network in the battle loop
**Rejected:** a cloud backend for models, card data, or inference.
**Why:** six reasons, in order of force — (1) latency: kids notice 300 ms; (2) reliability:
one mid-battle failure and they stop believing in it, which is how projects like this
actually die; (3) it all fits: ~250 MB of models, ~50 MB of card JSON, so a server has
nothing to do; (4) legal, per D4; (5) privacy: camera and mic never leave the device;
(6) no ops — a server is a thing that breaks at 7pm on a Saturday.
**Changes my mind:** multi-device play across households. Nothing short of that.

### D6 · Identify cards by OCR, track them by runtime image target
**Rejected:** ARKit reference-image matching for identification.
**Why:** ARKit's reference library is practical to ~100 images and tracks ≤ 4 at once.
There are 20,530 English cards. So: detect the rectangle, OCR the name and collector
number, look up locally — *then* build an `ARReferenceImage` at runtime for 6DoF tracking.
Identification and tracking are different problems and need different tools.
**Changes my mind:** nothing. This is a hard platform constraint.

### D7 · The reference image is the camera crop, not the database art
**Rejected:** use the card's official art from the pack.
**Why:** the crop matches the actual lighting, sleeve, gloss and print run in front of the
camera, so tracking is more robust. DB art is the fallback when the crop is blurry or fails
feature validation.
**Changes my mind:** if crop-based targets prove flaky in practice, swap the priority — the
code supports both, it's one branch.

### D8 · The summon sequence *is* the loading screen
**Rejected:** a spinner, or preloading everything.
**Why:** you can't predict which card a kid will play, so something must cover the disk
read. The capsule arc-in → spin → open takes ~1.25 s, which is more than enough. The thing
you wanted for delight is also the thing that hides every hitch. Build it early, not as
polish.
**Changes my mind:** nothing. This is free.

### D9 · Unity + AR Foundation, with a thin Swift plugin
**Rejected:** native Swift + RealityKit throughout.
**Why:** RealityKit has better AR ergonomics and no licence, but ~80 % of the work here is
content pipeline, shaders and VFX — Shader Graph for the damage material and dissolve, VFX
Graph for 55 attack effects, Addressables for streaming. That work is dramatically cheaper
in Unity. Vision and Speech are reached through a ~300-line plugin (SPEC-native).
**Changes my mind:** if you'd rather write Swift than fight Unity, every spec here is
stack-agnostic except the parts marked *(Unity)*. It's a real option, not a wrong one.

### D10 · HDMI out, not AirPlay
**Rejected:** AirPlay mirroring to the TV.
**Why:** AirPlay adds 100–300 ms and visibly softens the camera feed. USB-C → HDMI is
near-zero latency and much sharper. For a thing pointed at a table and shown on a TV, that
gap is the whole experience.
**Changes my mind:** nothing, though AirPlay should still work as a degraded fallback.

---

## The forge

### D11 · Detect facing automatically, verify in bulk, never label by hand
**Rejected:** clicking through ~1,300 models to set each one's rotation.
**Why — and this is the entry most likely to be misunderstood:** a GLB is a bag of
triangles in its own coordinate system. **Nothing in the file says which way the creature
faces.** The mesh is complete from every angle precisely *because* it has no privileged
front. So when the runtime computes "turn toward the opponent," it needs a per-species
offset or half your creatures show you their backs.
The runtime rotation itself is pure maths from the two card anchors — no calibration, ever.
What needs detecting is the *asset-space forward axis*, once, offline.
Three passes: convention clustering → render 16 views and CLIP-match against the official
front-facing artwork → VLM tie-break. Then render all chosen fronts as 100-per-page contact
sheets: a back view in a grid of faces is instantly obvious. You spot ~40 outliers in five
minutes rather than labelling 1,300.
**⚠ If CLIP underperforms, do not "fix" it by removing the `lookAt` or hardcoding a
rotation.** That silently breaks the facing feature and no acceptance test will catch it.
Escalate the VLM pass from tie-break to primary.
**Changes my mind:** a source library that ships a documented forward-axis convention.

### D12 · Precompute attack semantics offline; never parse card text at runtime
**Rejected:** a runtime parser, or a runtime LLM call.
**Why:** card text is arbitrary English across 176 sets. A parser is a losing battle; a
runtime LLM call breaks D5. One offline batch turns every attack into structured JSON,
cached forever, and the app becomes a dumb interpreter of it. This is what turned "Dad
adjudicates with a +/− stepper" into "mostly automatic."
**Changes my mind:** nothing. This is the right shape.

### D13 · The forge computes what it can; the model decides only semantics
**Rejected:** let the model fill every field.
**Why:** `element`, `intensity`, `needsReferee`, `hash`, `cardIds` are all mechanically
derivable, and `damage.kind` is fixed by the damage string. Deriving them keeps the batch
cheap, makes output stable across runs, and shrinks the human review surface to the fields
that actually need judgement. The model must *agree* with the derived `damage.kind` or the
item re-runs — a free correctness check.
**Changes my mind:** nothing.

### D14 · The IR schema is deliberately flat
**Rejected:** idiomatic JSON Schema with `oneOf`, `$ref`, nullable enums.
**Why:** the LLM-facing schema is *derived* from the canonical one by deleting five
forge-owned keys. That derivation must be mechanical, and structured-output endpoints are
fussy about `oneOf`/`$ref`. Hence sentinel values (`"None"`, `source: "none"`) instead of
nulls and unions. It reads slightly redundantly; that's the price.
**Changes my mind:** nothing — `forge verify` asserts the subset relationship, so this is
load-bearing.

---

## Battle & play

### D15 · One resolution model: a gate plus two knobs
**Rejected:** three separate modes (Pure / Luck / Math) with their own code paths.
**Why:** they collapse into `gate ∈ {none, math}` plus a miss probability. Pure is
gate-none at 0 % miss. That's ~15 lines, fully unit-testable, and adding a fourth mode
later is a config change rather than a new branch.
**Changes my mind:** a mode that isn't about whether the attack connects.

### D16 · Two separate sliders, not one
**Rejected:** a single "randomness" slider serving both modes.
**Why:** they mean different things and want different ranges. Luck caps at a coin flip so
near-pure play never feels miserable. The math penalty can reach 100 % for an older kid who
wants real stakes. One control with two meanings would be confusing on a settings screen a
parent uses once a month.
**Changes my mind:** nothing.

### D17 · Mercy — a failed roll becomes a glancing blow, not a miss
**Rejected:** wrong answer → clean miss, always.
**Why:** a four-year-old who gets the question wrong and then watches *nothing happen* has
been punished twice. Half damage keeps the turn meaningful. Per-profile, default on below
math level 4.
**Changes my mind:** nothing — but it's one boolean if a kid finds it patronising.

### D18 · Decide the outcome early, reveal it at impact
**Rejected:** roll at the moment of impact.
**Why:** determinism (seeded RNG, replayable event log, testable) *and* drama are both
served by computing at `RESOLVING` and revealing at impact. Wind-up and launch look
identical for every outcome; only the last 300 ms differ. Suspense lives in the reveal, not
the roll.
**Changes my mind:** nothing.

### D19 · The battle engine is pure logic emitting an event log
**Rejected:** game logic living in MonoBehaviours alongside rendering.
**Why:** config + cards + IR + seeded RNG in, ordered event log out, presentation replays
it. Gives free unit tests, deterministic replay, and — when a kid says "it cheated" — an
exact record of the roll and why.
**Changes my mind:** nothing. This is cheap and pays forever.

### D20 · Ten math rungs, not five
**Rejected:** the five curriculum stages as five slider positions.
**Why:** five stages are the anchors, but the jump from "add within 10" to "multiply" is a
cliff for a real child. Splitting each stage in two gives a ramp, and puts L1 (add within 5,
multiple choice, read aloud) genuinely within reach of a four-year-old.
**Changes my mind:** nothing.

### D21 · Push-to-talk, and tap always works
**Rejected:** always-on listening with a wake word.
**Why:** children's speech recognition is materially worse than adults' — higher pitch,
shifted formants, irregular pronunciation — and this runs across a room with a TV on.
Push-to-talk removes false triggers entirely, and the tap fallback means a bad recognition
never blocks the game. Voice is the nice path, not the only path.
**Changes my mind:** if on-device recognition gets dramatically better for child speech,
revisit the wake word — but keep the tap fallback regardless.

---

## Process

### D22 · Tap and Math Mode ship before voice
**Rejected:** build voice early since it's the headline feature.
**Why:** tap-first makes the entire game testable by hand from M4 onward, and Math Mode in
multiple-choice needs no speech at all. Voice then layers onto a working game instead of
being a dependency for testing one.
**Changes my mind:** nothing.

### D23 · Machine-checkable acceptance everywhere
**Rejected:** prose acceptance criteria.
**Why:** `forge verify` exits 0, the golden set passes 38/38, generators survive 10,000
questions per level, schemas validate in CI. This is what makes it safe to hand execution
to a cheaper model — the gates catch drift that a human reviewer would miss, and neither a
model nor a vendor benchmark can grade itself generously.
**Changes my mind:** nothing. This is the spec's main defence.

### D24 · Never learn the size of an API bill by receiving it
**Rejected:** run `forge ir` and see what it costs.
**Why:** `forge ir --dry-run` prints the exact post-dedup count and projected cost per
model without calling the API; `--golden` verifies correctness for cents. My own first
estimate of this batch was 30–50 % too high because I guessed the unique-attack count
instead of measuring it — which is the entire argument for the dry-run.
**Changes my mind:** nothing.
