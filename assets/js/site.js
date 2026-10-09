/* Shared behaviour for every page: theme toggle, copy buttons, chart reveal,
   table-of-contents highlight. No dependencies, no network. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = root.classList.contains("reduce-motion");

  /* ---- theme toggle ---- */
  var toggle = document.getElementById("theme-toggle");
  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function syncToggle() {
    if (!toggle) return;
    var light = currentTheme() === "light";
    toggle.setAttribute("aria-pressed", light ? "true" : "false");
    toggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    toggle.title = light ? "Dark theme" : "Light theme";
  }
  if (toggle) {
    syncToggle();
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { window.localStorage.setItem("ovat-theme", next); } catch (e) { /* ignore */ }
      syncToggle();
    });
  }

  /* ---- copy buttons ----
     data-copy="literal text", or data-copy-from="#id" to copy an element's text. */
  function copyText(text, btn) {
    function done() {
      var label = btn.querySelector(".copy-label");
      var old = label ? label.textContent : "";
      btn.setAttribute("data-copied", "");
      if (label) label.textContent = "Copied";
      window.setTimeout(function () {
        btn.removeAttribute("data-copied");
        if (label) label.textContent = old;
      }, 1600);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.className = "sr-only";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* nothing more to try */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }
  /* Every code box gets a Copy button in its header bar. */
  document.querySelectorAll(".code").forEach(function (box) {
    var head = box.querySelector(".code-head");
    if (!head || head.querySelector(".copy-btn")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "copy-btn";
    b.setAttribute("data-copy-box", "");
    var label = head.textContent.trim();
    b.setAttribute("aria-label", "Copy " + (label || "code"));
    var l = document.createElement("span");
    l.className = "copy-label";
    l.textContent = "Copy";
    b.appendChild(l);
    head.appendChild(b);
  });

  /* A terminal block copies only its commands, without the "$ " prompts. */
  function commandsOnly(text) {
    var lines = text.split("\n");
    if (!lines.some(function (x) { return /^\$ /.test(x); })) return text;
    var out = [];
    var cont = false;
    lines.forEach(function (x) {
      if (/^\$ /.test(x)) { out.push(x.slice(2)); cont = /\\$/.test(x); }
      else if (cont) { out.push(x); cont = /\\$/.test(x); }
    });
    return out.join("\n");
  }

  document.addEventListener("click", function (ev) {
    var boxBtn = ev.target.closest ? ev.target.closest("[data-copy-box]") : null;
    if (boxBtn) {
      var box = boxBtn.closest(".code");
      var pres = box ? box.querySelectorAll("pre") : [];
      var all = Array.prototype.map.call(pres, function (pr) { return pr.textContent; }).join("\n");
      copyText(commandsOnly(all).replace(/\s+$/, "") + "\n", boxBtn);
      return;
    }
    var btn = ev.target.closest ? ev.target.closest("[data-copy], [data-copy-from]") : null;
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    if (text === null) {
      var src = document.querySelector(btn.getAttribute("data-copy-from"));
      var rows = src ? src.querySelectorAll(".anno-line") : [];
      if (rows.length) {
        text = Array.prototype.map.call(rows, function (r) { return r.textContent.replace(/\s+$/, ""); }).join("\n");
      } else {
        text = src ? src.textContent : "";
      }
    }
    copyText(text.replace(/\s+$/, "") + "\n", btn);
  });

  /* ---- geometry from data attributes ----
     The CSP forbids inline style attributes, so sizes travel as data-* and are
     applied through the CSSOM, which the policy allows. */
  var map = { w: "--w", h: "--h", x: "--x", y: "--y", i: "--i" };
  document.querySelectorAll("[data-flex]").forEach(function (el) {
    el.style.flexGrow = el.getAttribute("data-flex");
    el.style.flexBasis = "0";
  });
  Object.keys(map).forEach(function (k) {
    document.querySelectorAll("[data-" + k + "]").forEach(function (el) {
      if (el.closest("svg")) return;
      el.style.setProperty(map[k], el.getAttribute("data-" + k));
    });
  });

  /* Bars in a chart take turns: each gets its own position in the queue. */
  document.querySelectorAll(".anim").forEach(function (c) {
    var bars = c.querySelectorAll(".hbar-fill, .vbar-fill, .stack-bar");
    Array.prototype.forEach.call(bars, function (b, i) { b.style.setProperty("--i", String(i)); });
  });

  /* ---- charts draw themselves when they scroll into view ----
     At rest (no JS, reduced motion, or already on screen) they are drawn. */
  var charts = Array.prototype.slice.call(document.querySelectorAll(".anim"));
  if (!reduceMotion && "IntersectionObserver" in window && charts.length) {
    var vh = window.innerHeight || 800;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("anim-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    charts.forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (r.top > vh * 0.9) {
        c.classList.add("anim-ready");
        io.observe(c);
      }
    });
  }

  /* ---- SVG plots: drawn point by point, bar by bar ----
     A plot below the fold starts hidden and plays over data-dur ms when it
     scrolls into view. Already on screen, reduced motion or no JS: drawn. */
  var plots = Array.prototype.slice.call(document.querySelectorAll(".plot-wrap"));
  function playPlot(w) {
    var dur = parseInt(w.getAttribute("data-dur") || "2400", 10);
    var marks = Array.prototype.slice.call(w.querySelectorAll(".mk"));
    marks.sort(function (a, b) { return (+a.getAttribute("data-i")) - (+b.getAttribute("data-i")); });
    var step = marks.length ? dur / marks.length : 0;
    marks.forEach(function (m, k) { m.style.transitionDelay = Math.round(k * step) + "ms"; });
    w.querySelectorAll(".ln, .cap").forEach(function (ln) {
      ln.style.transition = "stroke-dashoffset " + dur + "ms linear";
    });
    w.style.setProperty("--area-delay", Math.round(dur * 0.6) + "ms");
    window.requestAnimationFrame(function () {
      w.classList.add("plot-in");
      w.querySelectorAll(".ln, .cap").forEach(function (ln) { ln.style.strokeDashoffset = "0"; });
    });
  }
  if (!reduceMotion && "IntersectionObserver" in window && plots.length) {
    var vh2 = window.innerHeight || 800;
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { pio.unobserve(e.target); playPlot(e.target); }
      });
    }, { threshold: 0.35 });
    plots.forEach(function (w) {
      if (w.getBoundingClientRect().top > vh2 * 0.85) {
        w.querySelectorAll(".ln, .cap").forEach(function (ln) {
          var len = Math.ceil(ln.getTotalLength ? ln.getTotalLength() : 2000);
          ln.style.strokeDasharray = len;
          ln.style.strokeDashoffset = len;
        });
        w.classList.add("plot-ready");
        pio.observe(w);
      }
    });
  }

  /* ---- table of contents: mark the section being read ---- */
  var toc = document.querySelector(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var tocIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("is-current"); });
        var a = byId[e.target.id];
        if (a) a.classList.add("is-current");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) tocIo.observe(el);
    });
  }

  /* ---- annotated YAML: a line and its note highlight together ---- */
  document.querySelectorAll("[data-anno]").forEach(function (block) {
    var lines = block.querySelectorAll("[data-note]");
    var notes = block.querySelectorAll(".anno-notes button");
    function select(key) {
      lines.forEach(function (l) { l.classList.toggle("is-current", l.getAttribute("data-note") === key); });
      notes.forEach(function (n) {
        var on = n.getAttribute("data-key") === key;
        n.classList.toggle("is-current", on);
        n.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    lines.forEach(function (l) {
      l.addEventListener("click", function () { select(l.getAttribute("data-note")); });
    });
    notes.forEach(function (n) {
      n.addEventListener("click", function () { select(n.getAttribute("data-key")); });
      n.addEventListener("mouseenter", function () { select(n.getAttribute("data-key")); });
    });
  });

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
