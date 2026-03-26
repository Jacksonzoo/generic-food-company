import { DEFAULTS } from "../core/constants.js";

const KEYS = {
  freightRate:      "lcc_freightRate",
  wetlockUnitPrice: "lcc_wetlockUnitPrice",
  decimals:         "lcc_decimals",
};

export function loadSettings() {
  return {
    freightRate:      parseFloat(localStorage.getItem(KEYS.freightRate))      || DEFAULTS.freightRate,
    wetlockUnitPrice: parseFloat(localStorage.getItem(KEYS.wetlockUnitPrice)) || DEFAULTS.wetlockUnitPrice,
    decimals:         parseInt(localStorage.getItem(KEYS.decimals), 10)       || DEFAULTS.decimals,
  };
}

export function saveSettings({ freightRate, wetlockUnitPrice, decimals }) {
  localStorage.setItem(KEYS.freightRate,      freightRate);
  localStorage.setItem(KEYS.wetlockUnitPrice, wetlockUnitPrice);
  localStorage.setItem(KEYS.decimals,         decimals);
}
