/* Motion shared by every page: the robot on the reading-progress line, titles
   that rise word by word, blocks that fade up as they scroll in, and numbers
   that count up. No dependencies, no network. Everything here is decoration:
   with this file missing, or with reduced motion, the page is complete. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = root.classList.contains("reduce-motion");
  var hasIO = "IntersectionObserver" in window;

  /* ---- the robot: 16 rows of 8 characters, the left half of a 16x16 grid,
     mirrored when drawn. The same sprite stands for OVAT on gurman.is-a.dev. ---- */
  var ROBOT = {
    pal: { o: "#1b2a4e", b: "#5b8def", s: "#3e6bc4", h: "#a9c6ff", a: "#7cf5c4", d: "#16223f" },
    rows: [".......a", ".......o", "..oooooo", ".obhhbbb", ".obbbbbb", "oobddddd", "oobdaadd", "oobdaadd",
           ".obddddd", ".osbbbbb", "..oooooo", ".oobbbbb", "obobhbbb", "oo.obbbb", "...ossss", "...ooo.o"],
    blink: { 6: "oobddddd" }
  };
  function mirror(row) { return row + row.split("").reverse().join(""); }
  var OPEN = ROBOT.rows.map(mirror);
  var SHUT = ROBOT.rows.map(function (r, i) { return mirror(ROBOT.blink[i] || r); });

  function paint(canvas, rows) {
    var ctx = canvas.getContext("2d"), x, y, c;
    ctx.clearRect(0, 0, 16, 16);
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        c = rows[y][x];
        if (c !== ".") { ctx.fillStyle = ROBOT.pal[c]; ctx.fillRect(x, y, 1, 1); }
      }
    }
  }
  document.querySelectorAll("canvas[data-robot]").forEach(function (canvas) {
    paint(canvas, OPEN);
    if (reduceMotion) return;
    (function blink() {
      window.setTimeout(function () {
        paint(canvas, SHUT);
        window.setTimeout(function () { paint(canvas, OPEN); blink(); }, 140);
      }, 2400 + Math.random() * 4200);
    })();
  });

  /* ---- reading progress ---- */
  var top = document.querySelector(".top");
  var walker = document.querySelector(".walker");
  var walkTimer = 0;
  function measure() { if (top) top.style.setProperty("--track-w", top.clientWidth + "px"); }
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    top.classList.toggle("is-scrolled", window.scrollY > 8);
    top.style.setProperty("--p", p.toFixed(4));
    if (walker && !reduceMotion) {
      walker.classList.add("is-walking");
      window.clearTimeout(walkTimer);
      walkTimer = window.setTimeout(function () { walker.classList.remove("is-walking"); }, 160);
    }
  }
  if (top) {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (walker) walker.classList.remove("is-walking");
  }

  /* ---- titles rise word by word ----
     Words are wrapped where they stand, so <br> and inner spans survive. */
  function splitWords(node, state) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var parts = child.textContent.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          var box = document.createElement("span");
          var inner = document.createElement("span");
          box.className = "word";
          inner.textContent = part;
          inner.style.setProperty("--i", String(state.i++));
          box.appendChild(inner);
          frag.appendChild(box);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== "BR") {
        splitWords(child, state);
      }
    });
  }
  document.querySelectorAll(".display").forEach(function (title) {
    if (!reduceMotion) splitWords(title, { i: 0 });
    title.classList.add("is-split");
  });

  if (reduceMotion || !hasIO) return;

  /* ---- blocks fade up once as they scroll in ----
     Only blocks that start below the fold are hidden, so nothing on the first
     screen ever blinks. Big layout containers are skipped: their children move. */
  var vh = window.innerHeight || 800;
  var blocks = document.querySelectorAll(
    ".section > .wrap > *, .section > .wrap.split > * > *, .arch-sec > *, .guide-step, .foot-grid > *"
  );
  var revealIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      /* On screen, or already scrolled past (a jump from the contents list):
         either way it must not stay hidden. */
      if (!e.isIntersecting && e.boundingClientRect.bottom > 0) return;
      revealIo.unobserve(e.target);
      e.target.classList.add("is-in");
    });
  }, { threshold: 0 });
  Array.prototype.forEach.call(blocks, function (el) {
    if (el.matches(".with-toc, .navigator, .arch-body, .guide-steps, .split, .toc")) return;
    if (el.closest("[data-rv]")) return;
    if (el.getBoundingClientRect().top < vh * 0.95) return;
    el.setAttribute("data-rv", "");
    revealIo.observe(el);
  });

  /* ---- headline numbers count up ----
     Only a leading plain number is animated ("56", "4.9", "1,577"); anything
     else ("NPU") is left alone. */
  function countUp(textNode, raw) {
    var target = parseFloat(raw.replace(/,/g, ""));
    var decimals = (raw.split(".")[1] || "").length;
    var grouped = raw.indexOf(",") > -1;
    var start = 0, duration = 1300;
    function fmt(v) {
      return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
    }
    function frame(now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 4);
      textNode.textContent = t < 1 ? fmt(decimals ? target * eased : Math.round(target * eased)) : raw;
      if (t < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }
  var countIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      countIo.unobserve(e.target);
      var node = e.target.firstChild;
      if (node && node.nodeType === 3 && /^\d[\d,]*(\.\d+)?$/.test(node.textContent.trim())) countUp(node, node.textContent.trim());
    });
  }, { threshold: 0.6 });
  document.querySelectorAll(".figure .big, .flip b").forEach(function (el) { countIo.observe(el); });
})();
