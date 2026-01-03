function updateSettingsHelperText(id, message, tone = "muted") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  let color = "#b0b0b0";
  if (tone === "error") color = "#ff9a9a";
  else if (tone === "success") color = "#9ae6b4";
  else if (tone === "info") color = "#8be9fd";
  el.style.color = color;
}

export { updateSettingsHelperText };
