export function formatLocalDateTimeInput(value, { separator = "T" } = {}) {
  if (value === null || value === undefined) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}${separator}${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
