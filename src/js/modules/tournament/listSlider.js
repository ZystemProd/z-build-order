const SLIDER_GAP_PX = 12;
const SLIDER_MIN_CARD_WIDTH = 240;
const SLIDER_DISABLE_MAX = 640;
const MOBILE_PAGE_SIZE = 6;

const state = {
  items: [],
  page: 0,
  pageSize: 0,
  mode: "",
  renderItem: null,
  onPageRender: null,
  lastStartIndex: 0,
  mobileStartIndex: 0,
  mobileAnchorIndex: 0,
  isMobile: false,
};

let scrollRafId = 0;

function getElements() {
  const listEl = document.getElementById("tournamentList");
  const prevBtn = document.getElementById("tournamentListPrev");
  const nextBtn = document.getElementById("tournamentListNext");
  return { listEl, prevBtn, nextBtn };
}

function computeColumns(listEl) {
  if (!listEl) return 1;
  if (window.matchMedia && window.matchMedia(`(max-width: ${SLIDER_DISABLE_MAX}px)`).matches) {
    listEl.style.setProperty("--slider-cols", "1");
    return 1;
  }
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
  const sliderDisabled =
    window.matchMedia &&
    window.matchMedia(`(max-width: ${SLIDER_DISABLE_MAX}px)`).matches;
  state.isMobile = Boolean(sliderDisabled);
  const cols = computeColumns(listEl);
  state.pageSize = sliderDisabled ? MOBILE_PAGE_SIZE : Math.max(1, cols * 2);
  const total = state.items.length;
  const maxPage = Math.max(0, Math.ceil(total / state.pageSize) - 1);
  state.page = Math.min(state.page, maxPage);
  if (sliderDisabled) state.page = 0;
  if (!sliderDisabled) {
    listEl.innerHTML = "";
  }
  const start = sliderDisabled ? state.mobileStartIndex : state.page * state.pageSize;
  if (!sliderDisabled) state.lastStartIndex = start;
  const slice = state.items.slice(start, start + state.pageSize);
  if (sliderDisabled) {
    listEl.innerHTML = "";
    const end = Math.min(
      state.items.length,
      state.mobileAnchorIndex + state.pageSize
    );
    const initialSlice = state.items.slice(0, end);
    initialSlice.forEach((item) => state.renderItem(item, listEl));
    listEl.dataset.mobileRendered = String(initialSlice.length);
    const viewport = listEl.closest(".tournament-list-viewport");
    const anchorEl = listEl.children[state.mobileAnchorIndex];
    if (viewport && anchorEl) {
      requestAnimationFrame(() => {
        viewport.scrollTop = anchorEl.offsetTop;
      });
    }
    if (viewport && Number(listEl.dataset.mobileRendered || 0) < state.items.length) {
      loadMoreTournamentListItems();
    }
  } else {
    slice.forEach((item) => state.renderItem(item, listEl));
  }
  if (typeof state.onPageRender === "function") {
    state.onPageRender(listEl);
  }
  if (prevBtn) prevBtn.disabled = sliderDisabled || state.page <= 0;
  if (nextBtn) nextBtn.disabled = sliderDisabled || state.page >= maxPage;
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
  const wasMobile = state.isMobile;
  renderPage();
  const isMobile = state.isMobile;
  if (wasMobile === isMobile) return;
  if (!isMobile && state.pageSize > 0) {
    const targetPage = Math.floor(state.lastStartIndex / state.pageSize);
    state.page = Math.max(0, targetPage);
    renderPage();
  } else if (isMobile) {
    const { listEl } = getElements();
    if (listEl) {
      state.mobileStartIndex = 0;
      state.mobileAnchorIndex = state.lastStartIndex;
      delete listEl.dataset.mobileRendered;
      renderPage();
    }
  }
}

export function loadMoreTournamentListItems() {
  const { listEl } = getElements();
  if (!listEl) return;
  const isMobile =
    window.matchMedia &&
    window.matchMedia(`(max-width: ${SLIDER_DISABLE_MAX}px)`).matches;
  if (!isMobile) return;
  const rendered = Number(listEl.dataset.mobileRendered || 0);
  if (rendered >= state.items.length) return;
  const nextSlice = state.items.slice(rendered, rendered + state.pageSize);
  nextSlice.forEach((item) => state.renderItem(item, listEl));
  listEl.dataset.mobileRendered = String(rendered + nextSlice.length);
  const viewport = listEl.closest(".tournament-list-viewport");
  const updated = Number(listEl.dataset.mobileRendered || 0);
  if (
    viewport &&
    updated < state.items.length &&
    viewport.scrollHeight <= viewport.clientHeight
  ) {
    loadMoreTournamentListItems();
  }
}

export function initTournamentListSlider() {
  const { listEl, prevBtn, nextBtn } = getElements();
  prevBtn?.addEventListener("click", () => goTournamentListPage(-1));
  nextBtn?.addEventListener("click", () => goTournamentListPage(1));
  const viewport = listEl?.closest(".tournament-list-viewport");
  if (!viewport) return;
  viewport.addEventListener(
    "scroll",
    () => {
      if (scrollRafId) return;
      scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = 0;
        if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 80) {
          loadMoreTournamentListItems();
        }
      });
    },
    { passive: true }
  );
}
