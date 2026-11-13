import { escapeHtml } from "./format.js";

const ICONS = { success: "check-circle", danger: "x-circle", neutral: "info" };

/**
 * Show a transient message in the #toasts live region.
 * @param {string} message
 * @param {{ tone?: "neutral"|"success"|"danger", action?: { label: string, onClick: () => void }, timeout?: number }} [options]
 */
export function toast(message, { tone = "neutral", action, timeout = 3600 } = {}) {
  const region = document.getElementById("toasts");
  if (!region) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.dataset.tone = tone;
  el.innerHTML = `
    <svg class="icon" aria-hidden="true"><use href="#i-${ICONS[tone]}"/></svg>
    <span class="toast__msg">${escapeHtml(message)}</span>
    ${action ? `<button type="button" class="toast__action">${escapeHtml(action.label)}</button>` : ""}`;

  const dismiss = () => {
    el.dataset.leaving = "";
    setTimeout(() => el.remove(), 200);
  };
  if (action) {
    el.querySelector(".toast__action").addEventListener("click", () => {
      action.onClick();
      dismiss();
    });
  }

  // Keep at most three on screen
  while (region.children.length >= 3) region.firstElementChild.remove();
  region.append(el);
  setTimeout(dismiss, action ? timeout * 1.75 : timeout);
}
