function ensureMatchReadyToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

export function showMatchReadyToastUi({
  matchId,
  message,
  opponentName,
  opponentAvatarUrl,
  defaultAvatarUrl,
  shownSet,
  dismissedSet,
  onGo,
}) {
  if (!matchId) return;
  if (dismissedSet?.has(matchId)) return;
  if (shownSet?.has(matchId)) return;

  const container = ensureMatchReadyToastContainer();
  if (!container) return;
  container.classList.add("toast-container--match-ready");

  shownSet?.add(matchId);

  const toast = document.createElement("div");
  toast.className = "toast toast--action toast--match-ready";
  toast.dataset.matchId = matchId;
  toast.style.opacity = "0";
  toast.style.transform = "scale(0.98)";

  const text = document.createElement("div");
  text.className = "toast__text";

  const title = document.createElement("div");
  title.className = "toast__title";
  title.textContent = message || "Your match is ready.";

  const meta = document.createElement("div");
  meta.className = "toast__meta";
  const label = document.createElement("span");
  label.className = "toast__label";
  label.textContent = "Opponent";

  const avatar = document.createElement("img");
  avatar.className = "toast__avatar";
  avatar.alt = "";
  avatar.src = opponentAvatarUrl || defaultAvatarUrl || "";

  const opponent = document.createElement("span");
  opponent.className = "toast__opponent";
  opponent.textContent = opponentName || "TBD";

  meta.append(label, avatar, opponent);
  text.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "toast__actions";

  const goBtn = document.createElement("button");
  goBtn.type = "button";
  goBtn.className = "toast__btn toast__btn--primary";
  goBtn.textContent = "Go";
  goBtn.onclick = () => {
    shownSet?.delete(matchId);
    toast.remove();
    if (!container.querySelector(".toast--match-ready")) {
      container.classList.remove("toast-container--match-ready");
    }
    onGo?.(matchId);
  };

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "toast__btn";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.onclick = () => {
    shownSet?.delete(matchId);
    dismissedSet?.add(matchId);
    toast.remove();
    if (!container.querySelector(".toast--match-ready")) {
      container.classList.remove("toast-container--match-ready");
    }
  };

  actions.append(goBtn, dismissBtn);
  toast.append(text, actions);
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "scale(1)";
  });
}
