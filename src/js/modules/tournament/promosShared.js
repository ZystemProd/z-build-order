export function normalizeSponsorEntry(entry, { allowEmpty = false } = {}) {
  if (!entry || typeof entry !== "object") return null;
  const name = String(entry.name || "").trim();
  const imageUrl = String(entry.imageUrl || "").trim();
  const linkUrl = String(entry.linkUrl || "").trim();
  if (!name && !imageUrl && !linkUrl && !allowEmpty) return null;
  return { name, imageUrl, linkUrl };
}

export function normalizeSocialEntry(entry, { allowEmpty = false } = {}) {
  if (!entry || typeof entry !== "object") return null;
  const type = String(entry.type || "custom").trim().toLowerCase();
  const label = String(entry.label || "").trim();
  const url = String(entry.url || "").trim();
  if (!label && !url && !allowEmpty) return null;
  return { type: type || "custom", label, url };
}

export const SOCIAL_OPTIONS = [
  { type: "custom", label: "Custom" },
  { type: "twitch", label: "Twitch" },
  { type: "youtube", label: "YouTube" },
  { type: "discord", label: "Discord" },
  { type: "x", label: "X" },
  { type: "instagram", label: "Instagram" },
  { type: "tiktok", label: "TikTok" },
  { type: "facebook", label: "Facebook" },
];

export function getSocialLabelForType(type) {
  const entry = SOCIAL_OPTIONS.find((opt) => opt.type === type);
  return entry?.label || "Custom";
}

export function validateSocialUrl(type, rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return "";
  if (type === "custom") return "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return "URL is invalid.";
  }
  const host = parsed.hostname.toLowerCase();
  const isHost = (value) => host === value || host.endsWith(`.${value}`);
  const expected = {
    twitch: ["twitch.tv"],
    youtube: ["youtube.com", "youtu.be"],
    discord: ["discord.gg", "discord.com", "discordapp.com"],
    x: ["x.com", "twitter.com"],
    instagram: ["instagram.com"],
    tiktok: ["tiktok.com"],
    facebook: ["facebook.com", "fb.com"],
  };
  const allowed = expected[type] || [];
  if (!allowed.some(isHost)) {
    return `URL must be from ${allowed.join(", ")}.`;
  }
  return "";
}

export function buildSocialIconSvg(type) {
  switch (type) {
    case "twitch":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 4h16v10H9l-3 3v-3H4V4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M10 8h2v4h-2zM14 8h2v4h-2z" fill="currentColor"/>
      </svg>`;
    case "youtube":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="7" width="18" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor"/>
      </svg>`;
    case "discord":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18 7.5c-1-.8-2.2-1.4-3.4-1.6l-.4.8c-1-.2-2-.2-3 0l-.4-.8c-1.2.2-2.4.8-3.4 1.6-1.8 2.7-2.3 5.3-2.1 7.9 1.2.9 2.5 1.6 3.9 2 .3-.4.6-.9.8-1.4-.5-.2-1-.4-1.5-.7.1-.1.2-.2.3-.2 2.9 1.3 6.1 1.3 9 0 .1.1.2.2.3.2-.5.3-1 .6-1.5.7.2.5.5 1 .8 1.4 1.4-.4 2.7-1.1 3.9-2 .2-2.6-.3-5.2-2.1-7.9z" fill="currentColor"/>
        <circle cx="9.5" cy="12.5" r="1.1" fill="#0f1118"/>
        <circle cx="14.5" cy="12.5" r="1.1" fill="#0f1118"/>
      </svg>`;
    case "x":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "instagram":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="17" cy="7" r="1" fill="currentColor"/>
      </svg>`;
    case "tiktok":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14 6v8.2a3.8 3.8 0 1 1-2-3.3V6h2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "facebook":
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14 8h-2c-.6 0-1 .4-1 1v2h3l-.4 3H11v6H8v-6H6v-3h2V9c0-2 1.3-3 3.2-3H14v3z" fill="currentColor"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 12a4 4 0 0 1 4-4h3v2h-3a2 2 0 0 0 0 4h3v2h-3a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M13 10h3a4 4 0 0 1 0 8h-3v-2h3a2 2 0 0 0 0-4h-3v-2z" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>`;
  }
}

export function renderSponsorSettingsList(list, entries = [], emptyText = "") {
  if (!list) return;
  list.replaceChildren();
  const normalized = (entries || [])
    .map((entry) => normalizeSponsorEntry(entry, { allowEmpty: true }))
    .filter(Boolean);
  if (!normalized.length) {
    const empty = document.createElement("p");
    empty.className = "helper";
    empty.textContent = emptyText || "No sponsors added yet.";
    list.appendChild(empty);
    return;
  }
  normalized.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "sponsor-settings-row";

    const nameRow = document.createElement("div");
    nameRow.className = "settings-row";
    const nameLabel = document.createElement("div");
    nameLabel.className = "settings-row-label";
    nameLabel.textContent = "Name";
    const nameControl = document.createElement("div");
    nameControl.className = "settings-row-control";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "settings-input";
    nameInput.value = entry.name || "";
    nameInput.placeholder = "Sponsor name";
    nameInput.dataset.sponsorField = "name";
    nameControl.appendChild(nameInput);
    nameRow.append(nameLabel, nameControl);

    const imageRow = document.createElement("div");
    imageRow.className = "settings-row";
    const imageLabel = document.createElement("div");
    imageLabel.className = "settings-row-label";
    imageLabel.textContent = "Logo";
    const imageControl = document.createElement("div");
    imageControl.className = "settings-row-control";
    const imageWrap = document.createElement("div");
    imageWrap.className = "image-upload";
    const imageActions = document.createElement("div");
    imageActions.className = "image-upload-actions";
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.dataset.sponsorField = "logoFile";
    const imagePreviewWrap = document.createElement("div");
    imagePreviewWrap.className = "image-preview";
    const imagePreview = document.createElement("img");
    imagePreview.className = "sponsor-settings-logo";
    imagePreview.alt = "Sponsor logo preview";
    if (entry.imageUrl) {
      imagePreview.src = entry.imageUrl;
      imagePreview.dataset.sponsorImageUrl = entry.imageUrl;
    }
    imagePreviewWrap.appendChild(imagePreview);
    imageActions.appendChild(imageInput);
    imageWrap.append(imageActions, imagePreviewWrap);
    imageControl.appendChild(imageWrap);
    imageRow.append(imageLabel, imageControl);

    const linkRow = document.createElement("div");
    linkRow.className = "settings-row";
    const linkLabel = document.createElement("div");
    linkLabel.className = "settings-row-label";
    linkLabel.textContent = "Link URL";
    const linkControl = document.createElement("div");
    linkControl.className = "settings-row-control";
    const linkInput = document.createElement("input");
    linkInput.type = "text";
    linkInput.className = "settings-input";
    linkInput.value = entry.linkUrl || "";
    linkInput.placeholder = "https://...";
    linkInput.dataset.sponsorField = "linkUrl";
    linkControl.appendChild(linkInput);
    linkRow.append(linkLabel, linkControl);

    const actions = document.createElement("div");
    actions.className = "sponsor-settings-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "cta ghost small";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.sponsorRemove = "true";
    actions.appendChild(removeBtn);

    row.append(nameRow, imageRow, linkRow, actions);
    list.appendChild(row);
  });
}

export function renderSocialSettingsList(list, entries = [], emptyText = "") {
  if (!list) return;
  list.replaceChildren();
  const normalized = (entries || [])
    .map((entry) => normalizeSocialEntry(entry, { allowEmpty: true }))
    .filter(Boolean);
  if (!normalized.length) {
    const empty = document.createElement("p");
    empty.className = "helper";
    empty.textContent = emptyText || "No social links added yet.";
    list.appendChild(empty);
    return;
  }
  normalized.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "sponsor-settings-row";

    const header = document.createElement("div");
    header.className = "social-row-header";
    const headerTitle = document.createElement("span");
    headerTitle.className = "social-row-title";
    headerTitle.textContent = entry.label || getSocialLabelForType(entry.type);
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "cta ghost small";
    toggleBtn.classList.add("social-toggle-btn");
    toggleBtn.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    toggleBtn.dataset.socialToggle = "true";
    header.append(headerTitle, toggleBtn);

    const body = document.createElement("div");
    body.className = "social-row-body";

    const typeRow = document.createElement("div");
    typeRow.className = "settings-row";
    const typeLabel = document.createElement("div");
    typeLabel.className = "settings-row-label";
    typeLabel.textContent = "Platform";
    const typeControl = document.createElement("div");
    typeControl.className = "settings-row-control social-type-row";
    const typeIcon = document.createElement("span");
    typeIcon.className = "social-icon";
    typeIcon.innerHTML = buildSocialIconSvg(entry.type);
    const typeSelect = document.createElement("select");
    typeSelect.className = "settings-select";
    typeSelect.dataset.socialField = "type";
    SOCIAL_OPTIONS.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.type;
      option.textContent = opt.label;
      if (opt.type === entry.type) option.selected = true;
      typeSelect.appendChild(option);
    });
    typeControl.append(typeIcon, typeSelect);
    typeRow.append(typeLabel, typeControl);

    const labelRow = document.createElement("div");
    labelRow.className = "settings-row";
    const labelLabel = document.createElement("div");
    labelLabel.className = "settings-row-label";
    labelLabel.textContent = "Label";
    const labelControl = document.createElement("div");
    labelControl.className = "settings-row-control";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "settings-input";
    labelInput.value = entry.label || "";
    labelInput.placeholder = "Twitter, Discord, Twitch...";
    labelInput.dataset.socialField = "label";
    labelControl.appendChild(labelInput);
    labelRow.append(labelLabel, labelControl);

    const urlRow = document.createElement("div");
    urlRow.className = "settings-row";
    const urlLabel = document.createElement("div");
    urlLabel.className = "settings-row-label";
    urlLabel.textContent = "URL";
    const urlControl = document.createElement("div");
    urlControl.className = "settings-row-control";
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.className = "settings-input";
    urlInput.value = entry.url || "";
    urlInput.placeholder = "https://...";
    urlInput.dataset.socialField = "url";
    urlControl.appendChild(urlInput);
    urlRow.append(urlLabel, urlControl);

    const actions = document.createElement("div");
    actions.className = "sponsor-settings-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "cta ghost small";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.socialRemove = "true";
    actions.appendChild(removeBtn);

    body.append(typeRow, labelRow, urlRow, actions);
    row.append(header, body);
    list.appendChild(row);
  });
}

export function readSponsorSettingsList(list) {
  if (!list) return [];
  const rows = Array.from(list.querySelectorAll(".sponsor-settings-row"));
  return rows
    .map((row) => {
      const name = String(
        row.querySelector("[data-sponsor-field='name']")?.value || ""
      ).trim();
      const imageUrl = String(
        row.querySelector(".sponsor-settings-logo")?.dataset?.sponsorImageUrl ||
          ""
      ).trim();
      const linkUrl = String(
        row.querySelector("[data-sponsor-field='linkUrl']")?.value || ""
      ).trim();
      const fileInput = row.querySelector("[data-sponsor-field='logoFile']");
      const file = fileInput?.files?.[0] || null;
      return {
        ...normalizeSponsorEntry(
          { name, imageUrl, linkUrl },
          { allowEmpty: true }
        ),
        file,
      };
    })
    .filter(Boolean);
}

export function readSocialSettingsList(list) {
  if (!list) return [];
  const rows = Array.from(list.querySelectorAll(".sponsor-settings-row"));
  return rows
    .map((row) => {
      const type = String(
        row.querySelector("[data-social-field='type']")?.value || "custom"
      ).trim();
      const label = String(
        row.querySelector("[data-social-field='label']")?.value || ""
      ).trim();
      const url = String(
        row.querySelector("[data-social-field='url']")?.value || ""
      ).trim();
      return normalizeSocialEntry({ type, label, url }, { allowEmpty: true });
    })
    .filter(Boolean);
}

export function bindSponsorSettingsControls(list, addBtn, readFn, renderFn) {
  if (!list || !addBtn || list.dataset.bound === "true") return;
  list.dataset.bound = "true";
  addBtn.addEventListener("click", () => {
    const current = readFn();
    current.push({ name: "", imageUrl: "", linkUrl: "" });
    renderFn(current);
  });
  list.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-sponsor-remove]");
    if (!removeBtn) return;
    const row = removeBtn.closest(".sponsor-settings-row");
    if (!row) return;
    row.remove();
    const remaining = readFn();
    renderFn(remaining);
  });
  list.addEventListener("change", (event) => {
    const input = event.target.closest("[data-sponsor-field='logoFile']");
    if (!input) return;
    const row = input.closest(".sponsor-settings-row");
    const preview = row?.querySelector(".sponsor-settings-logo");
    const file = input.files?.[0] || null;
    if (!preview) return;
    if (!file) {
      preview.removeAttribute("src");
      delete preview.dataset.sponsorImageUrl;
      return;
    }
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.dataset.sponsorImageUrl = "";
    preview.onload = () => {
      URL.revokeObjectURL(url);
    };
  });
}

export function bindSocialSettingsControls(list, addBtn, readFn, renderFn) {
  if (!list || !addBtn || list.dataset.bound === "true") return;
  list.dataset.bound = "true";
  addBtn.addEventListener("click", () => {
    const current = readFn();
    current.push({ label: "", url: "" });
    renderFn(current);
  });
  list.addEventListener("click", (event) => {
    const toggleBtn = event.target.closest("[data-social-toggle]");
    if (toggleBtn) {
      const row = toggleBtn.closest(".sponsor-settings-row");
      if (!row) return;
      row.classList.toggle("is-collapsed");
      toggleBtn.classList.toggle(
        "is-collapsed",
        row.classList.contains("is-collapsed")
      );
      return;
    }
    const removeBtn = event.target.closest("[data-social-remove]");
    if (!removeBtn) return;
    const row = removeBtn.closest(".sponsor-settings-row");
    if (!row) return;
    row.remove();
    const remaining = readFn();
    renderFn(remaining);
  });
  list.addEventListener("change", (event) => {
    const select = event.target.closest("[data-social-field='type']");
    if (!select) return;
    const row = select.closest(".sponsor-settings-row");
    const icon = row?.querySelector(".social-icon");
    const labelInput = row?.querySelector("[data-social-field='label']");
    const title = row?.querySelector(".social-row-title");
    const nextType = select.value;
    if (icon) {
      icon.innerHTML = buildSocialIconSvg(nextType);
    }
    if (labelInput && !labelInput.value.trim()) {
      labelInput.value = getSocialLabelForType(nextType);
    }
    if (title) {
      title.textContent = labelInput?.value || getSocialLabelForType(nextType);
    }
  });
}
