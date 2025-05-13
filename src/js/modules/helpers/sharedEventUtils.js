export function safeAdd(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.removeEventListener(event, handler);
  el.addEventListener(event, handler);
}

export function safeInput(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", (e) => callback(e.target.value.trim()));
}

export function safeChange(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", callback);
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
