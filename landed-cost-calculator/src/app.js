import { calculate } from "./core/calculator.js";
import { validateInput } from "./core/validators.js";
import { buildNotices } from "./core/notices.js";
import { EXAMPLES, matchesExpected } from "./core/examples.js";
import { SKUS, TIE_OUT_TOLERANCE } from "./core/constants.js";
import { isOverride, priceLabel } from "./core/pricing.js";
import {
  FIELD_IDS, readValues, writeValues, buildInput, valuesFromInput, emptyValues, formatMoneyInput, isAtListPrice,
} from "./ui/form.js";
import { renderEmpty, renderResults, renderFormFigures } from "./ui/renderer.js";
import { loadSettings, saveSettings, loadTheme, saveTheme } from "./ui/settings.js";
import { money, entreeText } from "./ui/format.js";
import { copyText } from "./ui/clipboard.js";
import { toast } from "./ui/toast.js";

const $ = (id) => document.getElementById(id);

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = IS_MAC ? "⌘⇧E" : "Ctrl+Shift+E";

// Fields grouped the way the empty-state checklist presents them
const GROUPS = [
  { label: "Freight", keys: ["weight", "rate", "dollars"] },
  { label: "Wet lock box & cases shipped", keys: ["wetlockQty", "wetlockUnitPrice", "totalCases"] },
  { label: "Products & base costs", keys: ["items", ...SKUS.flatMap((s) => [s.qtyKey, s.costKey])] },
];
const PRODUCT_KEYS = new Set(GROUPS[2].keys);

const state = {
  settings: loadSettings(),
  edited: new Set(),    // field keys the user has typed in
  touched: new Set(),   // field keys whose errors may show (edited, then left)
  showAll: false,       // set by Calculate: reveal every error, not just touched ones
  linked: true,         // total cases mirrors wetlock qty
  unlocked: new Set(),  // SKU keys whose base cost is overridden for this PO
  allocOpen: false,
  result: null,         // { calc, input } when the form is calculable
};

// ─── Core update loop ────────────────────────────────────────────────────────

function update() {
  const values = readValues();
  if (state.linked) {
    $("total-cases").value = values.wetlockQty;
    values.totalCases = values.wetlockQty;
  }
  for (const sku of SKUS) {
    if (state.unlocked.has(sku.key)) continue;
    values[sku.costKey] = formatMoneyInput(sku.listPrice);
    $(FIELD_IDS[sku.costKey]).value = values[sku.costKey];
  }

  const input = buildInput(values);
  const { errors, warnings } = validateInput(input);

  // Unlocked prices that differ from the list get an amber "changed" note, styled like a warning
  const notes = { ...warnings };
  for (const sku of SKUS) {
    const cost = input.items[sku.costKey];
    if (state.unlocked.has(sku.key) && cost > 0 && isOverride(sku, cost)) {
      notes[sku.costKey] = `Changed from list price ${priceLabel(sku.listPrice)}`;
    }
  }

  showFieldMessages(errors, notes);
  renderFormFigures(input, errors);
  $("results-po").textContent = input.po ? `PO ${input.po}` : "No PO entered";

  const results = $("results");
  if (Object.keys(errors).length) {
    state.result = null;
    renderEmpty(results, GROUPS.map((g) => {
      const firstBad = g.keys.find((k) => errors[k]);
      return {
        label: g.label,
        done: !firstBad,
        focusId: FIELD_IDS[firstBad] ?? FIELD_IDS[g.keys.find((k) => FIELD_IDS[k])] ?? FIELD_IDS.qty16,
      };
    }));
    setStatus("neutral", "Incomplete");
    return;
  }

  const calc = calculate(input);
  const tieOk = Math.abs(calc.tieOutDiff) < TIE_OUT_TOLERANCE;
  state.result = { calc, input };
  renderResults(results, {
    calc,
    input,
    notices: buildNotices(input, calc),
    decimals: state.settings.decimals,
    tieOk,
    allocOpen: state.allocOpen,
    shortcut: SHORTCUT_LABEL,
  });
  setStatus(tieOk ? "success" : "danger", tieOk ? "Balanced" : `Off by ${money(Math.abs(calc.tieOutDiff))}`);
}

function showFieldMessages(errors, warnings) {
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    const inputEl = $(id);
    const msgEl = $(`${id}-msg`);
    if (!msgEl) continue;
    const visible = state.showAll || state.touched.has(key);
    const error = visible ? errors[key] : undefined;
    const warning = !error ? warnings[key] : undefined;

    inputEl.setAttribute("aria-invalid", error ? "true" : "false");
    inputEl.closest(".field").dataset.state = error ? "error" : warning ? "warning" : "";
    msgEl.textContent = error ?? warning ?? "";
  }

  const productsTouched = [...state.touched].some((k) => PRODUCT_KEYS.has(k));
  $("items-msg").textContent = (state.showAll || productsTouched) && errors.items ? errors.items : "";
}

function setStatus(tone, label) {
  for (const pill of document.querySelectorAll("[data-status-pill]")) {
    pill.dataset.tone = tone;
    pill.textContent = label;
  }
  $("mobile-bar").hidden = !state.result;
}

// ─── Form behaviour ──────────────────────────────────────────────────────────

const KEY_BY_ID = Object.fromEntries(Object.entries(FIELD_IDS).map(([k, id]) => [id, k]));

function wireForm() {
  const form = $("calc-form");

  form.addEventListener("input", (e) => {
    const key = KEY_BY_ID[e.target.id];
    if (key) state.edited.add(key);
    update();
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "freight-mode") syncFreightMode();
    update();
  });
  // Errors appear once a field has been edited and left, so tabbing through an empty form stays quiet
  form.addEventListener("focusout", (e) => {
    const key = KEY_BY_ID[e.target.id];
    if (e.target.hasAttribute("data-money")) e.target.value = formatMoneyInput(e.target.value);
    if (key && state.edited.has(key)) {
      state.touched.add(key);
      update();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.showAll = true;
    update();
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    if (!state.result) {
      $(FIELD_IDS.qty16).focus();
      return;
    }
    if (window.matchMedia("(max-width: 1023px)").matches) {
      $("results-panel").scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "start" });
    }
    toast(`Lot costs ready${state.result.input.po ? ` for PO ${state.result.input.po}` : ""}.`, { tone: "success" });
  });

  $("link-btn").addEventListener("click", () => {
    state.linked = !state.linked;
    syncLinked();
    if (!state.linked) $("total-cases").focus();
    update();
  });

  let lockHintShown = 0;
  form.addEventListener("click", (e) => {
    const lockBtn = e.target.closest("[data-lock]");
    if (lockBtn) {
      toggleLock(SKUS.find((s) => s.key === lockBtn.dataset.lock));
      return;
    }
    // Clicking a locked price explains how to change it (at most every few seconds)
    if (e.target.matches(".input[readonly][data-money]") && Date.now() - lockHintShown > 4000) {
      lockHintShown = Date.now();
      toast("This price is locked to the company list. Click the lock to override it for this PO.");
    }
  });
}

function toggleLock(sku) {
  const input = $(FIELD_IDS[sku.costKey]);
  if (state.unlocked.has(sku.key)) {
    const changed = isOverride(sku, parseFloat(input.value));
    state.unlocked.delete(sku.key);
    syncLocks();
    update();
    if (changed) toast(`${sku.label} is back to the list price of ${priceLabel(sku.listPrice)}.`);
  } else {
    state.unlocked.add(sku.key);
    syncLocks();
    update();
    input.focus();
    input.select();
  }
}

function syncLocks() {
  for (const sku of SKUS) {
    const locked = !state.unlocked.has(sku.key);
    const input = $(FIELD_IDS[sku.costKey]);
    const btn = document.querySelector(`[data-lock="${sku.key}"]`);
    input.readOnly = locked;
    input.tabIndex = locked ? -1 : 0; // keep Tab moving between quantities while prices are locked
    btn.setAttribute("aria-pressed", String(locked));
    btn.setAttribute("aria-label", locked
      ? `Unlock ${sku.label} base cost to override it for this PO`
      : `Lock ${sku.label} back to the list price of ${priceLabel(sku.listPrice)}`);
    btn.title = locked
      ? "Locked to list price. Click to override for this PO."
      : `Click to restore the list price (${priceLabel(sku.listPrice)}).`;
    btn.querySelector("use").setAttribute("href", locked ? "#i-lock" : "#i-unlock");
  }
}

function syncFreightMode() {
  const dollars = document.querySelector('input[name="freight-mode"]:checked').value === "dollars";
  $("weight-inputs").hidden = dollars;
  $("dollar-inputs").hidden = !dollars;
}

function syncLinked() {
  const btn = $("link-btn");
  const total = $("total-cases");
  btn.setAttribute("aria-pressed", String(state.linked));
  btn.setAttribute("aria-label", state.linked ? "Unlink from wetlock qty to edit" : "Link to wetlock qty");
  btn.title = btn.getAttribute("aria-label");
  btn.querySelector("use").setAttribute("href", state.linked ? "#i-link" : "#i-unlink");
  total.readOnly = state.linked;
  $("total-cases-hint").textContent = state.linked ? "Matches wetlock qty" : "Entered manually";
}

function loadValues(values, { linked }) {
  writeValues(values);
  state.linked = linked;
  // Anything not at the list price was deliberately overridden, so it stays unlocked
  state.unlocked = new Set(SKUS.filter((s) => !isAtListPrice(s, values[s.costKey])).map((s) => s.key));
  syncLocks();
  state.edited.clear();
  state.touched.clear();
  state.showAll = false;
  syncFreightMode();
  syncLinked();
  update();
}

// ─── Results actions (delegated; results re-render on every keystroke) ───────

function wireResultActions() {
  document.addEventListener("click", async (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      const ok = await copyText(copyBtn.dataset.copy);
      flashCopied(copyBtn);
      toast(ok ? `Copied ${copyBtn.dataset.copyLabel} · ${copyBtn.dataset.copy}` : "Couldn't copy. Select the value and copy it manually.",
        { tone: ok ? "success" : "danger" });
      return;
    }
    if (e.target.closest("[data-copy-all]")) return copyAll();
    if (e.target.closest("[data-print]")) return window.print();

    const focusBtn = e.target.closest("[data-focus]");
    if (focusBtn) {
      const target = $(focusBtn.dataset.focus);
      target.scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "center" });
      target.focus({ preventScroll: true });
    }
  });

  // `toggle` doesn't bubble, so listen in the capture phase to remember the disclosure state
  $("results").addEventListener("toggle", (e) => {
    if (e.target.matches("[data-alloc]")) state.allocOpen = e.target.open;
  }, true);

  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("[data-alloc]").forEach((d) => (d.open = true));
  });
}

async function copyAll() {
  if (!state.result) {
    toast("Finish the form first. There's nothing to copy yet.");
    return;
  }
  const text = entreeText(state.result.calc, state.settings.decimals);
  const ok = await copyText(text);
  document.querySelectorAll("[data-copy-all]").forEach(flashCopied);
  const count = state.result.calc.results.length;
  toast(ok ? `Copied ${count} lot cost${count === 1 ? "" : "s"} for Entree.` : "Couldn't copy to the clipboard.",
    { tone: ok ? "success" : "danger" });
}

function flashCopied(btn) {
  const use = btn.querySelector("use");
  if (!use) return;
  use.setAttribute("href", "#i-check");
  btn.dataset.copied = "";
  setTimeout(() => {
    use.setAttribute("href", "#i-copy");
    delete btn.dataset.copied;
  }, 1400);
}

// ─── App bar: examples menu, reset, theme, settings ──────────────────────────

function wireExamplesMenu() {
  const btn = $("examples-btn");
  const menu = $("examples-menu");

  menu.innerHTML = `
    <p class="menu__label">Confirmed POs</p>
    ${EXAMPLES.map((ex) => `
      <button type="button" class="menu__item" role="menuitem" data-example="${ex.id}">
        <span class="menu__item-title">${ex.label}</span>
        <span class="menu__item-note">${ex.note}</span>
      </button>`).join("")}`;
  const items = () => [...menu.querySelectorAll(".menu__item")];

  const open = () => {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    items()[0].focus();
  };
  const close = (refocus = true) => {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  };

  btn.addEventListener("click", () => (menu.hidden ? open() : close()));
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !e.target.closest(".menu")) close(false);
  });
  menu.addEventListener("keydown", (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    if (e.key === "Escape") close();
    if (e.key === "Tab") close(false);
  });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-example]");
    if (!item) return;
    close();
    loadExample(EXAMPLES.find((ex) => ex.id === item.dataset.example));
  });
}

function loadExample(example) {
  loadValues(valuesFromInput(example.input), { linked: example.input.totalCases === example.input.wetlockQty });
  const ok = state.result && matchesExpected(state.result.calc, example.expected);
  toast(ok
    ? `${example.label} loaded and matches the confirmed lot costs.`
    : `${example.label} loaded, but the results differ from the confirmed lot costs.`,
    { tone: ok ? "success" : "danger" });
}

function wireReset() {
  $("reset-btn").addEventListener("click", () => {
    const snapshot = readValues();
    const wasLinked = state.linked;
    loadValues(emptyValues(state.settings), { linked: true });
    $(FIELD_IDS.po).focus();
    toast("Form cleared.", {
      action: { label: "Undo", onClick: () => loadValues(snapshot, { linked: wasLinked }) },
    });
  });
}

function effectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  saveTheme(theme);
  syncThemeButton();
}

function syncThemeButton() {
  const dark = effectiveTheme() === "dark";
  const btn = $("theme-btn");
  btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  btn.title = btn.getAttribute("aria-label");
  btn.querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
}

function wireTheme() {
  syncThemeButton();
  $("theme-btn").addEventListener("click", () => applyTheme(effectiveTheme() === "dark" ? "light" : "dark"));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeButton);
}

function wireSettings() {
  const dialog = $("settings-dialog");
  const form = $("settings-form");
  const rateEl = $("s-rate");
  const priceEl = $("s-wetlock");
  const errorEl = $("settings-msg");

  $("settings-btn").addEventListener("click", () => {
    rateEl.value = state.settings.freightRate;
    priceEl.value = state.settings.wetlockUnitPrice;
    form.querySelector(`input[name="s-decimals"][value="${state.settings.decimals}"]`).checked = true;
    form.querySelector(`input[name="s-theme"][value="${loadTheme()}"]`).checked = true;
    errorEl.textContent = "";
    dialog.showModal();
  });

  form.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    const freightRate = parseFloat(rateEl.value);
    const wetlockUnitPrice = parseFloat(priceEl.value);
    if (!(freightRate > 0) || !(wetlockUnitPrice >= 0)) {
      e.preventDefault();
      errorEl.textContent = "Enter a freight rate above $0 and a wetlock price of $0 or more.";
      return;
    }

    const previous = state.settings;
    const next = {
      freightRate,
      wetlockUnitPrice,
      decimals: parseInt(form.querySelector('input[name="s-decimals"]:checked').value, 10),
    };
    saveSettings(next);
    state.settings = next;
    applyTheme(form.querySelector('input[name="s-theme"]:checked').value);

    // Carry new defaults into the form only where the user hasn't typed their own value
    const rateField = $(FIELD_IDS.rate);
    const priceField = $(FIELD_IDS.wetlockUnitPrice);
    if (!rateField.value || parseFloat(rateField.value) === previous.freightRate) rateField.value = next.freightRate;
    if (!priceField.value || parseFloat(priceField.value) === previous.wetlockUnitPrice) priceField.value = next.wetlockUnitPrice;

    update();
    toast("Defaults saved in this browser.", { tone: "success" });
  });
}

function wireShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      copyAll();
    }
  });
}

function prefersMotion() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Boot ────────────────────────────────────────────────────────────────────

function init() {
  writeValues(emptyValues(state.settings));
  wireForm();
  wireResultActions();
  wireExamplesMenu();
  wireReset();
  wireTheme();
  wireSettings();
  wireShortcuts();
  syncFreightMode();
  syncLinked();
  syncLocks();
  update();
}

init();
