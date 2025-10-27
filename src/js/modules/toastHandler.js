import DOMPurify from "dompurify";

function ensureToastStyles() {
  // If a stylesheet already present, do nothing
  if (
    document.querySelector('link[href$="showToast.css"][rel="stylesheet"]') ||
    document.getElementById("toast-inline-style")
  )
    return;

  // If preload tag exists, flip it to stylesheet (in case onload didn’t fire)
  const preload = document.getElementById("toast-css-preload");
  if (preload && preload.rel !== "stylesheet") {
    preload.rel = "stylesheet";
    return;
  }

  // Lazy-inject stylesheet when first needed
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "style";
  link.href = "public/css/showToast.css";
  link.onload = function () {
    this.onload = null;
    this.rel = "stylesheet";
  };
  document.head.appendChild(link);
}

export function showToast(message, type = "success", duration = 3000) {
  ensureToastStyles();
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
  ${type === "error" || type === "warning" ? "⚠ " : ""} ${DOMPurify.sanitize(
    message
  )}
`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => {
      if (toast.parentElement === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, duration);
}
