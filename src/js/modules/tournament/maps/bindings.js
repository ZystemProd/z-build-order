export function bindMapSelectionEvents({
  setMapPoolSelection,
  getDefaultMapPoolNames,
  toggleMapSelection,
}) {
  const useLadderMapsBtn = document.getElementById("useLadderMapsBtn");
  const clearMapPoolBtn = document.getElementById("clearMapPoolBtn");
  const mapPoolPicker = document.getElementById("mapPoolPicker");
  const settingsUseLadderMapsBtn = document.getElementById(
    "settingsUseLadderMapsBtn"
  );
  const settingsClearMapPoolBtn = document.getElementById(
    "settingsClearMapPoolBtn"
  );
  const settingsMapPoolPicker = document.getElementById(
    "settingsMapPoolPicker"
  );

  useLadderMapsBtn?.addEventListener("click", () =>
    setMapPoolSelection(getDefaultMapPoolNames())
  );
  clearMapPoolBtn?.addEventListener("click", () => setMapPoolSelection([]));
  mapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleMapSelection(card.dataset.mapName);
  });

  settingsUseLadderMapsBtn?.addEventListener("click", () =>
    setMapPoolSelection(getDefaultMapPoolNames())
  );
  settingsClearMapPoolBtn?.addEventListener("click", () =>
    setMapPoolSelection([])
  );
  settingsMapPoolPicker?.addEventListener("click", (e) => {
    const card = e.target.closest(".tournament-map-card");
    if (!card) return;
    toggleMapSelection(card.dataset.mapName);
  });
}
