/* The interactive codebase map. Renders window.OVAT_MODULES (modules.js)
   into package cards, a detail panel, filters, search and a guided trace of
   one `ovat run`. Builds DOM with textContent only: no innerHTML from data. */
(function () {
  "use strict";

  var MODS = window.OVAT_MODULES || [];
  var GROUPS = window.OVAT_GROUPS || [];
  var LAYERS = window.OVAT_LAYERS || [];
  var TRACE = window.OVAT_TRACE || [];
  var REPO = "https://github.com/Lagmator22/ovat/blob/main/ovat/";
  var reduce = document.documentElement.classList.contains("reduce-motion");

  var root = document.getElementById("navigator");
  if (!root || !MODS.length) return;
  var pkgsEl = document.getElementById("pkgs");
  var chipsEl = document.getElementById("layer-chips");
  var searchEl = document.getElementById("mod-search");
  var detail = document.getElementById("detail");
  var countEl = document.getElementById("mod-count");
  var traceBtn = document.getElementById("trace-btn");
  var traceText = document.getElementById("trace-text");

  var maxLines = MODS.reduce(function (m, x) { return Math.max(m, x.l); }, 1);
  var byPath = {};
  MODS.forEach(function (m) { byPath[m.p] = m; });
  var buttons = {};
  var layerName = {};
  LAYERS.forEach(function (l) { layerName[l.id] = l.name; });
  var state = { layer: "all", q: "", selected: null };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function slug(p) { return "m-" + p.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, ""); }
  function fileName(p) { return p.split("/").pop(); }

  /* ---- render the package cards ---- */
  var totalLines = 0;
  GROUPS.forEach(function (g) {
    var mods = MODS.filter(function (m) { return m.g === g.id; });
    if (!mods.length) return;
    var card = el("section", "pkg");
    card.setAttribute("aria-label", g.name);
    var head = el("div", "pkg-head");
    head.appendChild(el("h3", null, g.name));
    head.appendChild(el("p", null, g.note));
    card.appendChild(head);
    var list = el("ul", "mods");
    mods.forEach(function (m) {
      totalLines += m.l;
      var li = el("li");
      var b = el("button", "mod");
      b.type = "button";
      b.id = slug(m.p);
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-controls", "detail");
      b.setAttribute("aria-label", m.p + ", " + m.l + " lines: " + m.t);
      b.appendChild(el("span", "mod-name", fileName(m.p)));
      b.appendChild(el("span", "mod-lines", m.l + " ln"));
      var bar = el("span", "mod-bar");
      bar.setAttribute("aria-hidden", "true");
      var fill = el("i");
      fill.style.setProperty("--w", Math.max(3, Math.round((m.l / maxLines) * 100)) + "%");
      bar.appendChild(fill);
      b.appendChild(bar);
      b.addEventListener("click", function () { stopTrace(); select(m.p, true); });
      li.appendChild(b);
      list.appendChild(li);
      buttons[m.p] = b;
    });
    card.appendChild(list);
    pkgsEl.appendChild(card);
  });

  /* ---- layer chips ---- */
  LAYERS.forEach(function (l) {
    var c = el("button", "chip-btn", l.name);
    c.type = "button";
    c.setAttribute("aria-pressed", l.id === "all" ? "true" : "false");
    c.addEventListener("click", function () {
      state.layer = l.id;
      Array.prototype.forEach.call(chipsEl.children, function (x) { x.setAttribute("aria-pressed", "false"); });
      c.setAttribute("aria-pressed", "true");
      applyFilter();
    });
    chipsEl.appendChild(c);
  });

  searchEl.addEventListener("input", function () { state.q = searchEl.value.trim().toLowerCase(); applyFilter(); });

  function matches(m) {
    if (state.layer !== "all" && m.layer !== state.layer) return false;
    if (!state.q) return true;
    var hay = (m.p + " " + m.t + " " + m.what + " " + (m.why || "")).toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }
  function applyFilter() {
    var n = 0;
    MODS.forEach(function (m) {
      var ok = matches(m);
      if (ok) n += 1;
      buttons[m.p].classList.toggle("is-dim", !ok);
    });
    countEl.textContent = n === MODS.length
      ? MODS.length + " modules, " + totalLines.toLocaleString("en-US") + " lines"
      : n + " of " + MODS.length + " modules match";
  }

  /* ---- detail panel ---- */
  function select(p, scroll, keepUrl) {
    var m = byPath[p];
    if (!m) return;
    state.selected = p;
    Object.keys(buttons).forEach(function (k) { buttons[k].setAttribute("aria-pressed", k === p ? "true" : "false"); });
    while (detail.firstChild) detail.removeChild(detail.firstChild);

    var head = el("div", "detail-head");
    head.appendChild(el("span", "detail-path", "ovat/" + m.p));
    var h = el("h2", null, m.t);
    h.id = "detail-title";
    head.appendChild(h);
    var meta = el("div", "detail-meta");
    meta.appendChild(el("span", "tag layer", layerName[m.layer] || m.layer));
    meta.appendChild(el("span", "tag", m.l + " lines"));
    if (m.layer === "tui") meta.appendChild(el("span", "tag tui", "tui extra"));
    head.appendChild(meta);
    detail.appendChild(head);

    var body = el("div", "detail-body");
    body.appendChild(el("h3", null, "What it does"));
    body.appendChild(el("p", null, m.what));
    if (m.why) {
      body.appendChild(el("h3", null, "Why it is built this way"));
      body.appendChild(el("p", "detail-why", m.why));
    }
    if (m.rel && m.rel.length) {
      body.appendChild(el("h3", null, "Works with"));
      var rel = el("div", "detail-related");
      m.rel.forEach(function (r) {
        if (!byPath[r]) return;
        var b = el("button", null, r);
        b.type = "button";
        b.addEventListener("click", function () { stopTrace(); select(r, true); buttons[r].focus(); });
        rel.appendChild(b);
      });
      body.appendChild(rel);
    }
    var link = el("a", "btn btn-ghost", "Open on GitHub ");
    link.href = REPO + m.p;
    link.rel = "noopener";
    var arr = el("span", "arr", "→");
    arr.setAttribute("aria-hidden", "true");
    link.appendChild(arr);
    body.appendChild(link);
    detail.appendChild(body);
    detail.setAttribute("aria-labelledby", "detail-title");

    if (!keepUrl) {
      try { history.replaceState(null, "", "#" + slug(m.p)); } catch (e) { /* file:// or sandbox */ }
    }
    if (scroll && window.matchMedia("(max-width: 1000px)").matches) {
      detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  /* ---- guided trace of one ovat run ---- */
  var traceTimer = 0;
  var traceIndex = -1;
  function clearTraceMarks() {
    Object.keys(buttons).forEach(function (k) { buttons[k].classList.remove("is-trace"); });
  }
  function stopTrace() {
    window.clearTimeout(traceTimer);
    if (traceIndex >= 0) {
      traceIndex = -1;
      traceBtn.textContent = "Follow one ovat run";
      traceBtn.setAttribute("aria-pressed", "false");
      clearTraceMarks();
    }
  }
  function traceStep() {
    traceIndex += 1;
    if (traceIndex >= TRACE.length) {
      traceText.textContent = "That is the whole path. Pick any module to read about it.";
      stopTrace();
      return;
    }
    var step = TRACE[traceIndex];
    clearTraceMarks();
    if (buttons[step.p]) buttons[step.p].classList.add("is-trace");
    traceText.textContent = (traceIndex + 1) + " of " + TRACE.length + ": " + step.say;
    select(step.p, false, true);
    traceTimer = window.setTimeout(traceStep, reduce ? 4200 : 2600);
  }
  traceBtn.addEventListener("click", function () {
    if (traceIndex >= 0) { stopTrace(); return; }
    state.layer = "all";
    state.q = "";
    searchEl.value = "";
    Array.prototype.forEach.call(chipsEl.children, function (x, i) { x.setAttribute("aria-pressed", i === 0 ? "true" : "false"); });
    applyFilter();
    traceBtn.textContent = "Stop";
    traceBtn.setAttribute("aria-pressed", "true");
    traceStep();
  });

  applyFilter();
  var fromHash = (location.hash || "").slice(1);
  var initial = MODS.filter(function (m) { return slug(m.p) === fromHash; })[0];
  select(initial ? initial.p : "agent/loop.py", false, true);
})();
