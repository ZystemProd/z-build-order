export function playerKey(name, link) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (link) {
    return `${base}-${link.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  return base;
}
