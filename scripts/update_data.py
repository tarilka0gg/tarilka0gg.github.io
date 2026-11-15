#!/usr/bin/env python3
"""Refresh the site's live data from the GitHub API.

Writes:
  data/stats.json        per-repository numbers (no stars): latest release, last push,
                         commits in the last 30 days, release count. Read by assets/live.js.
  data/updates.json      the updates feed as data.
  updates/index.html     the feed, rendered between <!-- feed:start --> and <!-- feed:end -->.
  index.html             the "Latest" line on the home page, between <!-- latest:start/end -->.

Standard library only. GITHUB_TOKEN (optional) raises the API rate limit.
usage: scripts/update_data.py [user]
"""
import datetime as dt
import html
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

USER = sys.argv[1] if len(sys.argv) > 1 else "tarilka0gg"
ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW = dt.datetime.now(dt.timezone.utc)

# Repositories shown on the site. Others (forks, the profile repo, private work) are left out on purpose.
REPOS = [
    "simple-linux", "gentoo-installer", "portage-store", "simple-linux-binhost", "kernel-matrix",
    "ustan", "tui-shim", "Ring-2Zero", "simple-linux-configs", "simple-locale",
    "system-lab", "power-scripts", "gpu-undervolt", "telegram-helper-rs",
]
# Where a feed entry for a repository links on this site (repos without a page link to GitHub).
SITE_PAGE = {
    "simple-linux": "projects/simple-linux/", "gentoo-installer": "projects/installer/",
    "portage-store": "projects/portage-store/", "ustan": "projects/ustan/",
    "tui-shim": "projects/tui-shim/", "Ring-2Zero": "projects/ring-2zero/",
}
# How a repository is named in the feed.
DISPLAY = {
    "simple-linux": "Simple Linux", "gentoo-installer": "Installer", "portage-store": "Portage Store",
    "simple-linux-binhost": "Binhost", "Ring-2Zero": "Ring-2Zero",
}
FEED_LIMIT = 40


def api(path):
    req = urllib.request.Request("https://api.github.com" + path, headers={
        "Accept": "application/vnd.github+json", "User-Agent": "tarilka0gg-site-data"})
    if os.environ.get("GITHUB_TOKEN"):
        req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def pages(path, limit=1000):
    out, page = [], 1
    while len(out) < limit:
        sep = "&" if "?" in path else "?"
        chunk = api(f"{path}{sep}per_page=100&page={page}")
        out += chunk
        if len(chunk) < 100:
            break
        page += 1
    return out[:limit]


def parse(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def fmt_date(d):
    return d.strftime("%b %d, %Y").replace(" 0", " ")


stats, feed = {}, []
since = (NOW - dt.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")

for name in REPOS:
    repo = api(f"/repos/{USER}/{name}")
    releases = [r for r in pages(f"/repos/{USER}/{name}/releases") if not r["draft"]]
    commits = pages(f"/repos/{USER}/{name}/commits?since={since}", limit=500)
    latest = releases[0] if releases else None
    stats[name] = {
        "pushed_at": repo["pushed_at"],
        "commits_30d": len(commits),
        "releases": len(releases),
        "latest_release": {"tag": latest["tag_name"], "date": latest["published_at"], "url": latest["html_url"]} if latest else None,
    }
    for r in releases:
        title = (r["name"] or r["tag_name"]).strip()
        label = DISPLAY.get(name, name)
        if label.lower() not in title.lower():
            title = f"{label} {title}"
        feed.append({
            "date": r["published_at"],
            "title": title,
            "repo": name,
            "kind": "pre-release" if r["prerelease"] else "release",
            "url": r["html_url"],
            "page": SITE_PAGE.get(name),
        })

# Merged pull requests to other people's public projects.
q = urllib.parse.quote(f"is:pr author:{USER} is:merged is:public -user:{USER}")
for pr in api(f"/search/issues?q={q}&sort=updated&order=desc&per_page=50")["items"]:
    owner_repo = pr["repository_url"].split("/repos/", 1)[1]
    feed.append({
        "date": pr["closed_at"],
        "title": pr["title"],
        "repo": owner_repo,
        "kind": "merged PR",
        "url": pr["html_url"],
        "page": None,
    })

feed.sort(key=lambda e: e["date"], reverse=True)
feed = feed[:FEED_LIMIT]

data = ROOT / "data"
data.mkdir(exist_ok=True)
(data / "stats.json").write_text(json.dumps({"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "repos": stats}, indent=1) + "\n")
(data / "updates.json").write_text(json.dumps(feed, indent=1) + "\n")


def replace_between(path, start, end, body):
    text = path.read_text()
    a, b = text.index(start) + len(start), text.index(end)
    new = text[:a] + "\n" + body + "\n" + text[b:]
    if new != text:
        path.write_text(new)


def feed_item(e, prefix):
    d = parse(e["date"])
    repo = html.escape(e["repo"])
    if e["page"]:
        repo = f'<a href="{html.escape(prefix + e["page"])}">{repo}</a>'
    return (f'        <li><time datetime="{d.date().isoformat()}">{fmt_date(d)}</time>'
            f'<span><a href="{html.escape(e["url"])}">{html.escape(e["title"])}</a>'
            f'<span class="repo">{repo}</span></span>'
            f'<span class="tag">{html.escape(e["kind"])}</span></li>')


items = "\n".join(feed_item(e, "../") for e in feed) or "        <li>No updates yet.</li>"
stamp = fmt_date(NOW)
replace_between(ROOT / "updates" / "index.html", "<!-- feed:start -->", "<!-- feed:end -->",
                f'      <ul class="feed">\n{items}\n      </ul>\n      <p class="crumbs">Refreshed {stamp} from the GitHub API.</p>\n      ')

rel = next((e for e in feed if e["kind"] == "release"), None)
if rel:
    d = parse(rel["date"])
    href = rel["url"]
    latest = f'        <a href="{html.escape(href)}">Latest: {html.escape(rel["title"])} · {fmt_date(d)}</a>\n        <span aria-hidden="true">/</span>'
    replace_between(ROOT / "index.html", "<!-- latest:start -->", "<!-- latest:end -->", latest + "\n        ")

print(f"{len(stats)} repositories, {len(feed)} feed entries")
