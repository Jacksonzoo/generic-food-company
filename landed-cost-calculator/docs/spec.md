# Landed Cost Calculator — Spec

## Purpose
Stateless browser tool for A&D to compute adjusted lot costs (unit costs) for Entree by allocating freight and wetlock/SP costs across shipment SKUs.

## Freight Rule (source of truth)
Use the weight/cost the freight invoice is actually billed on (Maersk billing basis).

Priority: **Maersk invoice > Delta DN weight > AWB chargeable > shipper order**

## Allocation Math

```
Pool = Freight + WetlockTotal
WetlockTotal = wetlockQtyCases × wetlockUnitPrice

$/case = Pool ÷ TotalCasesShipped
```

### Case allocation
```
cases4     = qty4 / 12
casesShell = qtyShell
fixedCases = cases4 + casesShell

retailCases = max(0, totalCases - fixedCases)
cases16     = min(qty16 / 48, retailCases)
cases10     = retailCases - cases16
```

### Per-unit adder
```
freightAdd(sku) = (casesUsed × freightPerCase) / qty
wetlockAdd(sku) = (casesUsed × wetlockPerCase) / qty
finalCost(sku)  = baseCost + wetlockAdd + freightAdd
```

### Tie-out
```
InvoiceTotalNoFreight = Σ(qty × baseCost) + WetlockTotal
ExpectedLandedTotal   = InvoiceTotalNoFreight + Freight
AdjustedTotal         = Σ(qty × finalCost)

|AdjustedTotal - ExpectedLandedTotal| must be < $0.01
```

## Confirmed PO Examples

| PO     | Freight    | Wetlock  | Cases | 16oz        | 10oz        | 4#           | Shell      |
|--------|-----------|----------|-------|-------------|-------------|--------------|------------|
| 88993  | $585.90   | 9×6.50   | 9     | 9.5416667   | 6.6925      | 35.1666667   | 143.60     |
| 89601  | 616×1.05  | 10×6.50  | 10    | 9.532917    | 6.684625    | 35.1316667   | —          |
| 89699  | 588×1.05  | 10×6.50  | 10    | 9.4716667   | —           | 34.8866667   | 140.24     |
| 89791  | 796×1.05  | 13×6.50  | 13    | 9.5248397   | 6.6773558   | 35.0993590   | —          |
| 89908  | 926×1.05  | 16×6.50  | 16    | 9.4514323   | 6.6112891   | 34.8057292   | 139.26875  |

These live in `src/core/examples.js`. The same list drives `tests/examples.test.js` and the
in-app **Examples** menu, which re-checks each PO against its confirmed costs when loaded.

## Interface

Two panes: a three-step entry form (left) and a sticky results panel (right) that
recalculates on every keystroke. Below 1024px the panels stack and a bottom action bar
keeps the tie-out status and **Copy for Entree** in reach.

| Area | Behavior |
|------|----------|
| Step 1 — Shipment & freight | PO #, freight as *Weight × rate* or *Freight $*, and freight source (Maersk invoice / Delta DN wt / AWB). Source is informational and never changes the math. |
| Step 2 — Wet lock box & cases | Total cases is linked to wetlock qty by default; unlink to enter it by hand. A mismatch warns but doesn't block. |
| Step 3 — Products | Qty + base cost per SKU with a live extended total and an invoice footer (products + SP). |
| Validation | Errors show once a field has been edited and left, or for every field after **Calculate**. Typos like `92x6` are rejected instead of truncated. Money fields format to 2+ decimals on blur. |
| Results | Notices, lot cost per SKU (Base + SP + Freight, uplift %), copy per SKU, copy all, shipment KPIs, tie-out, and an allocation audit trail with a case bar. |
| Notices | `src/core/notices.js` explains problems in plain language: tie-out failure, fixed cases exceeding cases shipped, 16oz capped, no room for 10oz, orphaned retail cases, case mismatch, partial 4# case, non-invoice freight source. |
| Tools | Examples menu, Reset (with Undo), light/dark theme, Defaults dialog, print-ready audit sheet, `⌘/Ctrl + Shift + E` to copy all for Entree. |

## Architecture

```
landed-cost-calculator/
├── index.html            markup + icon sprite
├── styles/
│   ├── tokens.css        design tokens (color, type, spacing, elevation; light + dark)
│   └── app.css           components, layout, responsive, print
├── src/
│   ├── app.js            controller: events, update loop, menus, dialog, shortcuts
│   ├── core/             pure logic — no DOM
│   │   ├── allocation.js, calculator.js   the math contract (unchanged)
│   │   ├── validators.js                  field-level errors + warnings
│   │   ├── notices.js                     plain-language findings
│   │   ├── examples.js                    confirmed PO fixtures
│   │   └── constants.js
│   └── ui/
│       ├── form.js       parse/format inputs, form ⇄ input mapping
│       ├── renderer.js   results panel + live form figures
│       ├── format.js     money/number formatters, Entree text
│       ├── settings.js   localStorage preferences
│       ├── toast.js, clipboard.js
└── tests/                Vitest — `npm test` from the repo root
```

## Settings (localStorage only)
- Default freight rate (`lcc_freightRate`)
- Default wetlock unit price (`lcc_wetlockUnitPrice`)
- Decimal precision (`lcc_decimals`)
- Theme (`lcc_theme`, absent = follow system)

No PO data is stored.

## Deploy
GitHub Pages: `https://Jacksonzoo.github.io/generic-food-company/landed-cost-calculator/`
