const SCORE_MESSAGE_RE =
  /^Score submitted:\s*(.+)\s+(\d+|W)-(\d+|W)\s+(.+)$/i;

function formatScoreEntry(entry, { escapeHtml, formatTime }) {
  const score = entry?.score || null;
  if (score) {
    return buildScoreRow({
      nameA: score.nameA,
      nameB: score.nameB,
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      time: entry?.time,
      escapeHtml,
      formatTime,
    });
  }
  const message = String(entry?.message || "").trim();
  const match = SCORE_MESSAGE_RE.exec(message);
  if (!match) return null;
  return buildScoreRow({
    nameA: match[1],
    nameB: match[4],
    scoreA: match[2],
    scoreB: match[3],
    time: entry?.time,
    escapeHtml,
    formatTime,
  });
}

function buildScoreRow({
  nameA,
  nameB,
  scoreA,
  scoreB,
  time,
  escapeHtml,
  formatTime,
}) {
  const safeNameA = escapeHtml(nameA || "TBD");
  const safeNameB = escapeHtml(nameB || "TBD");
  const parsedA = String(scoreA).toUpperCase() === "W" ? "W" : Number(scoreA);
  const parsedB = String(scoreB).toUpperCase() === "W" ? "W" : Number(scoreB);
  const aVal = Number.isFinite(parsedA) ? parsedA : 0;
  const bVal = Number.isFinite(parsedB) ? parsedB : 0;
  const winner =
    aVal === bVal
      ? null
      : aVal > bVal
      ? "A"
      : "B";
  const aNameClass = winner === "A" ? "activity-winner-name" : "";
  const bNameClass = winner === "B" ? "activity-winner-name" : "";
  const aScoreClass =
    winner === "A"
      ? "activity-score-winner"
      : winner === "B"
      ? "activity-score-loser"
      : "";
  const bScoreClass =
    winner === "B"
      ? "activity-score-winner"
      : winner === "A"
      ? "activity-score-loser"
      : "";
  const timeLabel = Number.isFinite(time)
    ? `<span>${formatTime(time)}</span>`
    : "";
  const aDisplay = parsedA === "W" ? "w/o" : String(aVal);
  const bDisplay = parsedB === "W" ? "w/o" : String(bVal);
  return `<li><span class="activity-scoreline"><span class="${aNameClass}">${safeNameA}</span> <span class="${aScoreClass}">${escapeHtml(
    aDisplay
  )}</span><span class="activity-score-sep">-</span><span class="${bScoreClass}">${escapeHtml(
    bDisplay
  )}</span> <span class="${bNameClass}">${safeNameB}</span></span>${timeLabel}</li>`;
}

export function renderActivityList({ state, escapeHtml, formatTime }) {
  const listEl = document.getElementById("activityList");
  if (!listEl) return;
  const entries = Array.isArray(state?.activity) ? state.activity : [];
  const scoreEntries = entries.filter((entry) => entry?.type === "score");
  if (!scoreEntries.length) {
    listEl.innerHTML = `<li class="placeholder-tag">No updates yet.</li>`;
    return;
  }
  const rows = scoreEntries
    .map((entry) => {
      const formatted = formatScoreEntry(entry, { escapeHtml, formatTime });
      if (formatted) return formatted;
      const safeMessage = escapeHtml(String(entry?.message || "").trim());
      if (!safeMessage) return "";
      const timeLabel = Number.isFinite(entry?.time)
        ? `<span>${formatTime(entry.time)}</span>`
        : "";
      return `<li><strong>${safeMessage}</strong>${timeLabel}</li>`;
    })
    .filter(Boolean);
  listEl.innerHTML = rows.length
    ? rows.join("")
    : `<li class="placeholder-tag">No updates yet.</li>`;
}
