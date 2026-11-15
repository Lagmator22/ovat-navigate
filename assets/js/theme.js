/* Runs in <head>, before first paint, so the page never flashes the wrong theme.
   The system setting decides. A stored choice of "light" or "dark" wins. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var theme = "dark";
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) theme = "light";
  } catch (e) { /* old browser: dark */ }
  try {
    var stored = window.localStorage.getItem("ovat-theme");
    if (stored === "light" || stored === "dark") theme = stored;
  } catch (e) { /* storage blocked: keep the system setting */ }
  root.setAttribute("data-theme", theme);
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("reduce-motion");
    }
  } catch (e) { /* old browser */ }
})();

/* Show /guide, not /guide.html, however the page was reached (an old link, a
   search result). GitHub Pages serves both; only the address bar changes. */
(function () {
  try {
    var path = window.location.pathname;
    var clean = path.replace(/\/index\.html$/, "/").replace(/\/(architecture|guide|results|codebase)\.html$/, "/$1");
    if (clean !== path && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", clean + window.location.search + window.location.hash);
    }
  } catch (e) { /* keep the address as it is */ }
})();
