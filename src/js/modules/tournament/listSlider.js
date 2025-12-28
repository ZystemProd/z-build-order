const SLIDER_GAP_PX = 12;
const SLIDER_MIN_CARD_WIDTH = 240;

const state = {
  items: [],
  page: 0,
  pageSize: 0,
  mode: "",
  renderItem: null,
  onPageRender: null,
};

function getElements() {
  const listEl = document.getElementById("tournamentList");
  const prevBtn = document.getElementById("tournamentListPrev");
  const nextBtn = document.getElementById("tournamentListNext");
  return { listEl, prevBtn, nextBtn };
}

function computeColumns(listEl) {
  if (!listEl) return 1;
  const width = listEl.clientWidth || listEl.parentElement?.clientWidth || 0;
  if (!width) {
    listEl.style.setProperty("--slider-cols", "1");
    return 1;
  }
  const cols = Math.max(
    1,
    Math.floor((width + SLIDER_GAP_PX) / (SLIDER_MIN_CARD_WIDTH + SLIDER_GAP_PX))
  );
  listEl.style.setProperty("--slider-cols", String(cols));
  return cols;
}

function renderPage() {
  const { listEl, prevBtn, nextBtn } = getElements();
  if (!listEl || typeof state.renderItem !== "function") return;
  const cols = computeColumns(listEl);
  state.pageSize = Math.max(1, cols * 2);
  const total = state.items.length;
  const maxPage = Math.max(0, Math.ceil(total / state.pageSize) - 1);
  state.page = Math.min(state.page, maxPage);
  listEl.innerHTML = "";
  const start = state.page * state.pageSize;
  const slice = state.items.slice(start, start + state.pageSize);
  slice.forEach((item) => state.renderItem(item, listEl));
  if (typeof state.onPageRender === "function") {
    state.onPageRender(listEl);
  }
  if (prevBtn) prevBtn.disabled = state.page <= 0;
  if (nextBtn) nextBtn.disabled = state.page >= maxPage;
}

export function setTournamentListItems(
  items = [],
  { mode = "", renderItem, onPageRender } = {}
) {
  if (mode && mode !== state.mode) {
    state.page = 0;
  }
  state.mode = mode || state.mode;
  state.items = Array.isArray(items) ? items : [];
  state.renderItem = renderItem || state.renderItem;
  state.onPageRender = onPageRender || state.onPageRender;
  renderPage();
}

export function goTournamentListPage(delta) {
  if (!Number.isFinite(delta) || delta === 0) return;
  state.page = Math.max(0, state.page + delta);
  renderPage();
}

export function refreshTournamentListLayout() {
  renderPage();
}

export function initTournamentListSlider() {
  const { prevBtn, nextBtn } = getElements();
  prevBtn?.addEventListener("click", () => goTournamentListPage(-1));
  nextBtn?.addEventListener("click", () => goTournamentListPage(1));
}
