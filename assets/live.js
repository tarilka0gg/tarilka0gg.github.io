// Fills every <ul class="meta live" data-repo="..."> with numbers from data/stats.json
// (refreshed daily by scripts/update_data.py). No stars on purpose.
(function () {
  "use strict";
  const lists = document.querySelectorAll(".meta.live[data-repo]");
  if (!lists.length) return;
  const base = document.currentScript ? new URL("../data/stats.json", document.currentScript.src) : null;
  if (!base) return;

  const DAY = 86400000;
  function ago(iso) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / DAY);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    const months = Math.round(days / 30);
    return months === 1 ? "a month ago" : months + " months ago";
  }
  function date(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function li(text, cls, href) {
    const el = document.createElement("li");
    if (cls) el.className = cls;
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      el.appendChild(a);
    } else {
      el.textContent = text;
    }
    return el;
  }

  fetch(base, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      for (const ul of lists) {
        const s = data.repos[ul.dataset.repo];
        if (!s) continue;
        const fresh = Date.now() - Date.parse(s.pushed_at) < 14 * DAY;
        ul.appendChild(li("Updated " + ago(s.pushed_at), fresh ? "fresh" : ""));
        if (s.commits_30d) ul.appendChild(li(s.commits_30d + (s.commits_30d === 1 ? " commit" : " commits") + " in 30 days"));
        if (s.latest_release) ul.appendChild(li("Latest " + s.latest_release.tag + " · " + date(s.latest_release.date), "", s.latest_release.url));
        if (s.releases > 1) ul.appendChild(li(s.releases + " releases"));
        ul.title = "From GitHub, refreshed " + date(data.updated);
      }
    })
    .catch(() => {});
})();
