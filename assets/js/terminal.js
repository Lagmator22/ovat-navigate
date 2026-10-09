/* The terminal replay on the home page.

   Each scene is real CLI text written into the HTML, so the page reads the
   same with no JS. This script only replays it: the command is typed, the
   output appears line by line with the pauses a real run has. With reduced
   motion it shows each scene complete and never autoplays. */
(function () {
  "use strict";

  var reduce = document.documentElement.classList.contains("reduce-motion");

  document.querySelectorAll("[data-term]").forEach(function (term) {
    var tabs = Array.prototype.slice.call(term.querySelectorAll("[role='tab']"));
    var scenes = Array.prototype.slice.call(term.querySelectorAll("[data-scene]"));
    var replay = term.querySelector("[data-act='replay']");
    var title = term.querySelector(".term-title");
    var current = 0;
    var auto = !reduce;
    var timers = [];
    var onScreen = false;
    var started = false;

    var caret = document.createElement("span");
    caret.className = "t-caret";
    caret.setAttribute("aria-hidden", "true");

    function clear() {
      timers.forEach(function (t) { window.clearTimeout(t); });
      timers = [];
    }
    function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }

    function select(i, animate) {
      clear();
      current = i;
      tabs.forEach(function (t, j) {
        t.setAttribute("aria-selected", j === i ? "true" : "false");
        t.tabIndex = j === i ? 0 : -1;
      });
      scenes.forEach(function (s, j) { s.hidden = j !== i; });
      if (title) title.textContent = scenes[i].getAttribute("data-title") || "";
      var lines = Array.prototype.slice.call(scenes[i].querySelectorAll(".ln"));
      if (!animate || reduce) {
        lines.forEach(function (l) {
          l.hidden = false;
          var typed = l.querySelector(".t-cmd");
          if (typed && typed.hasAttribute("data-full")) typed.textContent = typed.getAttribute("data-full");
        });
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        return;
      }
      lines.forEach(function (l) { l.hidden = true; });
      play(lines, 0);
    }

    function play(lines, k) {
      if (k >= lines.length) {
        var last = lines[lines.length - 1];
        last.appendChild(caret);
        if (auto) later(function () { select((current + 1) % scenes.length, true); }, 5200);
        return;
      }
      var line = lines[k];
      var delay = parseInt(line.getAttribute("data-delay") || "90", 10);
      if (line.getAttribute("data-k") === "cmd") {
        var typed = line.querySelector(".t-cmd");
        if (!typed.hasAttribute("data-full")) typed.setAttribute("data-full", typed.textContent);
        var full = typed.getAttribute("data-full");
        typed.textContent = "";
        later(function () {
          line.hidden = false;
          line.appendChild(caret);
          var n = 0;
          (function type() {
            n += 1;
            typed.textContent = full.slice(0, n);
            if (n < full.length) later(type, 22 + Math.random() * 38);
            else later(function () { play(lines, k + 1); }, 420);
          })();
        }, delay);
      } else {
        /* While the model "thinks", the caret waits on an empty line. */
        if (delay > 600) {
          var prev = lines[k - 1];
          if (prev) prev.appendChild(caret);
        }
        later(function () {
          line.hidden = false;
          if (caret.parentNode) caret.parentNode.removeChild(caret);
          play(lines, k + 1);
        }, delay);
      }
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { auto = false; select(i, !reduce); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        if (n !== null) { e.preventDefault(); auto = false; select(n, !reduce); tabs[n].focus(); }
      });
    });
    if (replay) replay.addEventListener("click", function () { select(current, !reduce); });
    var pauseBtn = term.querySelector("[data-act='pause']");
    if (pauseBtn) {
      if (reduce) pauseBtn.hidden = true;
      pauseBtn.addEventListener("click", function () {
        auto = false;
        clear();
        select(current, false);
        pauseBtn.setAttribute("aria-pressed", "true");
        pauseBtn.textContent = "Paused";
      });
    }

    /* The first scene is shown finished for a moment before it replays,
       so anyone glancing (or a link preview) sees a complete answer. */
    var firstShow = true;
    function startIfVisible() {
      if (onScreen && !document.hidden && !started) {
        started = true;
        if (firstShow && !reduce) {
          firstShow = false;
          select(current, false);
          later(function () { select(current, true); }, 2600);
        } else {
          select(current, !reduce);
        }
      }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (!onScreen) { clear(); started = false; select(current, false); }
        else startIfVisible();
      }, { threshold: 0.3 }).observe(term);
    } else {
      onScreen = true;
      startIfVisible();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { clear(); started = false; select(current, false); }
      else startIfVisible();
    });
    select(0, false);
  });
})();
