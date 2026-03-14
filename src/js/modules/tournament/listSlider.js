const SCROLL_LOAD_OFFSET_PX = 160;
const DESKTOP_BATCH_SIZE = 18;
const MOBILE_BATCH_SIZE = 10;
const MOBILE_MAX_WIDTH = 670;

const state = {
  items: [],
  mode: "",
  renderItem: null,
  onPageRender: null,
  renderedCount: 0,
};

let scrollRafId = 0;

function getElements() {
  const listEl = document.getElementById("tournamentList");
  const viewport = listEl?.closest(".tournament-list-viewport") || null;
  return { listEl, viewport };
}

function getBatchSize() {
  return window.matchMedia &&
    window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
    ? MOBILE_BATCH_SIZE
    : DESKTOP_BATCH_SIZE;
}

function appendNextBatch() {
  const { listEl } = getElements();
  if (!listEl || typeof state.renderItem !== "function") return;
  if (state.renderedCount >= state.items.length) return;
  const nextCount = Math.min(
    state.items.length,
    state.renderedCount + getBatchSize(),
  );
  const slice = state.items.slice(state.renderedCount, nextCount);
  slice.forEach((item) => state.renderItem(item, listEl));
  state.renderedCount = nextCount;
  if (typeof state.onPageRender === "function") {
    state.onPageRender(listEl);
  }
}

function fillViewport() {
  const { viewport } = getElements();
  if (!viewport) return;
  while (
    state.renderedCount < state.items.length &&
    viewport.scrollHeight <= viewport.clientHeight + SCROLL_LOAD_OFFSET_PX
  ) {
    const before = state.renderedCount;
    appendNextBatch();
    if (state.renderedCount === before) break;
  }
}

function renderList(resetScroll = true) {
  const { listEl, viewport } = getElements();
  if (!listEl || typeof state.renderItem !== "function") return;
  listEl.innerHTML = "";
  state.renderedCount = 0;
  if (viewport && resetScroll) {
    viewport.scrollTop = 0;
  }
  appendNextBatch();
  fillViewport();
}

export function setTournamentListItems(
  items = [],
  { mode = "", renderItem, onPageRender } = {},
) {
  state.mode = mode || state.mode;
  state.items = Array.isArray(items) ? items : [];
  state.renderItem = renderItem || state.renderItem;
  state.onPageRender = onPageRender || state.onPageRender;
  renderList(true);
}

export function goTournamentListPage() {}

export function refreshTournamentListLayout() {
  renderList(false);
}

export function loadMoreTournamentListItems() {
  const { viewport } = getElements();
  if (!viewport) return;
  appendNextBatch();
  fillViewport();
}

export function initTournamentListSlider() {
  const { viewport } = getElements();
  if (!viewport) return;
  viewport.addEventListener(
    "scroll",
    () => {
      if (scrollRafId) return;
      scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = 0;
        if (
          viewport.scrollTop + viewport.clientHeight >=
          viewport.scrollHeight - SCROLL_LOAD_OFFSET_PX
        ) {
          loadMoreTournamentListItems();
        }
      });
    },
    { passive: true },
  );
}
