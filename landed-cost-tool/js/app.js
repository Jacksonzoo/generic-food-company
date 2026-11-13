import { computeLandedCost, driverMix } from './calc.js';

const state = {
  poNumber: '',
  vendorName: '',
  invoiceTotal: '',
  lineItems: [],
  supplementals: [],
};

let lineItemSeq = 1;
let supplementalSeq = 1;

const el = {
  poNumber: document.getElementById('po-number'),
  vendorName: document.getElementById('vendor-name'),
  invoiceTotal: document.getElementById('invoice-total'),
  addLineItem: document.getElementById('add-line-item'),
  lineItemsBody: document.getElementById('line-items-body'),
  lineItemsEmpty: document.getElementById('line-items-empty'),
  addSupplemental: document.getElementById('add-supplemental'),
  supplementalsList: document.getElementById('supplementals-list'),
  supplementalsEmpty: document.getElementById('supplementals-empty'),
  tieOutPanel: document.getElementById('tie-out-panel'),
};

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
function fmtCurrency(n) { return currencyFmt.format(Number.isFinite(n) ? n : 0); }
function fmt4(n) { return (Number.isFinite(n) ? n : 0).toFixed(4); }

function newLineItem() {
  const prevDriver = state.lineItems.length
    ? state.lineItems[state.lineItems.length - 1].driver
    : 'cases';
  return {
    id: `li-${lineItemSeq++}`,
    description: '',
    cases: '',
    weight: '',
    unitCost: '',
    driver: prevDriver,
  };
}

function newSupplemental() {
  return {
    id: `sup-${supplementalSeq++}`,
    name: `Supplemental ${supplementalSeq - 1}`,
    totals: { cases: '', weight: '' },
    excluded: new Set(),
  };
}

function compute() {
  return computeLandedCost({
    lineItems: state.lineItems,
    supplementals: state.supplementals,
    invoiceTotal: state.invoiceTotal,
  });
}

// ---- Actions (structural — trigger a full re-render of affected sections) ----

function addLineItem() {
  state.lineItems.push(newLineItem());
  renderLineItems();
  renderSupplementals();
  renderTieOut();
}

function removeLineItem(id) {
  state.lineItems = state.lineItems.filter((li) => li.id !== id);
  state.supplementals.forEach((sup) => sup.excluded.delete(id));
  renderLineItems();
  renderSupplementals();
  renderTieOut();
}

function setDriver(id, driver) {
  const item = state.lineItems.find((li) => li.id === id);
  if (!item || item.driver === driver) return;
  item.driver = driver;
  renderLineItems();
  renderSupplementals();
  renderTieOut();
}

function addSupplemental() {
  state.supplementals.push(newSupplemental());
  renderSupplementals();
  renderTieOut();
}

function removeSupplemental(id) {
  state.supplementals = state.supplementals.filter((s) => s.id !== id);
  renderSupplementals();
  renderTieOut();
}

// ---- Lightweight recompute (typing) — updates derived text only, never
// touches input elements, so focus/cursor position is preserved. ----

function recomputeOnly() {
  const result = compute();

  state.lineItems.forEach((li) => {
    const row = el.lineItemsBody.querySelector(`tr[data-id="${li.id}"]`);
    if (!row) return;
    row.querySelector('.line-total').textContent = fmtCurrency(result.baseTotals[li.id]);
    row.querySelector('.final-cost').textContent = fmt4(result.finalLotCost[li.id]);
  });

  state.supplementals.forEach((sup) => {
    const card = el.supplementalsList.querySelector(`[data-sup-id="${sup.id}"]`);
    if (!card) return;
    state.lineItems.forEach((li) => {
      const shareEl = card.querySelector(`.supp-share[data-item-id="${li.id}"]`);
      if (!shareEl) return;
      const excluded = sup.excluded.has(li.id);
      shareEl.textContent = excluded ? '$0.00' : fmtCurrency(result.supplementalShares[sup.id][li.id] || 0);
      shareEl.closest('tr').classList.toggle('excluded', excluded);
    });
  });

  renderTieOut(result);
}

// ---- Full renders (structure changes) ----

function renderLineItems() {
  el.lineItemsEmpty.style.display = state.lineItems.length ? 'none' : '';
  el.lineItemsBody.innerHTML = '';

  state.lineItems.forEach((li) => {
    const tr = document.createElement('tr');
    tr.dataset.id = li.id;

    tr.innerHTML = `
      <td><input type="text" class="f-description" placeholder="Product description" value="${escapeAttr(li.description)}"></td>
      <td><input type="number" class="f-cases" min="0" step="1" placeholder="0" value="${escapeAttr(li.cases)}"></td>
      <td><input type="number" class="f-weight" min="0" step="0.01" placeholder="0" value="${escapeAttr(li.weight)}"></td>
      <td><input type="number" class="f-unit-cost" min="0" step="0.01" placeholder="0.00" value="${escapeAttr(li.unitCost)}"></td>
      <td>
        <div class="seg" role="group" aria-label="Driver">
          <button type="button" class="seg-btn cases-btn ${li.driver === 'cases' ? 'active' : ''}">Cases</button>
          <button type="button" class="seg-btn weight-btn ${li.driver === 'weight' ? 'active' : ''}">Weight</button>
        </div>
      </td>
      <td class="line-total num">${fmtCurrency(0)}</td>
      <td class="final-cost num">${fmt4(0)}</td>
      <td><button type="button" class="btn btn-icon remove-row" title="Remove line">&times;</button></td>
    `;

    tr.querySelector('.f-description').addEventListener('input', (e) => {
      li.description = e.target.value;
    });
    tr.querySelector('.f-cases').addEventListener('input', (e) => {
      li.cases = e.target.value;
      recomputeOnly();
    });
    tr.querySelector('.f-weight').addEventListener('input', (e) => {
      li.weight = e.target.value;
      recomputeOnly();
    });
    tr.querySelector('.f-unit-cost').addEventListener('input', (e) => {
      li.unitCost = e.target.value;
      recomputeOnly();
    });
    tr.querySelector('.cases-btn').addEventListener('click', () => setDriver(li.id, 'cases'));
    tr.querySelector('.weight-btn').addEventListener('click', () => setDriver(li.id, 'weight'));
    tr.querySelector('.remove-row').addEventListener('click', () => removeLineItem(li.id));

    el.lineItemsBody.appendChild(tr);
  });

  recomputeOnly();
}

function renderSupplementals() {
  el.supplementalsEmpty.style.display = state.supplementals.length ? 'none' : '';
  el.supplementalsList.innerHTML = '';

  const mix = driverMix(state.lineItems);
  const activeDrivers = ['cases', 'weight'].filter((d) => mix[d]);

  state.supplementals.forEach((sup) => {
    const card = document.createElement('div');
    card.className = 'supplemental-card';
    card.dataset.supId = sup.id;

    let totalsHtml = '';
    if (activeDrivers.length === 0) {
      totalsHtml = '<p class="hint">Add line items first to allocate this supplemental.</p>';
    } else if (activeDrivers.length === 2) {
      totalsHtml = `
        <p class="hint">Mixed drivers detected — enter a separate total for each group.</p>
        <div class="field-row">
          <label>Cases-items Total ($)
            <input type="number" class="f-total-cases" min="0" step="0.01" placeholder="0.00" value="${escapeAttr(sup.totals.cases)}">
          </label>
          <label>Weight-items Total ($)
            <input type="number" class="f-total-weight" min="0" step="0.01" placeholder="0.00" value="${escapeAttr(sup.totals.weight)}">
          </label>
        </div>
      `;
    } else {
      const d = activeDrivers[0];
      totalsHtml = `
        <div class="field-row">
          <label>Total ($)
            <input type="number" class="f-total-${d}" min="0" step="0.01" placeholder="0.00" value="${escapeAttr(sup.totals[d])}">
          </label>
        </div>
      `;
    }

    const rowsHtml = state.lineItems.map((li) => {
      const excluded = sup.excluded.has(li.id);
      const desc = li.description || '(untitled item)';
      return `
        <tr class="${excluded ? 'excluded' : ''}">
          <td>${escapeHtml(desc)}</td>
          <td><span class="badge">${li.driver === 'cases' ? 'Cases' : 'Weight'}</span></td>
          <td class="center"><input type="checkbox" class="f-include" data-item-id="${li.id}" ${excluded ? '' : 'checked'}></td>
          <td class="supp-share num" data-item-id="${li.id}">${excluded ? '$0.00' : fmtCurrency(0)}</td>
        </tr>
      `;
    }).join('');

    card.innerHTML = `
      <div class="card-header">
        <input type="text" class="supplemental-name" value="${escapeAttr(sup.name)}">
        <button type="button" class="btn btn-icon remove-supplemental" title="Remove supplemental">&times;</button>
      </div>
      ${totalsHtml}
      ${state.lineItems.length ? `
        <table class="supplemental-table">
          <thead><tr><th>Item</th><th>Driver</th><th>Include</th><th>Allocated</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      ` : ''}
    `;

    card.querySelector('.supplemental-name').addEventListener('input', (e) => {
      sup.name = e.target.value;
    });
    card.querySelector('.remove-supplemental').addEventListener('click', () => removeSupplemental(sup.id));

    const casesInput = card.querySelector('.f-total-cases');
    if (casesInput) {
      casesInput.addEventListener('input', (e) => {
        sup.totals.cases = e.target.value;
        recomputeOnly();
      });
    }
    const weightInput = card.querySelector('.f-total-weight');
    if (weightInput) {
      weightInput.addEventListener('input', (e) => {
        sup.totals.weight = e.target.value;
        recomputeOnly();
      });
    }

    card.querySelectorAll('.f-include').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const itemId = e.target.dataset.itemId;
        if (e.target.checked) {
          sup.excluded.delete(itemId);
        } else {
          sup.excluded.add(itemId);
        }
        recomputeOnly();
      });
    });

    el.supplementalsList.appendChild(card);
  });

  recomputeOnly();
}

function renderTieOut(precomputed) {
  const result = precomputed || compute();

  const supRows = state.supplementals.map((sup) => `
    <div class="tie-row">
      <span>${escapeHtml(sup.name)}</span>
      <span class="num">${fmtCurrency(result.supplementalTotalsSum[sup.id] || 0)}</span>
    </div>
  `).join('');

  let invoiceHtml = '';
  if (result.hasInvoiceTotal) {
    const gapNote = Math.abs(result.invoiceGap) < 0.005
      ? 'No gap — invoice matches the build-up exactly.'
      : `Gap of ${fmtCurrency(result.invoiceGap)} absorbed into final lot cost (pay-as-invoiced), spread pro-rata by each item's landed value.`;
    invoiceHtml = `
      <div class="tie-row">
        <span>Invoice Total to Pay</span>
        <span class="num">${fmtCurrency(result.reconciliationTarget)}</span>
      </div>
      <div class="tie-row">
        <span>Gap vs. Expected Landed Total</span>
        <span class="num">${fmtCurrency(result.invoiceGap)}</span>
      </div>
      <p class="hint">${gapNote}</p>
    `;
  }

  const bannerClass = result.tieOutOk ? 'banner-ok' : 'banner-fail';
  const bannerText = result.tieOutOk
    ? `Tie-out passes (diff ${fmtCurrency(result.tieOutDiff)})`
    : `TIE-OUT FAILS — diff ${fmtCurrency(result.tieOutDiff)}. Do not use these numbers.`;

  el.tieOutPanel.innerHTML = `
    <div class="tie-row">
      <span>Base Line Totals</span>
      <span class="num">${fmtCurrency(result.baseTotalSum)}</span>
    </div>
    ${supRows}
    <div class="tie-row tie-row-strong">
      <span>Expected Landed Total</span>
      <span class="num">${fmtCurrency(result.expectedLandedTotal)}</span>
    </div>
    ${invoiceHtml}
    <div class="tie-row">
      <span>Reconstructed Total (Σ qty × final lot cost)</span>
      <span class="num">${fmtCurrency(result.checkTotal)}</span>
    </div>
    <div class="banner ${bannerClass}">${bannerText}</div>
  `;
}

function escapeAttr(v) {
  return String(v ?? '').replace(/"/g, '&quot;');
}
function escapeHtml(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}

// ---- Header wiring ----

el.poNumber.addEventListener('input', (e) => { state.poNumber = e.target.value; });
el.vendorName.addEventListener('input', (e) => { state.vendorName = e.target.value; });
el.invoiceTotal.addEventListener('input', (e) => {
  state.invoiceTotal = e.target.value;
  recomputeOnly();
});

el.addLineItem.addEventListener('click', addLineItem);
el.addSupplemental.addEventListener('click', addSupplemental);

// ---- Initial state: one blank line item so the table isn't empty on load ----
addLineItem();
