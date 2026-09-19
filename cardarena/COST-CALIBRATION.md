# COST-CALIBRATION — measure it, don't guess it

Any up-front estimate of what an agentic build costs is a guess with a wide error bar,
because the dominant variable is how much context your tool re-sends per turn — and that
varies by tool, by settings, and by how you work. This document turns **one measured
milestone** into a defensible number for the rest.

**The short version: run M0, note what it cost, multiply by ~8. Add 30 % contingency.**

---

## 1. Why M0 is the right yardstick

M0 (the forge) is the best calibration milestone in the plan:

- **Self-contained** — pure Python, no Unity, no device, no AR. Runs anywhere.
- **Unambiguously done or not** — `forge verify` exits 0, the golden set passes 38/38.
- **Representative** — file reading, schema validation, iteration, test-writing, debugging:
  the same shapes as every later milestone.
- **Genuinely useful** — even if you never build the app, the manifest and the IR are the
  reusable artifacts, and the manifest is the publishable one.

It is also the milestone where an agent can be most cheaply *wrong*, which is worth
learning before you're 8 weeks in.

## 2. Measurement protocol

1. **Start clean.** New repo, new Cursor account or a billing period you can read cleanly.
   Note the credit balance and the date before the first prompt.
2. **One milestone, fresh sessions.** Use the M0 prompt from `HANDOFF.md` §1. Start a new
   session per subcommand (`fetch`, `check`, `place`, `sheet`, `ir`, `verify`) — this is
   both cheaper and how you'd really work.
3. **Log every session** in `cost-log.csv` (template in §5). The dashboard gives you spend;
   only you can record what it bought.
4. **Stop at `forge verify` exiting 0** with the golden set passing. Read the credits
   consumed. That number is `M0_cost`.
5. **Record the settings too** — which Auto mode (Intelligence / Balance / Cost), or which
   pinned model. The number is meaningless without them.

Where to read spend:
- **Cursor** — Dashboard → Usage, per-model breakdown, filterable by date. Both pools
  ("Cursor Models" and "Other Models") count; add them.
- **Claude Code** — `/cost` in-session; subscription plans show usage against limits rather
  than dollars, so log sessions and % of limit instead.
- **Raw API** — `response.usage` per call, or the Anthropic Console usage page.

Run the same protocol twice with different settings (e.g. Auto Balance vs Auto
Intelligence) and you have a real quality-per-dollar comparison on *your* project rather
than a vendor's benchmark.

## 3. Extrapolation

Milestone weights, relative to M0 = 1.00. These are agent-token weights, not calendar
weights — some milestones are long in wall-clock but light in agent work because the
iteration is visual and human-driven (audio taste, shader look), while others are pure
code generation and testing.

| Milestone | Weight | Why |
|---|---:|---|
| M0 · Forge | **1.00** | baseline — scripting, tests, iteration |
| M1 · Table demo | 0.35 | small; much of it is Unity GUI work, not agent work |
| M2 · Card identification | 0.90 | native plugin + C# + heavy iteration |
| M3 · Summon | 0.45 | timeline and animation, visually iterated |
| M4 · Combat core | 1.10 | largest pure-logic chunk: FSM, damage pipeline, VFX wiring |
| M5 · Audio | 0.35 | wiring plus human asset sourcing |
| M6 · Luck mode | 0.20 | small, mostly config and a probability test |
| M7 · Math Mode | 1.40 | most code in the project: 10 generators, 10k-case tests, UI, profiles |
| M8 · Voice | 0.80 | native plugin plus parsers |
| M9 · Damage stages | 0.40 | one shader, visually iterated |
| M10 · Polish | 0.70 | download flow, stats, integration debugging |
| **Total** | **7.65** | |

```
project_base   = M0_cost × 7.65
project_likely = M0_cost × 10        # 7.65 × 1.3 contingency for rework and debugging
```

Worked example — if M0 lands at $150 of *metered* spend:

| | |
|---|---|
| Base (7.65×) | $1,150 |
| With contingency (10×) | **$1,500** of model usage |

That is usage, not cash. Cash depends on how you buy it:

| Funding path | ~3.5 months | Note |
|---|---|---|
| **BYOK metered + routing** | **$150–250** | Cheapest if the routing holds. No floor, no ceiling — set a spend alert. |
| Claude Code Max 5× + a cheap second terminal | $350–420 | Predictable; only wins if you'd otherwise burn >$100/mo of frontier |
| Cursor Ultra | ~$700 | Auto stopped being a bargain in Aug 2026 |
| + IR batch (direct API, never credits) | +$5–34 | See `SPEC-ir.md` §5 |

**Check before committing to a subscription:** a $100/month plan only pays for itself if
metered usage would exceed $100/month. With 45 % of the work routed to cheap tiers, it
often won't. Start metered, measure M0, and buy the subscription only once the meter says
you're past it.

**Add the contingency.** The 7.65 figure covers building each milestone once. It does not
cover discovering in M2 that your OCR hit rate is 70 %, or that the CLIP yaw spike missed
and you need the VLM path. Those are the two named risks in `HANDOFF.md` §5 and they are
exactly what contingency is for.

## 3b. Optimize effective cost, not model cost

The number that matters is not the API bill:

```
effective_cost = api_cost + (your_rework_minutes × what_your_time_is_worth)
```

Worked, at $100/hour: a cheap model saves **$8** on a task but costs **30 extra minutes**
of rework. That is $8 − $50 = **−$42**. The cheap model was economically worse, and the
API bill said the opposite.

**Decision rule: the moment extra rework caused by a cheap tier costs more than the
inference it saved, escalate that task class permanently.** Not the individual task — the
class. One bad evening on native plugin code means native plugin code moves to frontier for
the rest of the project.

This is why `cost-log.csv` records minutes alongside dollars. A log without minutes cannot
answer the only question that matters.

## 4. What moves this number most

Roughly in order of leverage:

1. **Session hygiene.** One long session that accumulates 200 K of context costs multiples
   of five short ones. Fresh session per subcommand or per milestone.
2. **Model routing.** Auto Cost vs Auto Intelligence is a several-fold spread. Worth
   measuring both on M0 — that is the entire point of calibrating.
3. **Spec adherence.** An agent that redesigns instead of implementing burns tokens on work
   you throw away. That's what `RULES.md` and the schemas are defending against, and it's
   why the schemas are machine-checkable rather than prose.
4. **Test-first on the mechanical parts.** M7's generators have a 10k-question test per
   level. Writing those first is cheaper than debugging a wrong generator through the UI.
5. **Doing the two spikes early.** Finding out in week 8 that yaw detection doesn't work is
   the expensive version of that discovery.

## 3c. The first-10-tasks experiment (do this inside M0)

A measured M0 total tells you what the project costs. It does not tell you *which tier to
route to*. Get both from the same milestone by deliberately mixing the first ~10 meaningful
coding tasks:

| Tasks | Tier |
|---|---|
| 3 | cheapest bounded model |
| 3 | cheap agentic model |
| 3 | frontier |
| 1 | you, by hand — the baseline |

Same acceptance process for all ten. Then compare `api_cost + rework_minutes × rate` per
accepted task. That produces **your** model frontier on **your** codebase, which beats every
routing table in this repo and every one you'll get from asking a model — including the
ones that produced this file.

## 4b. This estimate assumes you are supervising

Every figure here assumes a human catching drift within a session or two. Fully unattended
runs break the model: escalation rate and churn ratio have nothing measuring them, a
runaway loop has no spend ceiling, and an error that passes its gates compounds across
milestones before anyone sees it. See `HANDOFF.md` §2b for which milestones are safe to
leave alone and which are not. Supervision is a cost control, not an overhead.

## 5. `cost-log.csv`

```csv
date,milestone,session,tool,model_or_mode,minutes,credits_or_cost,outcome,notes
2026-09-20,M0,forge-fetch,cursor,auto-balance,45,8.20,done,"clean; 0-byte files found as spec predicted"
2026-09-20,M0,forge-check,cursor,auto-balance,30,5.10,done,
2026-09-21,M0,forge-place-spike,cursor,auto-intelligence,90,24.50,partial,"CLIP hit rate 17/20 — logged"
```

`outcome` ∈ `done` · `partial` · `rework` · `abandoned`. Track `rework` honestly — the
ratio of rework to done is the real quality signal, and it is the thing a vendor's
satisfaction benchmark cannot tell you about your own project.

**Escalate immediately on any of these** — they all mean the cheap tier has stopped being
cheap:

- Two or more failed test-fix cycles on ordinary work.
- The same file edited 3+ times without the test going green.
- The model edits the *test* to make it pass.
- A bug reintroduced after being fixed.
- The model touches files unrelated to the task.
- Defensive null checks appear instead of a root cause.
- "This should work now", twice.
- Works in the editor or simulator, behaves intermittently on device.
- The acceptance test passes only after substantial hand-editing by you.

## 6. A fair comparison, if that's the goal

To compare two tools rather than just price one:

- Same milestone (M0), same prompts from `HANDOFF.md`, same starting repo.
- Record cost, wall-clock, and rework ratio for each.
- Judge on **cost per accepted milestone**, not cost per session. A cheaper tool that needs
  two passes at `forge place` is not cheaper.
- The acceptance criteria are already objective — `forge verify` exits 0 and the golden set
  passes 38/38 — so neither run can quietly grade itself generously. That is most of why
  the spec was written with machine-checkable gates.
