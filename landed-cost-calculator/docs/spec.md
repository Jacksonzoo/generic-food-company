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

## Settings (localStorage only)
- Default freight rate (`lcc_freightRate`)
- Default wetlock unit price (`lcc_wetlockUnitPrice`)
- Decimal precision (`lcc_decimals`)

No PO data is stored.

## Deploy
GitHub Pages: `https://Jacksonzoo.github.io/generic-food-company/landed-cost-calculator/`
