import { SKUS, FREIGHT_SOURCES } from "../core/constants.js";
import { isOverride, priceLabel } from "../core/pricing.js";
import { money, fixed, quantity, percent, plural, escapeHtml } from "./format.js";

const icon = (name, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const SKU_BY_LABEL = Object.fromEntries(SKUS.map((s) => [s.label, s]));
const NOTICE_ICON = { danger: "x-circle", warning: "alert", info: "info" };
const sourceLabel = (id) => FREIGHT_SOURCES.find((s) => s.id === id)?.label ?? "Freight";

// ─── Form-side live figures ──────────────────────────────────────────────────

/** Update the computed lines under each form section (freight, SP, extended totals). */
export function renderFormFigures(input, errors) {
  const { freight, wetlockQty, wetlockUnitPrice, items } = input;
  const set = (id, html) => { document.getElementById(id).innerHTML = html; };
  const ok = (...keys) => keys.every((k) => !errors[k]);

  if (freight.mode === "dollars") {
    set("freight-figure", ok("dollars")
      ? `Freight <strong>${money(freight.dollars)}</strong> entered directly`
      : "Freight total appears here");
  } else {
    set("freight-figure", ok("weight", "rate")
      ? `${quantity(freight.weight)} lb × ${money(freight.rate)}/lb = <strong>${money(freight.weight * freight.rate)}</strong>`
      : "Weight × rate appears here");
  }

  const spOk = ok("wetlockQty", "wetlockUnitPrice") && wetlockQty > 0;
  set("sp-figure", spOk
    ? `${plural(wetlockQty, "case")} × ${money(wetlockUnitPrice)} = <strong>${money(wetlockQty * wetlockUnitPrice)}</strong>`
    : "Wetlock total appears here");

  let productTotal = 0;
  for (const sku of SKUS) {
    const qty = items[sku.qtyKey];
    const cost = items[sku.costKey];
    const valid = ok(sku.qtyKey, sku.costKey) && qty > 0 && cost > 0;
    if (valid) productTotal += qty * cost;
    set(`ext-${sku.key}`, valid ? money(qty * cost) : "—");
    document.querySelector(`.product[data-sku="${sku.key}"]`).dataset.active = qty > 0 ? "true" : "false";
  }

  const sp = spOk ? wetlockQty * wetlockUnitPrice : 0;
  set("invoice-figure", productTotal > 0
    ? `<span>Products ${money(productTotal)}</span><span aria-hidden="true">+</span><span>SP ${money(sp)}</span><span aria-hidden="true">=</span><strong>Invoice ${money(productTotal + sp)}</strong>`
    : `<span>Invoice total (products + SP) appears here</span>`);
}

// ─── Results panel ───────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} el
 * @param {{ label: string, done: boolean, focusId: string }[]} checklist
 */
export function renderEmpty(el, checklist) {
  el.innerHTML = `
    <div class="empty">
      <div class="empty__art">${icon("package", "icon icon--xl")}</div>
      <h3 class="empty__title">Lot costs appear here</h3>
      <p class="empty__text">Complete the three steps. Results update as you type.</p>
      <ol class="checklist">
        ${checklist.map((item) => `
          <li>
            <button type="button" class="checklist__item" data-done="${item.done}" data-focus="${item.focusId}">
              ${icon(item.done ? "check-circle" : "circle")}
              <span>${item.label}</span>
              <span class="checklist__state">${item.done ? "Done" : "Needed"}</span>
            </button>
          </li>`).join("")}
      </ol>
    </div>`;
}

/**
 * @param {HTMLElement} el
 * @param {{ calc: object, input: object, notices: object[], decimals: number,
 *           tieOk: boolean, allocOpen: boolean, shortcut: string }} model
 */
export function renderResults(el, { calc, input, notices, decimals, tieOk, allocOpen, shortcut }) {
  el.innerHTML = [
    printHeader(calc),
    noticesHTML(notices),
    lotsHTML(calc, decimals),
    actionsHTML(shortcut),
    summaryHTML(calc, input),
    tieOutHTML(calc, tieOk),
    allocationHTML(calc, input, allocOpen),
  ].join("");
}

function printHeader(calc) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return `
    <div class="print-only print-head">
      <strong>Landed cost audit${calc.po ? ` · PO ${escapeHtml(calc.po)}` : ""}</strong>
      <span>Generated ${date}</span>
    </div>`;
}

function noticesHTML(notices) {
  if (!notices.length) return "";
  return `
    <ul class="notices" aria-label="Notices">
      ${notices.map((n) => `
        <li class="notice" data-tone="${n.level}">
          ${icon(NOTICE_ICON[n.level])}
          <span>${escapeHtml(n.message)}</span>
        </li>`).join("")}
    </ul>`;
}

function lotsHTML(calc, d) {
  const rows = calc.results.map((r) => {
    const sku = SKU_BY_LABEL[r.sku];
    const final = fixed(r.finalCost, d);
    const uplift = r.baseCost > 0 ? (r.finalCost - r.baseCost) / r.baseCost : 0;
    const overridden = isOverride(sku, r.baseCost);
    return `
      <li class="lot" style="--sku: var(--sku-${sku.key})">
        <div class="lot__head">
          <span class="sku-dot" aria-hidden="true"></span>
          <span class="lot__name">${r.sku}</span>
          <span class="lot__meta">${plural(r.qty, sku.unit)} · ${quantity(r.casesUsed, 2)} cs</span>
        </div>
        <div class="lot__value">
          <span class="lot__final num">${final}</span>
          <span class="lot__unit">per ${sku.unit}</span>
          <button type="button" class="icon-btn icon-btn--sm lot__copy" data-copy="${final}" data-copy-label="${r.sku}"
            aria-label="Copy ${r.sku} lot cost ${final}" title="Copy lot cost">${icon("copy")}</button>
        </div>
        <dl class="lot__parts">
          <div>
            <dt>Base${overridden ? ` <span class="tag" title="List price ${priceLabel(sku.listPrice)}">override</span>` : ""}</dt>
            <dd class="num">${fixed(r.baseCost, d)}</dd>
          </div>
          <div><dt>+ SP</dt><dd class="num">${fixed(r.wetlockAddPerUnit, d)}</dd></div>
          <div><dt>+ Freight</dt><dd class="num">${fixed(r.freightAddPerUnit, d)}</dd></div>
          <div class="lot__uplift"><dt>Uplift</dt><dd class="num">${percent(uplift)}</dd></div>
        </dl>
      </li>`;
  }).join("");

  return `
    <section class="block" aria-labelledby="lots-title">
      <h3 class="block__title" id="lots-title">Final lot costs <span class="block__hint">Base + SP + Freight</span></h3>
      <ul class="lots">${rows}</ul>
    </section>`;
}

function actionsHTML(shortcut) {
  return `
    <div class="result-actions no-print">
      <button type="button" class="btn btn--primary btn--lg" data-copy-all>
        ${icon("copy")}<span>Copy all for Entree</span><kbd>${shortcut}</kbd>
      </button>
      <button type="button" class="btn btn--secondary btn--lg btn--square" data-print aria-label="Print audit sheet" title="Print audit sheet">
        ${icon("printer")}
      </button>
    </div>`;
}

function summaryHTML(calc, input) {
  const { freight, wetlockQty, wetlockUnitPrice, totalCases } = input;
  const freightSub = freight.mode === "dollars"
    ? `${sourceLabel(freight.source)} · entered`
    : `${sourceLabel(freight.source)} · ${quantity(freight.weight)} lb × ${money(freight.rate)}`;

  const kpi = (label, value, sub, extra = "") => `
    <div class="kpi ${extra}">
      <dt>${label}</dt>
      <dd class="num">${value}</dd>
      <dd class="kpi__sub">${sub}</dd>
    </div>`;

  return `
    <section class="block" aria-labelledby="summary-title">
      <h3 class="block__title" id="summary-title">Shipment summary</h3>
      <dl class="kpis">
        ${kpi("Freight", money(calc.freightCost), freightSub)}
        ${kpi("Wet lock box (SP)", money(calc.wetlockTotal), `${plural(wetlockQty, "case")} × ${money(wetlockUnitPrice)}`)}
        ${kpi("Invoice", money(calc.invoiceTotalNoFreight), "Products + SP")}
        ${kpi("Cost pool", money(calc.pool), "Freight + SP")}
        ${kpi("Per case", `$${fixed(calc.dollarsPerCase, 4)}`, `Pool ÷ ${plural(totalCases, "case")}`)}
        ${kpi("Landed total", money(calc.expectedLandedTotal), "Invoice + freight", "kpi--emphasis")}
      </dl>
    </section>`;
}

function tieOutHTML(calc, tieOk) {
  return `
    <section class="block tieout" data-tone="${tieOk ? "success" : "danger"}" aria-labelledby="tieout-title">
      <h3 class="block__title" id="tieout-title">
        Tie-out
        <span class="tieout__badge">${icon(tieOk ? "check-circle" : "x-circle")}${tieOk ? "Balanced" : "Doesn't tie"}</span>
      </h3>
      <dl class="rows">
        <div><dt>Expected landed total</dt><dd class="num">${money(calc.expectedLandedTotal)}</dd></div>
        <div><dt>Σ qty × lot cost</dt><dd class="num">${money(calc.adjustedTotal)}</dd></div>
        <div class="rows__total"><dt>Difference</dt><dd class="num">${money(calc.tieOutDiff)}</dd></div>
      </dl>
    </section>`;
}

function allocationHTML(calc, input, open) {
  const a = calc.allocation;
  const { totalCases } = input;
  const segments = [
    { key: "4lb", label: "4# tubs", cases: a.cases4 },
    { key: "shell", label: "Shell", cases: a.casesShell },
    { key: "16oz", label: "16oz", cases: a.cases16 },
    { key: "10oz", label: "10oz", cases: a.cases10 },
  ].filter((s) => s.cases > 0);
  const scale = Math.max(totalCases, segments.reduce((sum, s) => sum + s.cases, 0));

  const bar = segments.map((s) =>
    `<span class="alloc-bar__seg" style="--sku: var(--sku-${s.key}); width: ${(s.cases / scale) * 100}%" title="${s.label}: ${quantity(s.cases, 4)} cases"></span>`
  ).join("");
  const legend = segments.map((s) =>
    `<li style="--sku: var(--sku-${s.key})"><span class="sku-dot" aria-hidden="true"></span>${s.label}<span class="num">${quantity(s.cases, 4)}</span></li>`
  ).join("");

  const row = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd class="num">${value}</dd></div>`;

  return `
    <details class="block disclosure" data-alloc ${open ? "open" : ""}>
      <summary>
        <span>Allocation details</span>
        <span class="disclosure__hint">Audit trail</span>
        ${icon("chevron", "icon disclosure__chevron")}
      </summary>
      <div class="disclosure__body">
        <p class="alloc-caption">${quantity(totalCases)} cases shipped. Fixed cases (4# tubs, shell) are allocated first; 16oz takes its share of retail space and 10oz fills the rest.</p>
        <div class="alloc-bar" role="img" aria-label="Case allocation: ${segments.map((s) => `${s.label} ${quantity(s.cases, 2)}`).join(", ")}">${bar}</div>
        <ul class="alloc-legend">${legend}</ul>
        <dl class="rows rows--compact">
          ${row("4# tubs (qty ÷ 12)", quantity(a.cases4, 6))}
          ${row("Shell oysters", quantity(a.casesShell, 6))}
          ${row("Fixed cases", quantity(a.fixedCases, 6), "rows__sub")}
          ${row("Retail cases (total − fixed)", quantity(a.retailCases, 6), "rows__sub")}
          ${row("16oz jars (min of qty ÷ 48, retail)", quantity(a.cases16, 6))}
          ${row("10oz jars (leftover retail)", quantity(a.cases10, 6))}
          ${row("Freight per case", `$${fixed(calc.freightCost / totalCases, 6)}`)}
          ${row("SP per case", `$${fixed(calc.wetlockTotal / totalCases, 6)}`)}
        </dl>
      </div>
    </details>`;
}
