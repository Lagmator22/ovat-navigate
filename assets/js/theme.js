/* Runs in <head>, before first paint, so the page never flashes the wrong theme.
   Dark is the default. A stored choice of "light" or "dark" wins. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var stored = window.localStorage.getItem("ovat-theme");
    if (stored === "light" || stored === "dark") root.setAttribute("data-theme", stored);
  } catch (e) { /* storage blocked: keep the default */ }
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("reduce-motion");
    }
  } catch (e) { /* old browser */ }
})();
