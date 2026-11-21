/* Gulch Japan planning engine — reads window.JAPAN_KB, persists to localStorage. */
(function () {
  "use strict";

  const KB = window.JAPAN_KB;
  if (!KB) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p class="noscript">Knowledge base failed to load.</p>'
    );
    return;
  }

  const PLAN_STORE = "gulch-japan-v1";
  const SCORE_KEYS = ["weather", "crowds", "cost", "sakura", "foliage"];
  const SCORE_LABELS = {
    weather: "Walking weather",
    crowds: "Fewer crowds",
    cost: "Lower cost",
    sakura: "Cherry blossoms",
    foliage: "Autumn color",
  };

  const STEPS = [
    { id: "when", label: "When to go" },
    { id: "flights", label: "How to fly" },
    { id: "stay", label: "Where to stay" },
    { id: "do", label: "What to do" },
  ];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function band2p(band) {
    if (!band) return "—";
    if (typeof band === "string") return band;
    return money(band.low) + "–" + money(band.high) + " for two";
  }

  function tagClass(tag) {
    const t = String(tag || "").toLowerCase();
    if (t === "vault") return "tag tag--vault";
    if (t === "research") return "tag tag--research";
    if (t === "estimate") return "tag tag--estimate";
    if (t === "open") return "tag tag--open";
    if (t === "marriott") return "tag tag--marriott";
    if (t === "unverified") return "tag tag--unverified";
    return "tag";
  }

  function whoClass(who) {
    if (who === "jon") return "who who--jon";
    if (who === "kathleen") return "who who--kathleen";
    return "who who--both";
  }

  function whoLabel(who) {
    if (who === "jon") return "Jon";
    if (who === "kathleen") return "Kathleen";
    return "Both";
  }

  function iconStar() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.6 7.2 18.1l.9-5.4L4.2 8.9l5.4-.8z"/></svg>';
  }
  function iconX() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  }

  function defaultState() {
    return {
      mode: "report",
      step: 0,
      seasonId: null,
      flightId: "f-iad-nonstop",
      departId: "sat",
      weights: { weather: 4, crowds: 3, cost: 3, sakura: 1, foliage: 2 },
      starred: {},
      removed: {},
      notes: "",
      filters: { q: "", kind: "all", region: "all", starredOnly: false },
      selectedId: null,
      trayOpen: false,
      lastRemoved: null,
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(PLAN_STORE);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        weights: { ...base.weights, ...(parsed.weights || {}) },
        starred: parsed.starred || {},
        removed: parsed.removed || {},
        filters: { ...base.filters, ...(parsed.filters || {}) },
      };
    } catch (e) {
      return base;
    }
  }

  let state = loadState();
  let map;
  let markers = {};
  let saveTimer;
  let toastTimer;

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const payload = {
        mode: state.mode,
        step: state.step,
        seasonId: state.seasonId,
        flightId: state.flightId,
        departId: state.departId,
        weights: state.weights,
        starred: state.starred,
        removed: state.removed,
        notes: state.notes,
        filters: state.filters,
      };
      try {
        localStorage.setItem(PLAN_STORE, JSON.stringify(payload));
      } catch (e) {
        /* ignore quota */
      }
    }, 120);
  }

  function announce(msg) {
    const live = $("#live");
    if (live) live.textContent = msg;
  }

  function catalog() {
    const items = [];
    KB.destinations.forEach((d) =>
      items.push({
        kind: "destination",
        id: d.id,
        name: d.name,
        region: d.region,
        lat: d.lat,
        lng: d.lng,
        why: d.whyGo,
        meta: d.type,
        energy: d.energy,
        nights: d.nightsSuggested,
        highlights: d.highlights || [],
        fitTags: d.fitTags || [],
        source: d.source,
        vaultNote: d.vaultNote,
        raw: d,
      })
    );
    KB.activities.forEach((a) =>
      items.push({
        kind: "activity",
        id: a.id,
        name: a.name,
        region: a.region,
        lat: a.lat,
        lng: a.lng,
        why: a.why,
        meta: a.category,
        area: a.area,
        durationHours: a.durationHours,
        costBand: a.costBand,
        forWhom: a.forWhom,
        fitTags: a.fitTags || [],
        source: a.source,
        vaultNote: a.vaultNote,
        destId: a.destId,
        raw: a,
      })
    );
    KB.stays.forEach((s) =>
      items.push({
        kind: "stay",
        id: s.id,
        name: s.name,
        region: s.region,
        lat: s.lat,
        lng: s.lng,
        why: s.why,
        meta: s.style,
        area: s.area,
        priceBand: s.priceBand,
        marriott: s.marriott,
        notes: s.notes,
        fitTags: s.marriott ? ["marriott"] : [],
        destId: s.destId,
        raw: s,
      })
    );
    return items;
  }

  const ALL = catalog();
  const BY_ID = Object.fromEntries(ALL.map((i) => [i.id, i]));

  function isRemoved(id) {
    return !!state.removed[id];
  }
  function isStarred(id) {
    return !!state.starred[id];
  }

  function setMode(mode, scroll) {
    state.mode = mode === "plan" ? "plan" : "report";
    persist();
    renderMode();
    if (scroll) {
      const el = $("#workspace");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (state.mode === "plan") {
      requestAnimationFrame(() => {
        ensureMap();
        refreshAtlas();
      });
    }
  }

  function renderMode() {
    const report = $("#panel-report");
    const plan = $("#panel-plan");
    const tabR = $("#tab-report");
    const tabP = $("#tab-plan");
    if (report) report.hidden = state.mode !== "report";
    if (plan) plan.hidden = state.mode !== "plan";
    if (tabR) tabR.setAttribute("aria-selected", String(state.mode === "report"));
    if (tabP) tabP.setAttribute("aria-selected", String(state.mode === "plan"));
    updateStarCount();
  }

  function updateStarCount() {
    const btn = $("#star-count");
    const n = Object.keys(state.starred).filter((id) => state.starred[id] && !state.removed[id]).length;
    if (!btn) return;
    if (!n) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.textContent = n + (n === 1 ? " starred" : " starred");
  }

  function renderReport() {
    const toc = $("#report-toc");
    const body = $("#report-body");
    if (!toc || !body) return;

    const meta = KB.meta;
    const sections = KB.researchReport || [];

    toc.innerHTML =
      '<p class="kicker">Contents</p><ol>' +
      sections
        .map(
          (s, i) =>
            '<li><a href="#rsec-' +
            esc(s.id) +
            '"><span>' +
            String(i + 1).padStart(2, "0") +
            "</span>" +
            esc(s.title) +
            "</a></li>"
        )
        .join("") +
      "</ol>";

    const intro =
      '<header class="report__intro">' +
      "<h2>A research base you can argue with.</h2>" +
      "<p>" +
      esc(meta.subtitle) +
      " " +
      esc(meta.tripFrame.summary) +
      " Researched " +
      esc(meta.researchedOn) +
      ". " +
      esc(meta.planningYearNote) +
      "</p>" +
      '<dl class="brief">' +
      "<div><dt>Travelers</dt><dd>" +
      esc(meta.travelers.who) +
      " <span>(" +
      esc(meta.travelers.status) +
      ")</span></dd></div>" +
      "<div><dt>Airports</dt><dd>" +
      esc(meta.airportsNote) +
      "</dd></div>" +
      "<div><dt>Kids</dt><dd>" +
      esc(meta.travelers.kidsNote) +
      "</dd></div>" +
      "</dl></header>";

    const secs = sections
      .map((s, i) => {
        const bullets = (s.bullets || [])
          .map(
            (b) =>
              "<li><span class=\"" +
              tagClass(b.tag) +
              '">' +
              esc(b.tag) +
              "</span><span>" +
              esc(b.text) +
              "</span></li>"
          )
          .join("");
        return (
          '<article class="rsec" id="rsec-' +
          esc(s.id) +
          '">' +
          '<div class="rsec__n">' +
          String(i + 1).padStart(2, "0") +
          "</div>" +
          "<div>" +
          "<h3>" +
          esc(s.title) +
          "</h3>" +
          (s.lede ? '<p class="rsec__lede">' + esc(s.lede) + "</p>" : "") +
          '<ul class="claims">' +
          bullets +
          "</ul></div></article>"
        );
      })
      .join("");

    const sources =
      '<section class="rsec" id="rsec-sources"><div class="rsec__n">◆</div><div>' +
      "<h3>Sources</h3>" +
      '<p class="rsec__lede">Vault paths first, then the public pages behind the fare and season numbers.</p>' +
      "<h4>Vault</h4><ul class=\"bullets\">" +
      (meta.vaultSources || []).map((s) => "<li>" + esc(s) + "</li>").join("") +
      "</ul><h4>Research</h4><ul class=\"bullets\">" +
      (meta.researchSources || []).map((s) => "<li>" + esc(s) + "</li>").join("") +
      "</ul></div></section>";

    const next =
      '<div class="report__next"><p>Ready to pick a season and start starring places?</p>' +
      '<button type="button" class="btn btn--onink btn--primary" data-action="mode" data-mode="plan" data-scroll="1">Open the Planning Engine</button></div>';

    body.innerHTML = intro + secs + sources + next;
  }

  function rankedSeasons() {
    const w = state.weights;
    const wSum = SCORE_KEYS.reduce((a, k) => a + (Number(w[k]) || 0), 0) || 1;
    return KB.seasons
      .map((s) => {
        let score = 0;
        SCORE_KEYS.forEach((k) => {
          score += ((Number(w[k]) || 0) / wSum) * (s.scores[k] || 0);
        });
        return { season: s, score };
      })
      .sort((a, b) => b.score - a.score || b.season.recommendationScore - a.season.recommendationScore);
  }

  function renderStepper() {
    const el = $("#stepper");
    if (!el) return;
    el.innerHTML = STEPS.map((step, i) => {
      const answer = stepAnswer(i);
      return (
        '<li><button type="button" class="stepper__btn" data-action="step" data-step="' +
        i +
        '" aria-current="' +
        (state.step === i ? "step" : "false") +
        '">' +
        '<span class="stepper__n">' +
        String(i + 1).padStart(2, "0") +
        "</span>" +
        '<span class="stepper__q">' +
        esc(step.label) +
        "</span>" +
        (answer ? '<span class="stepper__a">' + esc(answer) + "</span>" : "") +
        "</button></li>"
      );
    }).join("");
  }

  function stepAnswer(i) {
    if (i === 0) {
      const s = KB.seasons.find((x) => x.id === state.seasonId);
      return s ? s.name : "";
    }
    if (i === 1) {
      const f = (KB.flights.options || []).find((x) => x.id === state.flightId);
      const d = (KB.meta.tripFrame.departOptions || []).find((x) => x.id === state.departId);
      return [f && f.name, d && d.label].filter(Boolean).join(" · ");
    }
    if (i === 2) {
      const n = ALL.filter((x) => x.kind === "stay" && isStarred(x.id) && !isRemoved(x.id)).length;
      return n ? n + " starred" : "";
    }
    if (i === 3) {
      const n = ALL.filter(
        (x) => (x.kind === "destination" || x.kind === "activity") && isStarred(x.id) && !isRemoved(x.id)
      ).length;
      return n ? n + " starred" : "";
    }
    return "";
  }

  function renderStepNav() {
    const el = $("#step-nav");
    if (!el) return;
    const prev =
      state.step > 0
        ? '<button type="button" class="btn btn--ghost" data-action="step" data-step="' +
          (state.step - 1) +
          '">Back</button>'
        : "<span></span>";
    const next =
      state.step < STEPS.length - 1
        ? '<button type="button" class="btn btn--primary" data-action="step" data-step="' +
          (state.step + 1) +
          '">Next</button>'
        : '<a class="btn btn--primary" href="#atlas">Browse the atlas</a>';
    el.innerHTML = prev + next;
  }

  function renderStepPanel() {
    const el = $("#step-panel");
    if (!el) return;
    const id = STEPS[state.step].id;
    if (id === "when") el.innerHTML = renderWhenStep();
    else if (id === "flights") el.innerHTML = renderFlightsStep();
    else if (id === "stay") el.innerHTML = renderStayStep();
    else el.innerHTML = renderDoStep();
  }

  function renderWhenStep() {
    const ranked = rankedSeasons();
    const weights = SCORE_KEYS.map((k) => {
      const v = state.weights[k];
      return (
        '<div class="weight">' +
        "<label for=\"w-" +
        k +
        '">' +
        esc(SCORE_LABELS[k]) +
        "</label>" +
        "<output id=\"wo-" +
        k +
        '" for="w-' +
        k +
        '">' +
        v +
        " / 5</output>" +
        '<input id="w-' +
        k +
        '" type="range" min="0" max="5" step="1" value="' +
        v +
        '" data-action="weight" data-key="' +
        k +
        '">' +
        "</div>"
      );
    }).join("");

    const wins = ranked
      .map((row, idx) => {
        const s = row.season;
        const picked = state.seasonId === s.id;
        return (
          '<article class="win' +
          (picked ? " is-picked" : "") +
          '">' +
          '<div class="win__head">' +
          '<div class="win__rank">' +
          String(idx + 1).padStart(2, "0") +
          "</div>" +
          "<div><div class=\"win__name\">" +
          esc(s.name) +
          "</div><div class=\"win__months\">" +
          esc(s.months) +
          "</div></div>" +
          '<div class="win__score"><span>Match</span><strong>' +
          row.score.toFixed(1) +
          '</strong><span>Base ' +
          s.recommendationScore +
          "/10</span></div>" +
          '<div class="win__actions"><button type="button" class="btn btn--small' +
          (picked ? " btn--picked" : "") +
          '" data-action="pick-season" data-id="' +
          esc(s.id) +
          '">' +
          (picked ? "Selected" : "Select") +
          "</button></div></div>" +
          '<div class="win__body">' +
          "<p>" +
          esc(s.fitForJonKathleen) +
          "</p>" +
          '<dl class="win__facts">' +
          "<div><dt>Weather</dt><dd>" +
          esc(s.weather) +
          "</dd></div>" +
          "<div><dt>Crowds</dt><dd>" +
          esc(s.crowds) +
          "</dd></div>" +
          "<div><dt>Costs</dt><dd>" +
          esc(s.costs) +
          "</dd></div>" +
          "<div><dt>Flights (2)</dt><dd>" +
          esc(band2p(s.flightCostBand2p)) +
          "</dd></div>" +
          "</dl>" +
          (s.exampleDates ? "<p><strong>Example:</strong> " + esc(s.exampleDates) + "</p>" : "") +
          '<div class="chips">' +
          (s.pros || []).slice(0, 3).map((p) => '<span class="chip" aria-disabled="true">' + esc(p) + "</span>").join("") +
          "</div></div></article>"
        );
      })
      .join("");

    const tableRows = KB.seasons
      .map((s) => {
        const cells = SCORE_KEYS.map((k) => "<td>" + (s.scores[k] ?? "—") + "</td>").join("");
        return (
          "<tr><th>" +
          esc(s.name) +
          "<small>" +
          esc(s.months) +
          "</small></th>" +
          cells +
          "<td>" +
          esc(band2p(s.flightCostBand2p)) +
          "</td></tr>"
        );
      })
      .join("");

    return (
      '<div class="step__title">When should you go?</div>' +
      '<p class="step__intro">Drag the weights toward what matters, then pick a window. Scores are research heuristics, not bookings.</p>' +
      '<div class="step__grid">' +
      '<aside class="side"><h4>Your weights</h4><div class="weights">' +
      weights +
      "</div>" +
      '<p class="mini-dt" style="margin-top:18px">Trip length</p>' +
      '<div class="seg" role="group" aria-label="Depart day">' +
      (KB.meta.tripFrame.departOptions || [])
        .map(
          (d) =>
            '<button type="button" data-action="depart" data-id="' +
            esc(d.id) +
            '" aria-pressed="' +
            String(state.departId === d.id) +
            '">' +
            esc(d.label) +
            "</button>"
        )
        .join("") +
      "</div>" +
      (function () {
        const d = (KB.meta.tripFrame.departOptions || []).find((x) => x.id === state.departId);
        return d
          ? "<p style=\"margin-top:12px;color:var(--muted);font-size:0.95rem\">" +
              esc(d.note) +
              " (~" +
              d.nightsInJapan +
              " nights).</p>"
          : "";
      })() +
      "</aside>" +
      '<div><h4>Ranked windows</h4><div class="winlist">' +
      wins +
      "</div></div></div>" +
      '<div class="step__block"><h4>Season scoreboard</h4>' +
      '<div class="table-wrap"><table><thead><tr><th>Window</th><th>Weather</th><th>Crowds</th><th>Cost</th><th>Sakura</th><th>Foliage</th><th>Flights (2)</th></tr></thead><tbody>' +
      tableRows +
      "</tbody></table></div></div>"
    );
  }

  function renderFlightsStep() {
    const f = KB.flights;
    const season = KB.seasons.find((s) => s.id === state.seasonId);
    const selected = (f.options || []).find((o) => o.id === state.flightId) || f.options[0];
    const low = f.baseline.perPersonLow * (selected.multiplierLow || 1) * 2;
    const high = f.baseline.perPersonHigh * (selected.multiplierHigh || 1) * 2;
    const seasonBand = season ? band2p(season.flightCostBand2p) : null;

    const options = (f.options || [])
      .map((o) => {
        const picked = state.flightId === o.id;
        const disabled = o.selectable === false;
        return (
          '<article class="option' +
          (picked ? " is-picked" : "") +
          (disabled ? " is-disabled" : "") +
          '">' +
          '<div class="option__verdict">' +
          esc(o.verdict || (disabled ? "Skip" : "Option")) +
          "</div>" +
          "<h5>" +
          esc(o.name) +
          "</h5>" +
          '<p class="option__sub">' +
          esc(o.route) +
          " · " +
          esc(o.stops) +
          "</p>" +
          "<p>" +
          esc(o.why) +
          "</p>" +
          '<ul class="bullets">' +
          (o.pros || []).slice(0, 3).map((p) => "<li>" + esc(p) + "</li>").join("") +
          "</ul>" +
          (disabled
            ? ""
            : '<button type="button" class="btn btn--small' +
              (picked ? " btn--picked" : "") +
              '" data-action="pick-flight" data-id="' +
              esc(o.id) +
              '">' +
              (picked ? "Selected" : "Select") +
              "</button>") +
          "</article>"
        );
      })
      .join("");

    const months = (f.monthlySignals || [])
      .map(
        (m) =>
          '<div class="band' +
          (season && String(season.name + season.months).toLowerCase().includes(m.month.toLowerCase().slice(0, 3))
            ? " is-picked"
            : "") +
          '"><span class="band__name">' +
          esc(m.month) +
          '</span><span class="band__note">' +
          esc(m.note) +
          '</span><span class="band__val">' +
          money(m.perPerson) +
          "/person</span></div>"
      )
      .join("");

    return (
      '<div class="step__title">How should you fly?</div>' +
      '<p class="step__intro">' +
      esc(f.estimateLabel) +
      "</p>" +
      '<div class="honesty"><div><p class="kicker">Airport reality</p><h4>' +
      esc(f.honesty.headline) +
      "</h4><p>" +
      esc(f.honesty.body) +
      '</p><ul class="bullets">' +
      (f.honesty.points || []).map((p) => "<li>" + esc(p) + "</li>").join("") +
      '</ul></div><div class="estimate"><p class="kicker">Estimate for two</p>' +
      '<p class="estimate__figure">' +
      money(low) +
      "–" +
      money(high) +
      "</p>" +
      "<p>" +
      esc(selected.name) +
      ", economy round trip, research band.</p>" +
      (seasonBand ? "<p>Selected season window: <strong>" + esc(seasonBand) + "</strong></p>" : "") +
      "</div></div>" +
      '<div class="step__block"><h4>Route choices</h4><div class="options">' +
      options +
      "</div></div>" +
      '<div class="step__block"><h4>Monthly fare signals (per person)</h4><div class="bands">' +
      months +
      "</div></div>" +
      '<div class="step__block"><h4>Booking tips</h4><ul class="bullets">' +
      (f.bookingTips || []).map((t) => "<li>" + esc(t) + "</li>").join("") +
      "</ul></div>"
    );
  }

  function cardHTML(item, compact) {
    const starred = isStarred(item.id);
    const kindLabel =
      item.kind === "destination" ? "Place" : item.kind === "activity" ? "Do" : "Stay";
    const dot =
      item.kind === "activity"
        ? "dot dot--activity"
        : item.kind === "stay"
          ? "dot dot--stay"
          : "dot";
    return (
      '<article class="card' +
      (starred ? " is-starred" : "") +
      (state.selectedId === item.id ? " is-selected" : "") +
      '" data-id="' +
      esc(item.id) +
      '">' +
      '<div class="card__meta"><span class="' +
      dot +
      '"></span><span>' +
      esc(kindLabel) +
      "</span><span>" +
      esc(item.region || "") +
      "</span><span>" +
      esc(item.meta || "") +
      "</span></div>" +
      '<button type="button" class="card__title" data-action="detail" data-id="' +
      esc(item.id) +
      '">' +
      esc(item.name) +
      "</button>" +
      (compact ? "" : '<p class="card__why">' + esc(item.why) + "</p>") +
      '<div class="card__foot"><div class="card__facts">' +
      (item.forWhom
        ? '<span class="' + whoClass(item.forWhom) + '">' + esc(whoLabel(item.forWhom)) + "</span>"
        : "") +
      (item.marriott ? '<span class="tag tag--marriott">Marriott</span>' : "") +
      (item.source === "vault" ? '<span class="tag tag--vault">Vault</span>' : "") +
      (item.nights
        ? "<span>" +
          esc(/day|half/i.test(item.nights) ? item.nights : item.nights + " nights") +
          "</span>"
        : "") +
      (item.costBand ? "<span>" + esc(item.costBand) + "</span>" : "") +
      (item.priceBand ? "<span>" + esc(item.priceBand) + "</span>" : "") +
      '</div><div class="card__actions">' +
      '<button type="button" class="icon-btn icon-btn--star" data-action="star" data-id="' +
      esc(item.id) +
      '" aria-pressed="' +
      String(starred) +
      '" aria-label="' +
      (starred ? "Unstar" : "Star") +
      " " +
      esc(item.name) +
      '">' +
      iconStar() +
      "</button>" +
      '<button type="button" class="icon-btn icon-btn--remove" data-action="remove" data-id="' +
      esc(item.id) +
      '" aria-label="Remove ' +
      esc(item.name) +
      '">' +
      iconX() +
      "</button>" +
      "</div></div></article>"
    );
  }

  function renderStayStep() {
    const stays = ALL.filter((i) => i.kind === "stay" && !isRemoved(i.id));
    const marriott = stays.filter((s) => s.marriott);
    const others = stays.filter((s) => !s.marriott);
    return (
      '<div class="step__title">Where should you sleep?</div>' +
      '<p class="step__intro">Vault: recent trips used Marriott points. Research: one ryokan night usually beats a third identical business hotel. Star a shortlist; remove what you will never book.</p>' +
      '<div class="balance"><div><p class="kicker">Suggested ladder</p><ol class="ladder">' +
      "<li><span class=\"ladder__n\">01</span><div><div class=\"ladder__t\">Tokyo base</div><p class=\"ladder__p\">Bonvoy or design hotel near a coffee/anime day plan.</p></div></li>" +
      "<li><span class=\"ladder__n\">02</span><div><div class=\"ladder__t\">One ryokan bridge</div><p class=\"ladder__p\">Hakone or a Kyoto onsen night if the season is cold.</p></div></li>" +
      "<li><span class=\"ladder__n\">03</span><div><div class=\"ladder__t\">Kyoto machiya or hotel</div><p class=\"ladder__p\">Townhouse mornings vs station convenience.</p></div></li>" +
      '</ol></div><div class="balance__note"><p class="kicker">On the shortlist</p><strong>' +
      stays.filter((s) => isStarred(s.id)).length +
      "</strong><p>stays starred</p></div></div>" +
      (marriott.length
        ? '<div class="step__block"><h4>Marriott / Bonvoy</h4><div class="cards">' +
          marriott.map((s) => cardHTML(s)).join("") +
          "</div></div>"
        : "") +
      '<div class="step__block"><h4>Ryokan, machiya & other</h4><div class="cards">' +
      others.map((s) => cardHTML(s)).join("") +
      "</div></div>"
    );
  }

  function renderDoStep() {
    const itins = (KB.sampleItineraries || [])
      .map((it) => {
        const days = (it.days || [])
          .slice(0, 4)
          .map((d) => "<li><strong>Day " + d.day + " · " + esc(d.title) + "</strong> — " + esc(d.plan) + "</li>")
          .join("");
        return (
          '<article class="option"><div class="option__verdict">' +
          esc(it.pace) +
          "</div><h5>" +
          esc(it.name) +
          "</h5><p>" +
          esc(it.tagline) +
          '</p><p class="option__bases">' +
          (it.bases || []).map((b) => esc(b.place) + " " + b.nights + "n").join(" · ") +
          '</p><ul class="bullets">' +
          days +
          '</ul><button type="button" class="btn btn--small" data-action="apply-itin" data-id="' +
          esc(it.id) +
          '">Star this shape</button></article>'
        );
      })
      .join("");

    const picks = ALL.filter(
      (i) =>
        (i.kind === "destination" || i.kind === "activity") &&
        !isRemoved(i.id) &&
        (i.source === "vault" || (i.fitTags || []).some((t) => /anime|coffee|tea|cel|garden|ufo/i.test(t)))
    ).slice(0, 12);

    return (
      '<div class="step__title">What should you do?</div>' +
      '<p class="step__intro">Unconstrained on purpose. Star shared spine days, then add Jon or Kathleen branches. The atlas below holds the full set.</p>' +
      '<div class="step__block"><h4>Sample nine-day shapes</h4><div class="options">' +
      itins +
      "</div></div>" +
      '<div class="step__block"><h4>High-signal starting picks</h4><div class="cards">' +
      picks.map((p) => cardHTML(p)).join("") +
      "</div>" +
      '<p style="margin-top:16px"><a class="btn btn--primary" href="#atlas">Open full atlas + map</a></p></div>'
    );
  }

  function renderQuestions() {
    renderStepper();
    renderStepPanel();
    renderStepNav();
  }

  function filteredItems() {
    const f = state.filters;
    const q = (f.q || "").trim().toLowerCase();
    return ALL.filter((item) => {
      if (isRemoved(item.id)) return false;
      if (f.kind !== "all" && item.kind !== f.kind) return false;
      if (f.region !== "all" && item.region !== f.region) return false;
      if (f.starredOnly && !isStarred(item.id)) return false;
      if (!q) return true;
      const hay = [item.name, item.why, item.region, item.meta, item.area, (item.fitTags || []).join(" ")]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderAtlasBar() {
    const el = $("#atlas-bar");
    if (!el) return;
    const regions = ["all"].concat(KB.regions.map((r) => r.name));
    el.innerHTML =
      '<label class="field field--search">Search<input type="search" name="q" value="' +
      esc(state.filters.q) +
      '" placeholder="UFO, tea, Nakano…" data-action="filter-q"></label>' +
      '<label class="field">Kind<select data-action="filter-kind">' +
      ["all", "destination", "activity", "stay"]
        .map(
          (k) =>
            '<option value="' +
            k +
            '"' +
            (state.filters.kind === k ? " selected" : "") +
            ">" +
            (k === "all" ? "All kinds" : k.charAt(0).toUpperCase() + k.slice(1) + "s") +
            "</option>"
        )
        .join("") +
      "</select></label>" +
      '<label class="field">Region<select data-action="filter-region">' +
      regions
        .map(
          (r) =>
            '<option value="' +
            esc(r) +
            '"' +
            (state.filters.region === r ? " selected" : "") +
            ">" +
            esc(r === "all" ? "All regions" : r) +
            "</option>"
        )
        .join("") +
      "</select></label>" +
      '<button type="button" class="chip" data-action="filter-starred" aria-pressed="' +
      String(!!state.filters.starredOnly) +
      '">Starred only</button>';
  }

  function renderAtlasList() {
    const el = $("#atlas-list");
    if (!el) return;
    const items = filteredItems();
    const groups = { destination: [], activity: [], stay: [] };
    items.forEach((i) => groups[i.kind].push(i));
    let html =
      '<div class="atlas__status">' +
      items.length +
      " showing · " +
      Object.keys(state.removed).length +
      " removed · " +
      Object.keys(state.starred).filter((id) => state.starred[id] && !state.removed[id]).length +
      " starred</div>";
    ["destination", "activity", "stay"].forEach((kind) => {
      if (!groups[kind].length) return;
      const label = kind === "destination" ? "Places" : kind === "activity" ? "Activities" : "Stays";
      html += '<h3 class="group-head">' + label + "</h3>";
      html += groups[kind].map((i) => cardHTML(i, true)).join("");
    });
    if (!items.length) {
      html +=
        '<div class="nomatch"><p>Nothing matches these filters.</p>' +
        '<button type="button" class="btn btn--small" data-action="clear-filters">Clear filters</button></div>';
    }
    el.innerHTML = html;
  }

  function renderLegend() {
    const el = $("#map-legend");
    if (!el) return;
    el.innerHTML =
      '<span><i class="pin"></i> Place</span>' +
      '<span><i class="pin pin--activity"></i> Activity</span>' +
      '<span><i class="pin pin--stay"></i> Stay</span>' +
      '<span><i class="pin is-starred"></i> Starred</span>' +
      (Object.keys(state.removed).length
        ? '<button type="button" class="linkish" data-action="tray-open">Restore removed</button>'
        : "");
  }

  function pinIcon(item) {
    const starred = isStarred(item.id);
    const selected = state.selectedId === item.id;
    const cls =
      "pin" +
      (item.kind === "activity" ? " pin--activity" : item.kind === "stay" ? " pin--stay" : "") +
      (starred ? " is-starred" : "") +
      (selected ? " is-selected" : "");
    return L.divIcon({
      className: "pin-wrap",
      html: '<span class="' + cls + '"></span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  function ensureMap() {
    if (map || typeof L === "undefined") {
      if (map) setTimeout(() => map.invalidateSize(), 50);
      return;
    }
    const el = $("#map");
    if (!el) return;
    map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    map.setView([36.2, 137.5], 5);
    map.on("click", () => {
      /* keep */
    });
  }

  function refreshMap() {
    ensureMap();
    if (!map) return;
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};
    const items = filteredItems().filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
    items.forEach((item) => {
      const marker = L.marker([item.lat, item.lng], { icon: pinIcon(item), keyboard: true, title: item.name });
      marker.bindTooltip(item.name, { className: "pin-tip", direction: "top", offset: [0, -8] });
      marker.on("click", () => openDetail(item.id));
      marker.addTo(map);
      markers[item.id] = marker;
    });
    if (items.length) {
      const group = L.featureGroup(Object.values(markers));
      try {
        map.fitBounds(group.getBounds().pad(0.18), { maxZoom: 7 });
      } catch (e) {
        map.setView([36.2, 137.5], 5);
      }
    }
    setTimeout(() => map.invalidateSize(), 80);
  }

  function refreshAtlas() {
    renderAtlasBar();
    renderAtlasList();
    renderLegend();
    refreshMap();
    updateStarCount();
    renderYourPlan();
    renderTray();
  }

  function renderYourPlan() {
    const el = $("#yourplan-body");
    if (!el) return;
    const season = KB.seasons.find((s) => s.id === state.seasonId);
    const flight = (KB.flights.options || []).find((o) => o.id === state.flightId);
    const depart = (KB.meta.tripFrame.departOptions || []).find((d) => d.id === state.departId);
    const starred = ALL.filter((i) => isStarred(i.id) && !isRemoved(i.id));

    function pickList(kind, label) {
      const rows = starred.filter((i) => i.kind === kind);
      if (!rows.length) return "";
      return (
        "<div><h3>" +
        esc(label) +
        '</h3><ul>' +
        rows
          .map(
            (i) =>
              "<li><button type=\"button\" class=\"picks__name\" data-action=\"detail\" data-id=\"" +
              esc(i.id) +
              '">' +
              esc(i.name) +
              '</button><span class="picks__meta">' +
              esc(i.region || i.meta || "") +
              '</span><button type="button" class="icon-btn icon-btn--remove" data-action="unstar" data-id="' +
              esc(i.id) +
              '" aria-label="Unstar">' +
              iconX() +
              "</button></li>"
          )
          .join("") +
        "</ul></div>"
      );
    }

    el.innerHTML =
      '<p class="kicker" id="yourplan-title">Your plan</p>' +
      "<h2>What you have decided so far.</h2>" +
      '<div class="yourplan__grid"><div>' +
      '<dl class="ledger">' +
      "<div><dt>Season</dt><dd><strong>" +
      esc(season ? season.name : "Not chosen") +
      "</strong><span>" +
      esc(season ? season.months : "Use step 1") +
      "</span></dd>" +
      (season
        ? '<dd><button type="button" class="linkish" data-action="step" data-step="0">Change</button></dd>'
        : "<dd></dd>") +
      "</div>" +
      "<div><dt>Flights</dt><dd><strong>" +
      esc(flight ? flight.name : "Not chosen") +
      "</strong><span>" +
      esc(flight ? flight.route : "") +
      (depart ? " · " + esc(depart.label) : "") +
      "</span></dd><dd><button type=\"button\" class=\"linkish\" data-action=\"step\" data-step=\"1\">Change</button></dd></div>" +
      "<div><dt>Starred</dt><dd><strong>" +
      starred.length +
      "</strong><span>places, activities and stays</span></dd><dd></dd></div>" +
      "</dl>" +
      '<div class="picks">' +
      pickList("destination", "Places") +
      pickList("activity", "Activities") +
      pickList("stay", "Stays") +
      "</div></div><div>" +
      '<label class="notes-field"><h3>Shared notes</h3>' +
      '<textarea data-action="notes" placeholder="Budget ceiling, childcare week, must-skip temples, pearl stop…">' +
      esc(state.notes) +
      "</textarea>" +
      "<small>Saved in this browser. Export JSON to share with each other.</small></label>" +
      '<div class="datatools"><div class="datatools__btns">' +
      '<button type="button" class="btn btn--onink btn--small" data-action="export">Export JSON</button>' +
      '<button type="button" class="btn btn--onink btn--small" data-action="import">Import JSON</button>' +
      '<button type="button" class="btn btn--onink btn--small" data-action="reset">Reset choices</button>' +
      '</div><p>Export keeps stars, removals, season, flight and notes. Import merges into this browser.</p>' +
      '<p class="datatools__status" id="data-status" hidden></p></div></div></div>';
  }

  function openDetail(id) {
    const item = BY_ID[id];
    const drawer = $("#detail");
    if (!item || !drawer) return;
    state.selectedId = id;
    persist();
    const facts = [];
    if (item.kind === "destination") {
      facts.push(["Type", item.meta], ["Region", item.region], ["Energy", item.energy], ["Nights", item.nights]);
    } else if (item.kind === "activity") {
      facts.push(
        ["Category", item.meta],
        ["Area", item.area],
        ["Duration", item.durationHours + " h"],
        ["Cost", item.costBand],
        ["Who", whoLabel(item.forWhom)]
      );
    } else {
      facts.push(
        ["Style", item.meta],
        ["Area", item.area],
        ["Price", item.priceBand],
        ["Marriott", item.marriott ? "Yes" : "No"]
      );
    }

    const related = ALL.filter(
      (o) =>
        o.id !== item.id &&
        !isRemoved(o.id) &&
        ((item.destId && o.id === item.destId) ||
          (o.destId && o.destId === item.id) ||
          (o.destId && item.destId && o.destId === item.destId))
    ).slice(0, 6);

    drawer.hidden = false;
    drawer.innerHTML =
      '<div class="drawer__head"><div><span class="' +
      tagClass(item.source === "vault" ? "Vault" : "Research") +
      '">' +
      esc(item.source === "vault" ? "Vault" : "Research") +
      "</span><h3>" +
      esc(item.name) +
      '</h3></div><button type="button" class="icon-btn" data-action="close-detail" aria-label="Close">' +
      iconX() +
      "</button></div>" +
      '<div class="drawer__body"><p class="drawer__lead">' +
      esc(item.why) +
      '</p><dl class="drawer__facts">' +
      facts
        .filter(([, v]) => v)
        .map((pair) => "<div><dt>" + esc(pair[0]) + "</dt><dd>" + esc(pair[1]) + "</dd></div>")
        .join("") +
      "</dl>" +
      (item.highlights && item.highlights.length
        ? "<div><h4>Highlights</h4><ul class=\"bullets\">" +
          item.highlights.map((h) => "<li>" + esc(h) + "</li>").join("") +
          "</ul></div>"
        : "") +
      (item.fitTags && item.fitTags.length
        ? "<div><h4>Fit tags</h4><ul class=\"fit\">" +
          item.fitTags.map((t) => "<li>" + esc(t) + "</li>").join("") +
          "</ul></div>"
        : "") +
      (item.vaultNote
        ? '<div class="drawer__note">' + esc(item.vaultNote) + "</div>"
        : "") +
      (item.notes ? '<div class="drawer__note">' + esc(item.notes) + "</div>" : "") +
      (related.length
        ? "<div><h4>Related</h4><div class=\"related\">" +
          related
            .map(
              (r) =>
                '<button type="button" data-action="detail" data-id="' +
                esc(r.id) +
                '"><span>' +
                esc(r.name) +
                "</span><small>" +
                esc(r.kind) +
                "</small></button>"
            )
            .join("") +
          "</div></div>"
        : "") +
      '</div><div class="drawer__foot">' +
      '<button type="button" class="btn btn--small' +
      (isStarred(item.id) ? " btn--picked" : "") +
      '" data-action="star" data-id="' +
      esc(item.id) +
      '">' +
      (isStarred(item.id) ? "Starred" : "Star") +
      "</button>" +
      '<button type="button" class="btn btn--small" data-action="remove" data-id="' +
      esc(item.id) +
      '">Remove</button>' +
      (item.lat
        ? '<button type="button" class="btn btn--small btn--ghost" data-action="focus-map" data-id="' +
          esc(item.id) +
          '">Show on map</button>'
        : "") +
      "</div>";

    if (state.mode === "plan") {
      renderAtlasList();
      refreshMap();
    }
  }

  function closeDetail() {
    state.selectedId = null;
    const drawer = $("#detail");
    if (drawer) {
      drawer.hidden = true;
      drawer.innerHTML = "";
    }
    if (state.mode === "plan") {
      renderAtlasList();
      refreshMap();
    }
  }

  function toggleStar(id) {
    if (isRemoved(id)) return;
    if (state.starred[id]) delete state.starred[id];
    else state.starred[id] = true;
    persist();
    announce(isStarred(id) ? "Starred" : "Unstarred");
    afterMutation(id);
  }

  function removeItem(id) {
    const item = BY_ID[id];
    if (!item) return;
    state.removed[id] = true;
    delete state.starred[id];
    state.lastRemoved = id;
    persist();
    if (state.selectedId === id) closeDetail();
    announce("Removed " + item.name);
    showToast(item.name);
    afterMutation(id);
  }

  function restoreItem(id) {
    delete state.removed[id];
    if (state.lastRemoved === id) state.lastRemoved = null;
    persist();
    announce("Restored");
    afterMutation(id);
  }

  function afterMutation() {
    updateStarCount();
    if (state.mode === "plan") {
      renderQuestions();
      refreshAtlas();
    }
    if (state.selectedId && BY_ID[state.selectedId] && !isRemoved(state.selectedId)) {
      openDetail(state.selectedId);
    }
  }

  function showToast(name) {
    renderTray();
    const tray = $("#tray");
    if (!tray) return;
    clearTimeout(toastTimer);
    const toast = document.createElement("div");
    toast.className = "tray__toast";
    toast.innerHTML =
      "<span>Removed " +
      esc(name) +
      '</span><button type="button" data-action="undo-remove">Undo</button>';
    tray.prepend(toast);
    toastTimer = setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  function renderTray() {
    const tray = $("#tray");
    if (!tray) return;
    const removedIds = Object.keys(state.removed).filter((id) => state.removed[id] && BY_ID[id]);
    const toasts = $$(".tray__toast", tray);
    tray.innerHTML = "";
    toasts.forEach((t) => tray.appendChild(t));
    if (!removedIds.length) {
      state.trayOpen = false;
      return;
    }
    if (!state.trayOpen) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "tray__pill";
      pill.dataset.action = "tray-open";
      pill.textContent = removedIds.length + " removed — restore";
      tray.appendChild(pill);
      return;
    }
    const box = document.createElement("div");
    box.className = "tray__list";
    box.innerHTML =
      "<header><span>Removed</span><button type=\"button\" data-action=\"tray-close\">Close</button></header><ul>" +
      removedIds
        .map(
          (id) =>
            "<li><span>" +
            esc(BY_ID[id].name) +
            '</span><button type="button" data-action="restore" data-id="' +
            esc(id) +
            '">Restore</button></li>'
        )
        .join("") +
      "</ul>";
    tray.appendChild(box);
  }

  function applyItinerary(id) {
    const it = (KB.sampleItineraries || []).find((x) => x.id === id);
    if (!it) return;
    (it.destinationIds || []).concat(it.highlightIds || []).forEach((pid) => {
      if (BY_ID[pid] && !isRemoved(pid)) state.starred[pid] = true;
    });
    persist();
    announce("Starred itinerary shape");
    afterMutation();
  }

  function exportJSON() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      seasonId: state.seasonId,
      flightId: state.flightId,
      departId: state.departId,
      weights: state.weights,
      starred: Object.keys(state.starred).filter((id) => state.starred[id]),
      removed: Object.keys(state.removed).filter((id) => state.removed[id]),
      notes: state.notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gulch-japan-plan.json";
    a.click();
    URL.revokeObjectURL(url);
    setDataStatus("Exported.");
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        if (data.seasonId) state.seasonId = data.seasonId;
        if (data.flightId) state.flightId = data.flightId;
        if (data.departId) state.departId = data.departId;
        if (data.weights) state.weights = { ...state.weights, ...data.weights };
        if (typeof data.notes === "string") state.notes = data.notes;
        state.starred = {};
        state.removed = {};
        (data.starred || []).forEach((id) => {
          if (BY_ID[id]) state.starred[id] = true;
        });
        (data.removed || []).forEach((id) => {
          if (BY_ID[id]) state.removed[id] = true;
        });
        persist();
        afterMutation();
        setDataStatus("Imported.");
      } catch (e) {
        setDataStatus("Import failed — check the JSON.");
      }
    };
    reader.readAsText(file);
  }

  function setDataStatus(msg) {
    const el = $("#data-status");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function resetChoices() {
    if (!window.confirm("Reset stars, removals, season, flight and notes in this browser?")) return;
    const mode = state.mode;
    state = defaultState();
    state.mode = mode;
    persist();
    closeDetail();
    renderAll();
    setDataStatus("Reset.");
  }

  function onClick(e) {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    const id = t.getAttribute("data-id");

    if (action === "mode") {
      e.preventDefault();
      setMode(t.getAttribute("data-mode"), t.getAttribute("data-scroll") === "1");
      return;
    }
    if (action === "goto-plan") {
      setMode("plan", true);
      return;
    }
    if (action === "step") {
      state.step = Number(t.getAttribute("data-step")) || 0;
      persist();
      renderQuestions();
      $("#questions") && $("#questions").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "weight") return;
    if (action === "pick-season") {
      state.seasonId = id;
      persist();
      renderQuestions();
      renderYourPlan();
      return;
    }
    if (action === "pick-flight") {
      state.flightId = id;
      persist();
      renderQuestions();
      renderYourPlan();
      return;
    }
    if (action === "depart") {
      state.departId = id;
      persist();
      renderQuestions();
      renderYourPlan();
      return;
    }
    if (action === "star") {
      toggleStar(id);
      return;
    }
    if (action === "unstar") {
      delete state.starred[id];
      persist();
      afterMutation();
      return;
    }
    if (action === "remove") {
      removeItem(id);
      return;
    }
    if (action === "restore") {
      restoreItem(id);
      return;
    }
    if (action === "undo-remove") {
      if (state.lastRemoved) restoreItem(state.lastRemoved);
      return;
    }
    if (action === "detail") {
      openDetail(id);
      return;
    }
    if (action === "close-detail") {
      closeDetail();
      return;
    }
    if (action === "focus-map") {
      const item = BY_ID[id];
      if (item && map) {
        map.setView([item.lat, item.lng], 11, { animate: true });
        openDetail(id);
      }
      return;
    }
    if (action === "filter-starred") {
      state.filters.starredOnly = !state.filters.starredOnly;
      persist();
      refreshAtlas();
      return;
    }
    if (action === "clear-filters") {
      state.filters = { q: "", kind: "all", region: "all", starredOnly: false };
      persist();
      refreshAtlas();
      return;
    }
    if (action === "apply-itin") {
      applyItinerary(id);
      return;
    }
    if (action === "export") {
      exportJSON();
      return;
    }
    if (action === "import") {
      const input = $("#import-file");
      if (input) input.click();
      return;
    }
    if (action === "reset") {
      resetChoices();
      return;
    }
    if (action === "tray-open") {
      state.trayOpen = true;
      renderTray();
      return;
    }
    if (action === "tray-close") {
      state.trayOpen = false;
      renderTray();
      return;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const action = t.getAttribute("data-action");
    if (action === "weight") {
      const key = t.getAttribute("data-key");
      state.weights[key] = Number(t.value);
      const out = $("#wo-" + key);
      if (out) out.textContent = state.weights[key] + " / 5";
      persist();
      renderStepPanel();
      renderStepper();
      return;
    }
    if (action === "filter-q") {
      state.filters.q = t.value;
      persist();
      renderAtlasList();
      refreshMap();
      return;
    }
    if (action === "notes") {
      state.notes = t.value;
      persist();
      return;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const action = t.getAttribute("data-action");
    if (action === "filter-kind") {
      state.filters.kind = t.value;
      persist();
      refreshAtlas();
      return;
    }
    if (action === "filter-region") {
      state.filters.region = t.value;
      persist();
      refreshAtlas();
      return;
    }
    if (t.id === "import-file" && t.files && t.files[0]) {
      importJSON(t.files[0]);
      t.value = "";
    }
  }

  function onKey(e) {
    if (e.key === "Escape") closeDetail();
  }

  function renderAll() {
    renderReport();
    renderMode();
    renderQuestions();
    if (state.mode === "plan") refreshAtlas();
    else renderYourPlan();
    renderTray();
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);

  renderAll();
})();
