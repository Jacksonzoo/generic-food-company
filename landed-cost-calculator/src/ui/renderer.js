/**
 * Render calculation results into the #results DOM element.
 *
 * @param {object} calc   Return value from calculate()
 * @param {number} dec    Decimal places for lot costs
 */
export function renderResults(calc, dec = 7) {
  const el = document.getElementById("results");
  if (!el) return;

  const fmt = (n, d = dec) => n.toFixed(d);
  const fmtMoney = (n) => n.toFixed(2);

  const tieOk = Math.abs(calc.tieOutDiff) < 0.01;
  const tieColor = tieOk ? "color:green" : "color:red;font-weight:bold";

  // Build per-product rows
  const productRows = calc.results.map((r) => {
    const spAdd = fmt(r.wetlockAddPerUnit);
    const frAdd = fmt(r.freightAddPerUnit);
    const final = fmt(r.finalCost);
    return `
      <tr>
        <td>${r.sku}</td>
        <td>${r.qty}</td>
        <td>${fmt(r.baseCost)}</td>
        <td>${spAdd}</td>
        <td>${frAdd}</td>
        <td>
          <span class="formula">${fmt(r.baseCost)} + ${spAdd} + ${frAdd}</span>
          <br>
          <strong class="final-cost">${final}</strong>
          <button class="copy-btn" data-value="${final}" title="Copy lot cost">⎘ Copy</button>
        </td>
      </tr>`;
  }).join("");

  // Entree-ready block
  const entreeLines = calc.results
    .map((r) => `${r.sku}: ${fmt(r.finalCost)}`)
    .join("\n");

  el.innerHTML = `
    <section class="summary-card">
      <h2>Shipment Summary — PO ${calc.po}</h2>
      <table class="summary-table">
        <tr><th>Freight cost</th><td>$${fmtMoney(calc.freightCost)}</td></tr>
        <tr><th>Invoice total (oysters + wetlock)</th><td>$${fmtMoney(calc.invoiceTotalNoFreight)}</td></tr>
        <tr><th>Wetlock / SP total</th><td>$${fmtMoney(calc.wetlockTotal)}</td></tr>
        <tr><th>Grand total (oysters + wetlock + freight)</th><td>$${fmtMoney(calc.expectedLandedTotal)}</td></tr>
        <tr><th>Pool (freight + wetlock)</th><td>$${fmtMoney(calc.pool)}</td></tr>
        <tr><th>$ / case</th><td>$${fmt(calc.dollarsPerCase)}</td></tr>
      </table>
    </section>

    <section class="results-card">
      <h2>Per-Product Lot Costs</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>SKU</th><th>Qty</th><th>Base cost</th>
            <th>SP add/unit</th><th>Freight add/unit</th>
            <th>Final lot cost (A + B + C)</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>
    </section>

    <section class="tieout-card">
      <h2>Tie-Out</h2>
      <table class="summary-table">
        <tr><th>Expected landed total</th><td>$${fmtMoney(calc.expectedLandedTotal)}</td></tr>
        <tr><th>Adjusted total</th><td>$${fmtMoney(calc.adjustedTotal)}</td></tr>
        <tr><th>Difference</th><td style="${tieColor}">$${fmtMoney(calc.tieOutDiff)} ${tieOk ? "✓" : "⚠ CHECK"}</td></tr>
      </table>
    </section>

    <section class="details-card">
      <details>
        <summary>Show allocation details</summary>
        <table class="summary-table">
          <tr><th>cases4</th><td>${calc.allocation.cases4}</td></tr>
          <tr><th>casesShell</th><td>${calc.allocation.casesShell}</td></tr>
          <tr><th>fixedCases</th><td>${calc.allocation.fixedCases}</td></tr>
          <tr><th>retailCases</th><td>${calc.allocation.retailCases}</td></tr>
          <tr><th>cases16</th><td>${calc.allocation.cases16}</td></tr>
          <tr><th>cases10</th><td>${calc.allocation.cases10}</td></tr>
          <tr><th>Freight $/case</th><td>${fmt(calc.freightCost / (calc.allocation.fixedCases + calc.allocation.retailCases))}</td></tr>
          <tr><th>Wetlock $/case</th><td>${fmt(calc.wetlockTotal / (calc.allocation.fixedCases + calc.allocation.retailCases))}</td></tr>
        </table>
      </details>
    </section>

    <section class="entree-card">
      <h2>Copy for Entree</h2>
      <pre id="entree-block">${entreeLines}</pre>
      <button id="copy-entree-btn">⎘ Copy all for Entree</button>
    </section>
  `;

  // Individual copy buttons
  el.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.value);
      btn.textContent = "✓ Copied";
      setTimeout(() => (btn.textContent = "⎘ Copy"), 1500);
    });
  });

  // Copy-all Entree block
  document.getElementById("copy-entree-btn")?.addEventListener("click", () => {
    navigator.clipboard.writeText(entreeLines);
    const b = document.getElementById("copy-entree-btn");
    b.textContent = "✓ Copied!";
    setTimeout(() => (b.textContent = "⎘ Copy all for Entree"), 1500);
  });
}

export function renderErrors(errors) {
  const el = document.getElementById("results");
  if (!el) return;
  const warnings = errors.filter((e) => e.startsWith("WARN:"));
  const hard = errors.filter((e) => !e.startsWith("WARN:"));
  let html = "";
  if (hard.length) {
    html += `<div class="error-box"><strong>Please fix:</strong><ul>${hard.map((e) => `<li>${e}</li>`).join("")}</ul></div>`;
  }
  if (warnings.length) {
    html += `<div class="warn-box"><ul>${warnings.map((e) => `<li>${e}</li>`).join("")}</ul></div>`;
  }
  el.innerHTML = html;
}
