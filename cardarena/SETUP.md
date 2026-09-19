# SETUP — from nothing to building, step by step

Written for someone who has never used Cursor or OpenRouter. Follow it in order. Each step
says what you should see when it worked.

Assumes: a Mac, an iPad with USB-C, an Apple ID, and a free month of **Cursor Pro+**.

---

## Step 0 · Start the big downloads first (10 min of clicking, hours of waiting)

Unity and Xcode are enormous and will take 1–4 hours. **Start them now** and do everything
else while they download. Getting this wrong is the single most common way night 1 becomes
night 1 and 2.

1. **Xcode** — App Store → search Xcode → Get. ~15 GB. Open it once when done and accept the
   licence, or command-line tools won't work.
2. **Unity Hub** — <https://unity.com/download>. Install, sign in (free account), then
   Install Editor → **Unity 6 LTS** (the newest 6.x LTS).
   **Critical:** on the modules screen tick **iOS Build Support**. It is *not* on by default
   and adding it later means a re-download. Also tick **Visual Studio / VS Code editor
   support** if offered.
3. **Python** — `python3 --version` in Terminal. If it's below 3.10, install from
   <https://python.org> or `brew install python@3.12`.

✅ *Working when:* Unity Hub shows "Unity 6.x LTS" with iOS Build Support listed, and Xcode
opens without prompting for anything.

---

## Step 1 · Cursor: install and redeem Pro+

1. Download from <https://cursor.com> → open the `.dmg` → drag to Applications → open it.
   (macOS may warn about an app from the internet; right-click → Open the first time.)
2. Sign up. Use the same email you'll use for the Lenny's promo.
3. On the "import from VS Code" prompt: **Import** if you use VS Code, otherwise Skip.
   Either is fine.
4. **Redeem the Pro+ code:** Cursor → Settings (⌘,) → find **Account** / **Billing** →
   look for *Redeem code*, *Promo*, or *Coupon*. Paste the Lenny's code there. If you can't
   find it in-app, go to <https://cursor.com/dashboard> in a browser — billing lives there
   and the redemption field is easier to find.

✅ *Working when:* your account page says **Pro+** with an included-usage figure (~$70/mo of
model usage at time of writing — verify the current number on their pricing page).

### What Pro+ means for you right now

**$70 of included model usage is almost certainly more than all four nights will cost.** Part
1 is ~12 hours of work. So for month one: **use the included credits, do not set up BYOK
yet.** Skip to Step 2.

OpenRouter (Step 6) becomes worth doing when either the free month ends or you burn through
the included usage — realistically only if you go on to Part 2. Setting it up on day one is
config time spent solving a problem you don't have.

---

## Step 2 · Learn the four keys (2 minutes, saves you hours)

| Key | What it is | Use it for |
|---|---|---|
| **Tab** | Autocomplete as you type | Constantly. This is Cursor's best feature and it's free on your plan. |
| **⌘K** | Inline edit — select code, describe a change | Small, surgical edits |
| **⌘L** | Chat sidebar — ask questions about the repo | "How does X work?", planning |
| **⌘I** | **Agent / Composer** — multi-file, runs commands, edits many files | **This is what you'll use for the nights.** |

For this project you mostly live in **⌘I**. It reads files, writes files, runs terminal
commands, and shows you a diff to accept or reject.

**Model selector** is a dropdown at the top or bottom of the Agent/Chat panel. You'll change
it per task (Step 5).

---

## Step 3 · Create the project repo

In Terminal:

```bash
mkdir ~/cardarena-engine && cd ~/cardarena-engine
git init
mkdir -p spec forge unity
```

Unzip the spec bundle and copy the folder in so it lands at `~/cardarena-engine/spec/`
(you should see `spec/README.md`, `spec/BUILD-PLAN.md`, `spec/schemas/`, etc.).

Then create the rules file at the repo root. Copy the whole `RULES.md` block from
`spec/HANDOFF.md` §2 into **both** of these:

```bash
# paste the RULES.md content into each
touch AGENTS.md .cursorrules
```

Two filenames, identical content — different tools read different names, and this costs
nothing.

```bash
git add -A && git commit -m "spec: initial import, unmodified"
```

Committing the spec untouched matters: any later drift from the contract shows up in
`git diff`.

✅ *Working when:* `ls` shows `AGENTS.md .cursorrules forge/ spec/ unity/` and
`git log` has one commit.

---

## Step 4 · Open it in Cursor and let it index

1. Cursor → File → Open Folder → `~/cardarena-engine`.
2. Wait for indexing. There's usually a progress indicator bottom-right, or check
   Settings → Features → **Codebase Indexing**. On a repo this small it's seconds.
3. Settings → check **Rules** / **Rules for AI** and confirm it sees `.cursorrules`.

✅ *Working when:* press ⌘L and ask *"What is in spec/BUILD-PLAN.md?"* — it should answer
from the file, not guess. If it guesses, indexing hasn't finished.

### One setting worth changing

In Agent mode, Cursor asks permission before running terminal commands. For this project
you'll be running `python`, `pytest`, `git status` constantly. Find the auto-run / allowlist
setting and permit those. **Do not blanket-allow everything** — you want to see anything
that deletes, force-pushes, or installs.

---

## Step 5 · Pick your model per task

Your supervision level is your risk level. From `spec/HANDOFF.md`:

| Milestone type | Supervision | Model to pick |
|---|---|---|
| N1, N3 (logic, tests, scripts) | **auto** | A cheap-to-mid model. A gate catches failures. |
| N2, N4 (Unity, visual) | **check** | Mid-tier. *You* are the oracle, so iteration speed beats model quality. |
| Later: M2, M8, M10 (native plugin, integration) | **watch** | Frontier. Failures are silent or only appear on device. |

While on included Pro+ credits, just pick sensibly from Cursor's list and don't agonise —
$70 is a lot of Part 1. Start logging which model you used in `cost-log.csv` (in the spec
folder) from task one, or you won't be able to tell later whether cheap was actually cheap.

---

## Step 6 · OpenRouter — LATER, not now

**Skip this until the free month ends or your included usage runs low.** Kept here so it's
ready when you need it.

1. Sign up at <https://openrouter.ai>, add credit (start with $10 — it does not expire).
2. Keys → create a key → copy it.
3. Cursor → Settings → **Models** → **OpenAI** provider → toggle **Use own API key**.
4. Paste the OpenRouter key.
5. **Override Base URL:** `https://openrouter.ai/api/v1/cursor`
   The trailing `/cursor` is mandatory. Plain `/api/v1` breaks tool calls in Agent mode and
   the failure is confusing.
6. Add the model ids you want (from <https://openrouter.ai/models>) to the custom model list.
7. OpenRouter → Settings → set a **spend limit**. BYOK has no ceiling and a runaway agent
   session has no cap.
8. **Turn Cursor's Auto mode off.** Auto and Cursor's own models bill to Cursor, not your
   key — leaving it on quietly defeats the whole setup.

✅ *Working when:* you run something in Agent mode and it appears in **OpenRouter →
Activity** within a minute. If it doesn't, the override isn't taking effect and you're still
spending Cursor credits.

**What BYOK does and doesn't cover:** Chat, ⌘K, Composer and Agent route through your key.
**Tab completion and Apply always stay on Cursor's own models** — which is what you want,
it's fast and the subscription covers it.

**Measuring spend from here on:** read **OpenRouter → Activity**, not Cursor's dashboard.
Under BYOK, Cursor's usage page shows only Tab and Apply.

---

## Step 7 · Start Night 1

Open Agent mode (⌘I) and paste the Night 1 kickoff prompt from `spec/HANDOFF.md` §1.

What to expect: it should read the spec files first, then come back with a short plan and
wait for your go-ahead. **If it starts writing the full M0 pipeline — CLIP, VLM, contact
sheets — stop it.** That's Part 2. Night 1 is twenty species done by hand.

Your night 1 deliverable: ~20 GLB files, a hand-written `manifest.json`, and one JSON with
HP/types/attacks for those cards. That's it.

---

## Before night 2: Unity and iPad prerequisites

Do these once Unity has finished installing — ideally *before* night 2, so night 2 is
building rather than installing.

1. **New Unity project:** Unity Hub → New → **3D (URP)** → location `~/cardarena-engine/unity`.
2. **Packages:** Window → Package Manager → Unity Registry → install **AR Foundation** and
   **Apple ARKit XR Plugin**.
3. **Switch platform:** File → Build Settings → **iOS** → Switch Platform. Takes a few
   minutes the first time.
4. **XR:** Project Settings → **XR Plug-in Management** → install if prompted → iOS tab →
   tick **ARKit**.
5. **Player Settings** (Project Settings → Player → iOS):
   - **Bundle Identifier**: something like `com.yourname.cardarena` — not the default, or
     signing fails.
   - **Camera Usage Description**: any sentence. **Build fails without it.**
   - **Target minimum iOS Version**: 15.0 or higher.
   - **Architecture**: ARM64.
6. **Device:** plug the iPad in, unlock it, tap **Trust**. In Xcode → Settings → Accounts,
   add your Apple ID (free account is fine — apps expire after 7 days and you re-sign).

✅ *Working when:* File → Build Settings → Build produces an Xcode project without errors,
and Xcode shows your iPad in the device dropdown.

> **This list is night 2's most likely stall point.** Camera Usage Description and iOS Build
> Support are the two that catch people. Run through it while Unity downloads.

---

## Quick troubleshooting

| Symptom | Cause |
|---|---|
| Agent ignores the spec | Indexing incomplete, or `.cursorrules` not at repo root |
| Agent invents a different architecture | Point it at `spec/DECISIONS.md` — the alternative it wants was probably already rejected there |
| Tool calls fail after BYOK setup | Base URL missing the `/cursor` suffix |
| Spend appearing in Cursor, not OpenRouter | Override not applied, or Auto mode still on |
| Unity iOS build fails on signing | Bundle Identifier still the default, or Apple ID not in Xcode |
| Unity iOS build fails on camera | Camera Usage Description empty |
| AR scene runs but tracks nothing | Testing in Editor — AR Foundation needs a real device |
