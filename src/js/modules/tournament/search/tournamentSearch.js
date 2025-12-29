import { loadCircuitRegistry, loadTournamentRegistry } from "../sync/persistence.js";

function scoreSearchMatch(term, value) {
  if (!value) return 0;
  const lower = value.toLowerCase();
  if (lower === term) return 4;
  if (lower.startsWith(term)) return 3;
  if (lower.includes(term)) return 2;
  return 0;
}

function scoreSearchFields(term, fields = []) {
  return fields.reduce((best, field) => Math.max(best, scoreSearchMatch(term, field)), 0);
}

function timeProximityBoost(startTimeMs) {
  if (!Number.isFinite(startTimeMs)) return 0;
  const hours = Math.abs(startTimeMs - Date.now()) / (1000 * 60 * 60);
  if (hours <= 24) return 2;
  if (hours <= 72) return 1;
  if (hours <= 168) return 0.5;
  return 0;
}

async function searchTournamentDirectory(query, { limit = 10 } = {}) {
  const term = (query || "").trim().toLowerCase();
  if (!term) return [];
  const [tournaments, circuits] = await Promise.all([
    loadTournamentRegistry(),
    loadCircuitRegistry(),
  ]);
  const results = [];
  (tournaments || []).forEach((item) => {
    const score = scoreSearchFields(term, [
      item.name,
      item.slug,
      item.format,
      item.createdByName,
    ]) + timeProximityBoost(item.startTime);
    if (!score) return;
    results.push({
      type: "tournament",
      name: item.name || item.slug,
      slug: item.slug || item.id || "",
      meta: `Host: ${item.createdByName || "Unknown"}`,
      startTime: item.startTime || null,
      coverImageUrl: item.coverImageUrl || "",
      url: `/tournament/${item.slug || item.id || ""}`,
      score,
    });
  });
  (circuits || []).forEach((item) => {
    const score = scoreSearchFields(term, [
      item.name,
      item.slug,
      item.description,
      item.createdByName,
    ]);
    if (!score) return;
    results.push({
      type: "circuit",
      name: item.name || item.slug,
      slug: item.slug || item.id || "",
      meta: `Host: ${item.createdByName || "Unknown"}`,
      startTime: null,
      coverImageUrl: "",
      url: `/tournament/${item.slug || item.id || ""}`,
      score,
    });
  });
  const sorted = results.sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
  const trimmed = Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
  return trimmed.map(({ score, ...rest }) => rest);
}

function renderTournamentSearchResults(items, query, { listEl, statusEl, append = false } = {}) {
  if (!listEl || !statusEl) return;
  if (!append) {
    listEl.innerHTML = "";
  }
  if (!query) {
    statusEl.textContent = "Type to search tournaments or circuits.";
    return;
  }
  if (!items.length && !append) {
    statusEl.textContent = "No results found.";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "tournament-search-item";
    const link = document.createElement("a");
    link.className = "tournament-search-link";
    link.href = item.url;
    const cover = document.createElement("div");
    cover.className = "tournament-search-cover";
    if (item.coverImageUrl) {
      cover.style.backgroundImage = `url('${item.coverImageUrl}')`;
    } else {
      cover.classList.add("is-empty");
    }
    const body = document.createElement("div");
    body.className = "tournament-search-body";
    const title = document.createElement("div");
    title.className = "tournament-search-title";
    const name = document.createElement("span");
    name.textContent = item.name || item.slug;
    const tag = document.createElement("span");
    tag.className = `tournament-search-tag is-${item.type}`;
    tag.textContent = item.type === "circuit" ? "Circuit" : "Tournament";
    title.appendChild(name);
    title.appendChild(tag);
    const meta = document.createElement("div");
    meta.className = "tournament-search-meta";
    if (item.meta) {
      const extra = document.createElement("span");
      extra.textContent = item.meta;
      meta.appendChild(extra);
    }
    if (item.startTime) {
      const time = document.createElement("span");
      time.className = "tournament-search-time";
      time.textContent = new Date(item.startTime).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      meta.appendChild(time);
    }
    body.appendChild(title);
    body.appendChild(meta);
    link.appendChild(cover);
    link.appendChild(body);
    li.appendChild(link);
    listEl.appendChild(li);
  });
}

export function initTournamentSearch() {
  const tournamentSearch = document.getElementById("tournamentSearch");
  const tournamentSearchToggle = document.getElementById("tournamentSearchToggle");
  const tournamentSearchInput = document.getElementById("tournamentSearchInput");
  const tournamentSearchClear = document.getElementById("tournamentSearchClear");
  const tournamentSearchPanel = document.getElementById("tournamentSearchPanel");
  const tournamentSearchResults = document.getElementById("tournamentSearchResults");
  const tournamentSearchStatus = document.getElementById("tournamentSearchStatus");
  const tournamentSearchList = document.getElementById("tournamentSearchList");

  if (!tournamentSearch || !tournamentSearchToggle || !tournamentSearchInput) return;

  const setTournamentSearchOpen = (open) => {
    tournamentSearch.classList.toggle("is-open", open);
    tournamentSearchToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (tournamentSearchPanel) {
      tournamentSearchPanel.style.display = open ? "block" : "none";
    }
    if (open) tournamentSearchInput.focus();
  };

  tournamentSearchToggle.addEventListener("click", () => {
    const isOpen = tournamentSearch.classList.contains("is-open");
    if (isOpen && !tournamentSearchInput.value.trim()) {
      setTournamentSearchOpen(false);
    } else {
      setTournamentSearchOpen(true);
    }
  });

  tournamentSearchInput.addEventListener("focus", () => setTournamentSearchOpen(true));
  tournamentSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      tournamentSearchInput.value = "";
      renderTournamentSearchResults([], "", {
        listEl: tournamentSearchList,
        statusEl: tournamentSearchStatus,
      });
      setTournamentSearchOpen(false);
      tournamentSearchToggle.focus();
      return;
    }
    if (event.key === "Enter") {
      const first = tournamentSearchList?.querySelector("a");
      if (first) window.location.href = first.href;
    }
  });

  const PAGE_SIZE = 6;
  let searchTimer = null;
  let searchToken = 0;
  let currentResults = [];
  let renderedCount = 0;
  let currentQuery = "";

  const handleSearchInput = (value) => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const query = value.trim();
      currentQuery = query;
      if (!query) {
        currentResults = [];
        renderedCount = 0;
        renderTournamentSearchResults([], "", {
          listEl: tournamentSearchList,
          statusEl: tournamentSearchStatus,
        });
        return;
      }
      const token = ++searchToken;
      if (tournamentSearchStatus) {
        tournamentSearchStatus.textContent = "Searching...";
      }
      searchTournamentDirectory(query, { limit: null })
        .then((items = []) => {
          if (token !== searchToken) return;
          currentResults = items;
          renderNextBatch({ reset: true });
        })
        .catch(() => {
          if (token !== searchToken) return;
          if (tournamentSearchStatus) {
            tournamentSearchStatus.textContent = "Search failed.";
          }
          if (tournamentSearchList) {
            tournamentSearchList.innerHTML = "";
          }
        });
    }, 150);
  };

  const updateStatus = () => {
    if (!tournamentSearchStatus) return;
    if (!currentQuery) {
      tournamentSearchStatus.textContent = "Type to search tournaments or circuits.";
      return;
    }
    if (!currentResults.length) {
      tournamentSearchStatus.textContent = "No results found.";
      return;
    }
    const total = currentResults.length;
    const shown = Math.min(renderedCount, total);
    tournamentSearchStatus.textContent =
      shown >= total ? `${total} result${total === 1 ? "" : "s"}` : `Showing ${shown} of ${total}`;
  };

  const renderNextBatch = ({ reset = false } = {}) => {
    if (!tournamentSearchList || !tournamentSearchStatus) return;
    if (reset) {
      renderedCount = 0;
      tournamentSearchList.innerHTML = "";
    }
    const next = currentResults.slice(renderedCount, renderedCount + PAGE_SIZE);
    if (!next.length) {
      updateStatus();
      return;
    }
    renderTournamentSearchResults(next, currentQuery, {
      listEl: tournamentSearchList,
      statusEl: tournamentSearchStatus,
      append: true,
    });
    renderedCount += next.length;
    updateStatus();
  };

  tournamentSearchInput.addEventListener("input", () => {
    handleSearchInput(tournamentSearchInput.value);
  });

  if (tournamentSearchList) {
    tournamentSearchList.addEventListener("scroll", () => {
      const threshold = 40;
      const isNearBottom =
        tournamentSearchList.scrollTop + tournamentSearchList.clientHeight >=
        tournamentSearchList.scrollHeight - threshold;
      if (isNearBottom) {
        renderNextBatch();
      }
    });
  }

  if (tournamentSearchClear) {
    tournamentSearchClear.addEventListener("click", () => {
      tournamentSearchInput.value = "";
      tournamentSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
      tournamentSearchInput.focus();
    });
  }

  document.addEventListener("click", (event) => {
    if (tournamentSearch.contains(event.target)) return;
    if (tournamentSearchPanel && tournamentSearchPanel.contains(event.target)) return;
    setTournamentSearchOpen(false);
  });
}
