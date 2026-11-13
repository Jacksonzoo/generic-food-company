# Landed Cost Tool — Build Spec

A browser-based landed-cost calculator for a wholesale seafood distributor. Runs
entirely client-side, deployable to **GitHub Pages** (no server, no database, no
recurring cost). Every calculation is deterministic and reproducible.

The core job: take a purchase order's line items plus any supplemental charges
(freight, surcharges, pallet, etc.), allocate those charges correctly, and
produce a **final lot cost per item** that ties exactly to the invoice total —
then export it as Excel and/or PDF for the accounting team.

---

## Guiding principles

1. **Do-it-once workflow.** The user completes a PO, exports it, and hands it
   off. POs are *not* saved or revisited in the app — the exported file *is* the
   record. No storage layer of any kind (no localStorage, no backend).
2. **Pay-as-invoiced.** The amount paid equals the invoice total. Any gap between
   received value and the invoiced total is absorbed into the final lot cost so
   everything reconciles.
3. **Tie-out is a hard invariant.** After every calculation, the sum of
   (quantity × final lot cost) across all lines must equal the expected landed
   total (base + all supplementals). If it doesn't (beyond floating-point
   tolerance, e.g. 0.01), the tool shows an **error**, never a silently-wrong
   result.
4. **Auditability over cleverness.** Single-driver allocation only (never mix
   units within one allocation). Excluded items stay visible and show $0 so the
   reader can see they were deliberately excluded, not forgotten.
5. **Least-clicks UI.** Minimize interaction cost. Smart defaults; a new row
   inherits the previous row's settings.

---

## Two features (modes)

The app has two independent modes, selectable from the top nav:

- **Mode 1 — General Landed Cost** (primary, build first)
- **Mode 2 — National Fish & Oyster** (specialized, deterministic; build second)

---

## MODE 1 — General Landed Cost

### 1.1 PO header
- **PO Number** (text input, required)
- **Vendor Name** (text input, optional)
- **Invoice Total to Pay** (currency input) — the pay-as-invoiced anchor. Used
  for the final tie-out; any residual gap is absorbed into landed cost.

### 1.2 Line items
A table where each row is a product. Columns:

| Field | Notes |
|---|---|
| Description | text |
| Cases Ordered | number |
| Weight (lb) | number |
| Unit Cost | number — cost per case **or** per lb depending on driver |
| **Driver** | segmented toggle: `Cases │ Weight` (see 1.3) |
| Line Total | computed, read-only |
| Final Lot Cost | computed, read-only (per case if Cases-driven, per lb if Weight-driven) |

**Line Total** = if Cases-driven → `Cases Ordered × Unit Cost`;
if Weight-driven → `Weight × Unit Cost`.

Validate each line total on entry. If an entered figure is inconsistent with
`qty × unit cost`, flag it (the old workflow caught typos like `60 × 29.20`
mis-totaled — surface the correct product).

### 1.3 Driver control (Cases vs Weight)
- **Segmented toggle**, not a dropdown. Two side-by-side buttons `Cases │ Weight`;
  the active one is highlighted. One click to switch, no menu to open.
- A new row **defaults to the previous row's driver** (most POs are uniform, so
  this is often zero clicks).
- The driver determines both how Line Total is computed and — critically — how
  supplementals allocate to this item.

### 1.4 Supplementals (the core allocation logic)
Button: **Add Supplemental**. Behavior:

- A supplemental is a lump charge (freight, surcharge, pallet, etc.) that must be
  distributed across the line items.
- **Allocation is always single-driver.** A supplemental spread by cases uses
  each item's case count; one spread by weight uses each item's weight. Never
  blend the two in a single allocation.
- **Auto-split by driver based on the PO's mix:**
  - If **all** line items share one driver → **one** supplemental, spread across
    all items by that driver.
  - If items are **mixed** (some Cases, some Weight) → the tool **creates two
    supplementals**, one for the Cases-items (allocated by case count) and one
    for the Weight-items (allocated by weight). The user enters a total for each.
- **Excluded items stay visible but greyed out**, and their allocated amount for
  that supplemental shows **$0.00**. This makes exclusion explicit and auditable
  — an auditor sees the zero and knows it was intentional.
- Multiple supplementals can be added (e.g. freight + pallet). Each allocates
  independently by its own driver.

**Allocation formula (per supplemental, per applicable item):**
```
item_share = supplemental_total × (item_driver_value / Σ driver_value over applicable items)
```
where `driver_value` is the item's case count (cases-driver) or weight
(weight-driver).

### 1.5 Final lot cost
For each item:
```
final_lot_cost_per_unit =
    (base_line_total + Σ all supplemental shares for this item) / driver_quantity
```
where `driver_quantity` is Cases Ordered (cases-driven) or Weight (weight-driven).

Display to **4 decimal places** for per-unit costs (established preference).

### 1.6 Tie-out (mandatory)
```
expected_landed_total = Σ base_line_totals + Σ all_supplemental_totals
adjusted_total        = Σ (driver_quantity × final_lot_cost_per_unit)
assert abs(adjusted_total − expected_landed_total) < 0.01
```
Also reconcile `expected_landed_total` against **Invoice Total to Pay**; if there
is a residual gap, absorb it per the pay-as-invoiced rule and show where it
landed. On any failure, display a clear error banner — do not present results as
final.

---

## MODE 2 — National Fish & Oyster

A specialized, fully deterministic allocator for this one vendor. The user has
very limited time when doing these, so the input surface must be minimal and the
math must run in the backend. The full 20-step derivation the user provided is
the ground truth; below is the simplified operational form to code to.

### 2.1 Product set & case-equivalent conversions
| Product | Case equivalent |
|---|---|
| 4# tubs | `cases = qty / 12` |
| Shell oysters | quantity **is** the case count (fixed cases); ~5 dozen = 1 case |
| 16oz jars | `cases = qty / 48` |
| 10oz jars | **absorbs leftover retail case space** (no fixed per-case divisor) |
| Wet lock boxes | count; also used as **total shipped cases** (see 2.3) |

### 2.2 Master unit costs (persistent defaults)
Each product has a **master unit cost** that stays fixed until the user changes
it (e.g. 4# @ 29.20, 16oz @ 8.05, 10oz @ 5.35, Shell @ 72, wet lock @ 6.50).
These are editable defaults pre-filled on each new PO. (Since there's no storage
layer, "persistent" here means sensible hard-coded defaults the user can edit
per session; if cross-session persistence is later wanted, revisit — but the
do-it-once workflow means defaults-in-code is acceptable.)

### 2.3 Core algorithm
1. **Verify line totals**: `qty × unit cost` for each product; flag typos.
2. **Freight**: `freight = weight × 1.05` (default factor 1.05, editable) unless a
   direct freight dollar amount is supplied, in which case use that.
3. **Wet lock total**: `wetlock_qty × wetlock_unit_price` (default 6.50, editable
   per PO — one historical PO used 6.05).
4. **Total shipped cases** = wet lock box quantity. (Key business assumption.)
5. **Fixed cases** = `(qty4 / 12) + shell_cases`.
6. **Retail cases** = `total_cases − fixed_cases`.
7. **16oz cases** = `qty16 / 48` (cap at available retail cases if it exceeds).
8. **10oz cases** = `retail_cases − 16oz_cases` (the leftover).
9. **Freight per case** = `freight / total_cases`.
10. **Wet-lock per case** = `wetlock_total / total_cases`.
11. **Allocate per product** (freight and wet lock kept as separate adds):
    - **4# tubs**: per-case adds ÷ 12 → `final = base + wetlock/12 + freight/12`
    - **Shell**: one full case allocation each →
      `final = base + wetlock_per_case + freight_per_case`
    - **16oz**: `final = base + (cases16 × wetlock_per_case)/qty16 +
      (cases16 × freight_per_case)/qty16`
    - **10oz**: same form using `cases10` (leftover) → this is why 10oz cost
      varies most.
12. **Tie-out (hard invariant)**:
    ```
    expected = Σ(qty × base) + wetlock_total + freight
    adjusted = Σ(qty × final_lot_cost)
    assert abs(adjusted − expected) < 0.01
    ```
    Never silently pass a failing tie-out. Re-audit / error instead.

### 2.4 Manual exception handling
Allow an **explicit, documented manual override** of case allocations (the
PO11763 case, where 10oz was forced under $7.00 by manually setting 16oz→7.625
and 10oz→0.375 so retail still summed to 8). Requirements:
- Overrides must still satisfy the tie-out.
- An override is a one-off; it must **not** alter the standard formula for
  subsequent POs.
- Flag overridden POs visibly as exceptions in the output.

### 2.5 Input surface (keep minimal)
PO number → freight weight (× factor) → unit counts per product → done. Master
unit costs pre-filled and editable. Everything else computed.

---

## Outputs (both modes)

At export time the user chooses **Excel**, **PDF**, or both.

### Excel (.xlsx)
- Formula-driven where practical so accounting can trace the math.
- Two-section layout (established format): (1) build-up / reconciliation showing
  base + each supplemental as its own column, and (2) final lot cost per unit.
- Supplemental columns show the driver and divisor in the header (e.g.
  "Freight $0.6092/lb", "$11 ÷ 800 lb") so allocation is self-evident.
- Greyed-out / $0 rows for items a supplemental doesn't touch.
- 4-decimal precision on per-unit costs. Clean, print-friendly, readable cold.

### PDF
- One-page, print-optimized, scannable at a glance. Key numbers prominent.
- The clean handoff record for the boss / accounting.

Both outputs must be **self-explanatory without verbal walkthrough**.

---

## Tech / deployment notes
- Pure client-side: HTML + JS (framework optional — vanilla or a light framework
  both fine). No backend, no database, no browser storage.
- Excel export: SheetJS (xlsx) in-browser. PDF export: a client-side PDF lib
  (e.g. jsPDF) or print-to-PDF styled HTML.
- Deploy via **GitHub Pages** from the repo so the user gets a live URL.
- Keep all financial logic in a single, well-tested module with the tie-out
  invariant enforced centrally, so both modes share one source of truth for the
  reconciliation guarantee.

---

## Build order
1. Mode 1: header → line items → driver toggle → live totals.
2. Mode 1: supplementals with auto-split-by-driver + greyed exclusions.
3. Shared: tie-out invariant + error surfacing.
4. Exports: Excel, then PDF.
5. Mode 2: National Fish & Oyster deterministic engine + minimal input surface.
6. GitHub Pages deploy.
