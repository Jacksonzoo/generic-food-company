import { DEFAULTS } from "../core/constants.js";

// Only preferences live here. PO data is never written to storage.
const KEYS = {
  freightRate:      "lcc_freightRate",
  wetlockUnitPrice: "lcc_wetlockUnitPrice",
  decimals:         "lcc_decimals",
  theme:            "lcc_theme",
};

// Storage can throw (private windows, blocked site data). Settings are a
// convenience, so failures fall back to defaults rather than breaking the app.
function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* not persisted */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* not persisted */ }
}

export function loadSettings() {
  return {
    freightRate:      parseFloat(read(KEYS.freightRate))      || DEFAULTS.freightRate,
    wetlockUnitPrice: parseFloat(read(KEYS.wetlockUnitPrice)) || DEFAULTS.wetlockUnitPrice,
    decimals:         parseInt(read(KEYS.decimals), 10)       || DEFAULTS.decimals,
  };
}

export function saveSettings({ freightRate, wetlockUnitPrice, decimals }) {
  write(KEYS.freightRate,      freightRate);
  write(KEYS.wetlockUnitPrice, wetlockUnitPrice);
  write(KEYS.decimals,         decimals);
}

/** @returns {"system"|"light"|"dark"} */
export function loadTheme() {
  const theme = read(KEYS.theme);
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function saveTheme(theme) {
  if (theme === "system") remove(KEYS.theme);
  else write(KEYS.theme, theme);
}
