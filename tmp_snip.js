function makeStepsHtmlFromArray(orderArray) {
  if (!Array.isArray(orderArray) || orderArray.length === 0) return "<p>No build order available.</p>";

  const parts = [];
  orderArray.forEach((step) => {
    if (typeof step === "string") {
      parts.push(
        `<p><span class="bo-prefix"></span><span class="bo-action">${formatActionText(
          step
        )}</span></p>`
      );
      return;
    }
    if (step && typeof step === "object" && step.action && step.action.trim() !== "") {
      const prefix = step.workersOrTimestamp
        ? `<span class=\"bo-prefix\"><strong>${formatWorkersOrTimestampText(
            step.workersOrTimestamp
          )}</strong></span>`
        : `<span class=\"bo-prefix\"></span>`;
      parts.push(
        `<p>${prefix}<span class="bo-action">${formatActionText(step.action)}</span></p>`
      );
    }
  });
  return parts.length > 0 ? parts.join("") : "<p>No build order available.</p>";
}

function renderVariationTabsReadonly(currentId, build) {
  const tabsEl = document.getElementById("variationTabs");
  if (!tabsEl) return;

  // Reset state and hide initially
  viewVariationState.mode = "none";
  viewVariationState.active = "main";
  viewVariationState.tabs = [];
  viewVariationState.inline = [];
  tabsEl.innerHTML = "";
  tabsEl.style.display = "none";

  // If build has a groupId, try to load siblings from publishedBuilds
  const groupId = build?.groupId;
  if (groupId) {
    // Will be made async by caller with await
    return { type: "group", groupId };
  }

  // Fallback to inline variations saved within this build
  const inlineVars = Array.isArray(build?.variations) ? build.variations.slice(0, 5) : [];
  if (inlineVars.length > 0) {
    viewVariationState.mode = "inline";
    viewVariationState.active = "main";
    tabsEl.style.display = "flex";

    // Always render Main first
    const mainBtn = document.createElement("button");
    mainBtn.className = "variation-tab active";
    mainBtn.textContent = "Main";
    try { mainBtn.style.borderColor = MAIN_COLOR; } catch (_) {}
    mainBtn.addEventListener("click", () => {
      setInlineActiveVariation("main");
    });
    tabsEl.appendChild(mainBtn);
