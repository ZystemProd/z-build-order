export async function generateUniqueSlug() {
  return `t-${Date.now().toString(36)}`;
}

export function updateSlugPreview() {
  const slugInput = document.getElementById("tournamentSlugInput");
  const preview = document.getElementById("slugPreview");
  if (slugInput && preview) {
    const next = (slugInput.value || "").toLowerCase();
    if (slugInput.value !== next) slugInput.value = next;
    preview.textContent = next;
  }
}

export function updateFinalSlugPreview() {
  const slugInput = document.getElementById("finalTournamentSlugInput");
  const prefix = document.getElementById("finalSlugPrefix");
  if (slugInput && prefix) {
    const next = (slugInput.value || "").toLowerCase();
    if (slugInput.value !== next) slugInput.value = next;
    const circuitSlug = (document.getElementById("circuitSlugInput")?.value || "")
      .trim()
      .toLowerCase();
    prefix.textContent = `https://zbuildorder.com/${circuitSlug || ""}`;
  }
}
