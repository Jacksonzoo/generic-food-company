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

// Products in display order. `label` matches the `sku` strings returned by calculate().
export const SKUS = [
  { key: "16oz",  label: "16oz jars",     unit: "jar",  qtyKey: "qty16",    costKey: "baseCost16",    pack: "48 per case" },
  { key: "10oz",  label: "10oz jars",     unit: "jar",  qtyKey: "qty10",    costKey: "baseCost10",    pack: "Fills leftover retail space" },
  { key: "4lb",   label: "4# tubs",       unit: "tub",  qtyKey: "qty4",     costKey: "baseCost4",     pack: "12 per case" },
  { key: "shell", label: "Shell oysters", unit: "case", qtyKey: "qtyShell", costKey: "baseCostShell", pack: "Qty is cases" },
];

// Freight paperwork, in order of preference (informational only — never changes the math)
export const FREIGHT_SOURCES = [
  { id: "maersk", label: "Maersk invoice", hint: "Preferred" },
  { id: "delta",  label: "Delta DN wt",    hint: "Proxy until invoice" },
  { id: "awb",    label: "AWB chargeable", hint: "Last resort" },
];

// Adjusted total may differ from the expected landed total by less than this ($)
export const TIE_OUT_TOLERANCE = 0.01;
