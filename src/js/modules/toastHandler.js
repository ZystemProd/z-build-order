import DOMPurify from "dompurify";

export function showToast(message, type = "success", duration = 3000) {
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
