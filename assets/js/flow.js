/* Animated diagrams.

   Every diagram is a hand-drawn inline SVG. This file only moves a "packet"
   along the SVG paths and lights up nodes, so the drawing is complete and
   readable without it. Rules:
     - A diagram only animates while it is on screen and the tab is visible.
     - prefers-reduced-motion: nothing travels and nothing autoplays. The step
       list and the Next / Back buttons still walk through every state.
     - All step text lives in the HTML (the <ol class="steps">), not here.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var root = document.documentElement;
  var reduce = root.classList.contains("reduce-motion");

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function words(s) { return (s || "").split(/\s+/).filter(Boolean); }

  function makePacket(svg, tone) {
    var layer = $(".packets", svg);
    if (!layer) {
      layer = document.createElementNS(SVGNS, "g");
      layer.setAttribute("class", "packets");
      layer.setAttribute("aria-hidden", "true");
      svg.appendChild(layer);
    }
    var g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "packet" + (tone ? " tone-" + tone : ""));
    var halo = document.createElementNS(SVGNS, "circle");
    halo.setAttribute("class", "halo");
    halo.setAttribute("r", "11");
    var core = document.createElementNS(SVGNS, "circle");
    core.setAttribute("class", "core");
    core.setAttribute("r", "4.5");
    g.appendChild(halo);
    g.appendChild(core);
    layer.appendChild(g);
    return g;
  }

  /* Give every node a blurred halo and every wire a dashed "live" copy.
     Both start at opacity 0 and fade, so lighting up is never a one-frame
     change of stroke pattern or colour. */
  var glowCount = 0;
  function enhance(svg) {
    if (svg.getAttribute("data-enhanced")) return;
    svg.setAttribute("data-enhanced", "1");
    glowCount += 1;
    var fid = "soft-glow-" + glowCount;
    var defs = svg.querySelector("defs");
    if (!defs) { defs = document.createElementNS(SVGNS, "defs"); svg.insertBefore(defs, svg.firstChild); }
    var f = document.createElementNS(SVGNS, "filter");
    f.setAttribute("id", fid);
    f.setAttribute("x", "-30%"); f.setAttribute("y", "-60%");
    f.setAttribute("width", "160%"); f.setAttribute("height", "220%");
    var blur = document.createElementNS(SVGNS, "feGaussianBlur");
    blur.setAttribute("stdDeviation", "6");
    f.appendChild(blur);
    defs.appendChild(f);
    $$(".node", svg).forEach(function (n) {
      var box = $(".box", n);
      if (!box) return;
      var halo = box.cloneNode(false);
      halo.setAttribute("class", "halo");
      halo.setAttribute("filter", "url(#" + fid + ")");
      halo.setAttribute("aria-hidden", "true");
      n.insertBefore(halo, box);
    });
    $$(".wire", svg).forEach(function (w) {
      var live = document.createElementNS(SVGNS, "path");
      live.setAttribute("class", "wire-live");
      live.setAttribute("d", w.getAttribute("d"));
      live.setAttribute("aria-hidden", "true");
      w.parentNode.insertBefore(live, w.nextSibling);
    });
  }

  /* Light nodes one after another: --d is each node's own delay. */
  function lightNodes(ids, tone, delays) {
    ids.forEach(function (id, k) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.setProperty("--d", Math.round(delays[k] || 0) + "ms");
      el.classList.add("is-on");
      setTone(el, tone);
    });
  }
  function dimAll(svg) {
    $$(".node.is-on, .wire.is-on", svg).forEach(function (el) {
      el.style.setProperty("--d", "0ms");
      el.classList.remove("is-on");
    });
  }

  function setTone(el, tone) {
    ["signal", "tool", "ok"].forEach(function (t) { el.classList.remove("tone-" + t); });
    if (tone && tone !== "signal") el.classList.add("tone-" + tone);
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* Move `packet` along `path` over `dur` ms. Returns {promise, cancel}. */
  function travel(path, packet, dur, reverse) {
    var cancelled = false;
    var raf = 0;
    var len = path.getTotalLength();
    var promise = new Promise(function (resolve) {
      var start = 0;
      packet.classList.add("is-moving");
      function frame(ts) {
        if (cancelled) { resolve(false); return; }
        if (!start) start = ts;
        var t = Math.min(1, (ts - start) / dur);
        var d = ease(t) * len;
        var p = path.getPointAtLength(reverse ? len - d : d);
        packet.setAttribute("transform", "translate(" + p.x.toFixed(2) + " " + p.y.toFixed(2) + ")");
        if (t < 1) raf = window.requestAnimationFrame(frame);
        else resolve(true);
      }
      raf = window.requestAnimationFrame(frame);
    });
    return {
      promise: promise,
      cancel: function () { cancelled = true; window.cancelAnimationFrame(raf); }
    };
  }

  function wait(ms, token) {
    return new Promise(function (resolve) {
      var id = window.setTimeout(function () { resolve(!token.cancelled); }, ms);
      token.timers.push(id);
    });
  }

  /* Run `fn(token)` only while `el` is on screen and the tab is visible.
     fn must return a promise and stop when token.cancelled becomes true. */
  function whileVisible(el, start, stop) {
    var onScreen = false;
    var running = false;
    function update() {
      var should = onScreen && !document.hidden;
      if (should && !running) { running = true; start(); }
      else if (!should && running) { running = false; stop(); }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        update();
      }, { threshold: 0.25 }).observe(el);
    } else {
      onScreen = true;
      update();
    }
    document.addEventListener("visibilitychange", update);
    return { refresh: update, isRunning: function () { return running; } };
  }

  /* A "Pause motion" button for figures that autoplay without steps. */
  function motionButton(fig, onPause, onPlay) {
    var btn = $("[data-act='motion']", fig);
    if (!btn) return { paused: function () { return false; } };
    var paused = false;
    function sync() {
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      var label = $(".lbl", btn);
      if (label) label.textContent = paused ? "Play motion" : "Pause motion";
      $$("[data-icon]", btn).forEach(function (ic) {
        ic.hidden = ic.getAttribute("data-icon") !== (paused ? "play" : "pause");
      });
    }
    if (reduce) { btn.hidden = true; }
    btn.addEventListener("click", function () {
      paused = !paused;
      sync();
      if (paused) onPause(); else onPlay();
    });
    sync();
    return { paused: function () { return paused; } };
  }

  function newToken() { return { cancelled: false, timers: [], travels: [] }; }
  function killToken(tok) {
    if (!tok) return;
    tok.cancelled = true;
    tok.timers.forEach(function (t) { window.clearTimeout(t); });
    tok.travels.forEach(function (t) { t.cancel(); });
  }

  /* ------------------------------------------------------------------ */
  /* 1. Step sequences: figure[data-seq]                                 */
  /* ------------------------------------------------------------------ */
  function Sequence(fig) {
    var svg = $("svg", fig);
    var items = $$(".steps li", fig);
    var count = $(".count", fig);
    var toggleBtn = $("[data-act='toggle']", fig);
    var packet = makePacket(svg);
    var speed = parseFloat(fig.getAttribute("data-speed") || "0.42"); /* px per ms */
    var index = 0;
    var playing = !reduce;
    var token = null;

    items.forEach(function (li, i) {
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.addEventListener("click", function () { pause(); show(i, false); });
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pause(); show(i, false); }
      });
    });

    function travelTime(li) {
      return words(li.getAttribute("data-path")).reduce(function (t, raw) {
        var path = document.getElementById(raw.replace(/^!/, ""));
        return t + (path && path.getTotalLength ? Math.max(520, path.getTotalLength() / speed) : 0);
      }, 0);
    }

    function paint(i, animated) {
      var li = items[i];
      var tone = li.getAttribute("data-tone") || "signal";
      dimAll(svg);
      var ids = words(li.getAttribute("data-nodes"));
      /* The first box lights now; each later box lights as the signal
         reaches it, or 200 ms after the one before when nothing travels. */
      var trip = animated && !reduce ? travelTime(li) : 0;
      var delays = ids.map(function (_, k) {
        if (k === 0) return 0;
        return trip ? Math.max(200 * k, trip * k / (ids.length - 1) - 120) : 200 * k;
      });
      lightNodes(ids, tone, delays);
      words(li.getAttribute("data-path")).forEach(function (raw) {
        var el = document.getElementById(raw.replace(/^!/, ""));
        if (el) { el.classList.add("is-on"); setTone(el, tone); }
      });
      /* Text slots: data-slot-NAME="value" fills <text data-slot="NAME">. */
      Array.prototype.forEach.call(li.attributes, function (a) {
        if (a.name.indexOf("data-slot-") === 0) {
          var slot = svg.querySelector("[data-slot='" + a.name.slice(10) + "']");
          if (slot) slot.textContent = a.value;
        }
      });
      items.forEach(function (x, j) {
        x.classList.toggle("is-current", j === i);
        x.setAttribute("aria-current", j === i ? "step" : "false");
      });
      if (count) count.textContent = (i + 1) + " / " + items.length;
      setTone(packet, tone);
    }

    function show(i, animate) {
      killToken(token);
      packet.classList.remove("is-moving");
      index = (i + items.length) % items.length;
      paint(index, false);
      if (animate && playing && runner.isRunning()) run(index);
    }

    function run(i) {
      var tok = token = newToken();
      var li = items[i];
      var segs = words(li.getAttribute("data-path"));
      var hold = parseInt(li.getAttribute("data-hold") || "1100", 10);
      var chain = Promise.resolve(true);
      if (!reduce) {
        segs.forEach(function (raw) {
          chain = chain.then(function (ok) {
            if (!ok || tok.cancelled) return false;
            var path = document.getElementById(raw.replace(/^!/, ""));
            if (!path || !path.getTotalLength) return true;
            var dur = Math.max(520, path.getTotalLength() / speed);
            var tr = travel(path, packet, dur, raw.charAt(0) === "!");
            tok.travels.push(tr);
            return tr.promise;
          });
        });
      }
      chain.then(function (ok) {
        if (!ok || tok.cancelled) return false;
        if (!segs.length) packet.classList.remove("is-moving");
        return wait(reduce ? 2600 : hold, tok);
      }).then(function (ok) {
        if (!ok || tok.cancelled) return;
        packet.classList.remove("is-moving");
        index = (index + 1) % items.length;
        paint(index, true);
        run(index);
      });
    }

    function syncButton() {
      if (!toggleBtn) return;
      toggleBtn.setAttribute("aria-pressed", playing ? "true" : "false");
      var label = $(".lbl", toggleBtn);
      if (label) label.textContent = playing ? "Pause" : "Play";
      $$("[data-icon]", toggleBtn).forEach(function (ic) {
        ic.hidden = ic.getAttribute("data-icon") !== (playing ? "pause" : "play");
      });
    }
    function pause() { playing = false; killToken(token); packet.classList.remove("is-moving"); syncButton(); }
    function play() { playing = true; syncButton(); if (runner.isRunning()) run(index); }

    var runner = whileVisible(fig, function () { if (playing) { paint(index, true); run(index); } },
                              function () { killToken(token); packet.classList.remove("is-moving"); });

    if (toggleBtn) toggleBtn.addEventListener("click", function () { if (playing) pause(); else play(); });
    var next = $("[data-act='next']", fig);
    var prev = $("[data-act='prev']", fig);
    if (next) next.addEventListener("click", function () { pause(); show(index + 1, false); });
    if (prev) prev.addEventListener("click", function () { pause(); show(index - 1, false); });

    enhance(svg);
    paint(0, false);
    syncButton();
  }

  /* ------------------------------------------------------------------ */
  /* 2. Tabbed routes: figure[data-routes]                               */
  /*    Each tab names the wires to light and the nodes to switch on/off. */
  /* ------------------------------------------------------------------ */
  function Routes(fig) {
    var svg = $("svg", fig);
    var tabs = $$("[role='tab']", fig);
    var panels = $$("[role='tabpanel']", fig);
    var auto = !reduce && fig.hasAttribute("data-autoplay");
    var current = 0;
    var token = null;
    var cycleTimer = 0;
    var pool = [];

    function packetFor(i, tone) {
      if (!pool[i]) pool[i] = makePacket(svg, tone);
      setTone(pool[i], tone);
      return pool[i];
    }

    function apply(i) {
      var tab = tabs[i];
      current = i;
      tabs.forEach(function (t, j) {
        var on = j === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p) { p.hidden = p.id !== tab.getAttribute("aria-controls"); });
      $$(".wire", svg).forEach(function (w) {
        if (w.hasAttribute("data-route")) w.classList.add("is-hidden");
        w.classList.remove("is-on");
      });
      dimAll(svg);
      $$(".node", svg).forEach(function (n) { n.classList.remove("is-off"); });
      var tone = tab.getAttribute("data-tone") || "signal";
      words(tab.getAttribute("data-wires")).forEach(function (raw) {
        var w = document.getElementById(raw.replace(/^!/, ""));
        if (w) { w.classList.remove("is-hidden"); w.classList.add("is-on"); setTone(w, tone); }
      });
      var onIds = words(tab.getAttribute("data-on"));
      lightNodes(onIds, tone, onIds.map(function (_, k) { return k * 180; }));
      words(tab.getAttribute("data-off")).forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.classList.add("is-off");
      });
      Array.prototype.forEach.call(tab.attributes, function (a) {
        if (a.name.indexOf("data-slot-") === 0) {
          var slot = svg.querySelector("[data-slot='" + a.name.slice(10) + "']");
          if (slot) slot.textContent = a.value;
        }
      });
      if (runner.isRunning() && !motion.paused()) animate();
    }

    /* Packets: "lanes" are space-separated chains like "a>b>!c"; each lane
       gets its own packet and lanes run side by side. */
    function animate() {
      killToken(token);
      pool.forEach(function (p) { p.classList.remove("is-moving"); });
      if (reduce) return;
      var tok = token = newToken();
      var tab = tabs[current];
      var tone = tab.getAttribute("data-tone") || "signal";
      var lanes = words(tab.getAttribute("data-lanes") || tab.getAttribute("data-wires"));
      lanes.forEach(function (lane, k) {
        var segs = lane.split(">");
        var pk = packetFor(k, tone);
        function loop() {
          var chain = wait(k * 260, tok);
          segs.forEach(function (raw) {
            chain = chain.then(function (ok) {
              if (!ok || tok.cancelled) return false;
              var path = document.getElementById(raw.replace(/^!/, ""));
              if (!path) return true;
              var tr = travel(path, pk, Math.max(600, path.getTotalLength() / 0.38), raw.charAt(0) === "!");
              tok.travels.push(tr);
              return tr.promise;
            });
          });
          chain.then(function (ok) {
            if (!ok || tok.cancelled) return false;
            pk.classList.remove("is-moving");
            return wait(500, tok);
          }).then(function (ok) { if (ok && !tok.cancelled) loop(); });
        }
        loop();
      });
    }

    function stopAuto() { auto = false; window.clearInterval(cycleTimer); }
    /* Reading a panel should not have it switched underneath you. */
    fig.addEventListener("pointerenter", stopAuto);
    fig.addEventListener("focusin", stopAuto);

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { stopAuto(); apply(i); });
      t.addEventListener("keydown", function (e) {
        var k = e.key;
        var n = null;
        if (k === "ArrowRight" || k === "ArrowDown") n = (i + 1) % tabs.length;
        if (k === "ArrowLeft" || k === "ArrowUp") n = (i - 1 + tabs.length) % tabs.length;
        if (k === "Home") n = 0;
        if (k === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); stopAuto(); apply(n); tabs[n].focus(); }
      });
    });

    var motion = motionButton(fig, function () {
      stopAuto();
      killToken(token);
      pool.forEach(function (p) { p.classList.remove("is-moving"); });
    }, function () { if (runner.isRunning()) animate(); });

    var runner = whileVisible(fig, function () {
      if (motion.paused()) return;
      animate();
      if (auto) {
        window.clearInterval(cycleTimer);
        cycleTimer = window.setInterval(function () { apply((current + 1) % tabs.length); },
                                        parseInt(fig.getAttribute("data-autoplay") || "5200", 10));
      }
    }, function () {
      killToken(token);
      window.clearInterval(cycleTimer);
      pool.forEach(function (p) { p.classList.remove("is-moving"); });
    });

    enhance(svg);
    var start = tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; });
    apply(start < 0 ? 0 : start);
  }

  /* ------------------------------------------------------------------ */
  /* 3. Ambient loops: figure[data-ambient] with data-lanes on the svg    */
  /* ------------------------------------------------------------------ */
  function Ambient(fig) {
    var svg = $("svg", fig);
    var lanes = words(svg.getAttribute("data-lanes"));
    var token = null;
    enhance(svg);
    var packets = lanes.map(function (lane) {
      var tone = (lane.split("@")[1]) || "signal";
      return makePacket(svg, tone);
    });
    function start() {
      if (reduce) return;
      var tok = token = newToken();
      lanes.forEach(function (lane, k) {
        var parts = lane.split("@");
        var segs = parts[0].split(">");
        var pk = packets[k];
        function loop() {
          var chain = wait(k * 330, tok);
          segs.forEach(function (raw) {
            chain = chain.then(function (ok) {
              if (!ok || tok.cancelled) return false;
              var path = document.getElementById(raw.replace(/^!/, ""));
              if (!path) return true;
              path.classList.add("is-on");
              var tr = travel(path, pk, Math.max(700, path.getTotalLength() / 0.3), raw.charAt(0) === "!");
              tok.travels.push(tr);
              return tr.promise.then(function (r) { path.classList.remove("is-on"); return r; });
            });
          });
          chain.then(function (ok) {
            if (!ok || tok.cancelled) return false;
            pk.classList.remove("is-moving");
            return wait(900 + lanes.length * 120, tok);
          }).then(function (ok) { if (ok && !tok.cancelled) loop(); });
        }
        loop();
      });
    }
    function stop() {
      killToken(token);
      packets.forEach(function (p) { p.classList.remove("is-moving"); });
      $$(".wire.is-on", svg).forEach(function (w) { w.classList.remove("is-on"); });
    }
    var motion = motionButton(fig, stop, function () { if (runner.isRunning()) start(); });
    var runner = whileVisible(fig, function () { if (!motion.paused()) start(); }, stop);
  }

  function boot() {
    $$("figure[data-seq]").forEach(function (f) { try { Sequence(f); } catch (e) { /* diagram stays static */ } });
    $$("figure[data-routes]").forEach(function (f) { try { Routes(f); } catch (e) { /* static */ } });
    $$("figure[data-ambient]").forEach(function (f) { try { Ambient(f); } catch (e) { /* static */ } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
