export function getBracketSetting() {
  const value = localStorage.getItem('enableBrackets');
  return value === null ? true : value === 'true';
}

export function setBracketSetting(enabled) {
  localStorage.setItem('enableBrackets', enabled ? 'true' : 'false');
}
