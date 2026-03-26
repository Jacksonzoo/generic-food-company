// Default values — persisted to localStorage by the UI layer
export const DEFAULTS = {
  freightRate: 1.05,       // $/lb
  wetlockUnitPrice: 6.50,  // $/case
  decimals: 7,             // display precision
};

// Case-size constants
export const UNITS_PER_CASE = {
  tubs4lb: 12,
  jars16oz: 48,
};

// Freight source priority labels (informational only)
export const FREIGHT_SOURCE = {
  MAERSK: "Maersk invoice",
  DELTA_DN: "Delta DN weight",
  AWB: "AWB chargeable weight",
  MANUAL: "Manual $",
};
