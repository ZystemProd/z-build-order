function getPaginationEl(listEl) {
  if (!listEl) return null;
  const slider = listEl.closest(".tournament-list-slider");
  if (!slider) return null;
  return slider.querySelector(".tournament-list-pagination");
}

export function updateTournamentListPagination(listEl, { page, pageSize, total, isMobile }) {
  const paginationEl = getPaginationEl(listEl);
  if (!paginationEl) return;
  if (isMobile || !pageSize || total <= pageSize) {
    paginationEl.style.display = "none";
    paginationEl.innerHTML = "";
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  paginationEl.style.display = "flex";
  const dots = Array.from({ length: totalPages }).map((_, idx) => {
    const active = idx === page ? " is-active" : "";
    return `<span class="list-page-dot${active}" aria-hidden="true"></span>`;
  });
  paginationEl.innerHTML = dots.join("");
}
