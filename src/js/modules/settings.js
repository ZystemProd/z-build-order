const BRACKET_KEY = 'enableBracketInput';

export function isBracketInputEnabled() {
  const value = localStorage.getItem(BRACKET_KEY);
  return value === null ? true : value === 'true';
}

export function setBracketInputEnabled(enabled) {
  localStorage.setItem(BRACKET_KEY, enabled ? 'true' : 'false');
}
