export function hydrateLazyImages(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("img[data-src]:not([data-loaded])").forEach((img) => {
    const src = img.dataset.src;
    if (!src) return;
    img.src = src;
    img.dataset.loaded = "true";
  });
}

export function deferWebpImagesIn(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("img[src$='.webp']").forEach((img) => {
    if (img.dataset.src) return;
    img.dataset.src = img.getAttribute("src");
    img.removeAttribute("src");
    img.loading = "lazy";
    img.decoding = "async";
  });
}

export function deferSvgImagesIn(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("img[src$='.svg']").forEach((img) => {
    if (img.dataset.src) return;
    img.dataset.src = img.getAttribute("src");
    img.removeAttribute("src");
    img.loading = "lazy";
    img.decoding = "async";
  });
}

export function observeVisibilityForLazyImages(el) {
  if (!el || !(el instanceof HTMLElement)) return;
  const observer = new MutationObserver(() => {
    const style = window.getComputedStyle(el);
    if (style.display !== "none" && style.visibility !== "hidden") {
      hydrateLazyImages(el);
    }
  });
  observer.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
}

export function setupModalImageLazyLoading() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    deferWebpImagesIn(modal);
    deferSvgImagesIn(modal);
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      const el = m.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.classList.contains("modal")) return;
      const style = window.getComputedStyle(el);
      if (style.display !== "none" && style.visibility !== "hidden") {
        hydrateLazyImages(el);
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["style", "class"],
    subtree: true,
  });
}
