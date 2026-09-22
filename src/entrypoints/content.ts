import type { ChoiceRow, NoulRow, ScoreRow, Verdict } from "../lib/verdict";

type Row = ChoiceRow | ScoreRow | NoulRow;

const SEND_NAME = /^(send|post|reply|comment|publish)$/i;
const MAX_CHARS = 8000;

const CSS = `
  :host { all: initial; }
  .badge, .card, .sheet {
    position: fixed;
    pointer-events: auto;
    box-sizing: border-box;
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1c1915;
  }
  .badge {
    display: none;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px 0 10px;
    border: 1px solid #e0d8cc;
    border-radius: 999px;
    background: #fbf9f5;
    box-shadow: 0 4px 16px rgba(28, 25, 21, 0.08);
    cursor: pointer;
  }
  .badge.on { display: inline-flex; }
  .kicker {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a8176;
  }
  .word { font-size: 13px; font-weight: 600; }
  .check { width: 14px; height: 14px; color: #b8502a; }
  .card, .sheet {
    display: none;
    width: 280px;
    padding: 12px 14px 10px;
    background: #fbf9f5;
    border: 1px solid #e6dfd4;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(28, 25, 21, 0.14);
  }
  .card.on, .sheet.on { display: block; }
  h2 { margin: 0; font-size: 13px; font-weight: 650; }
  .hint, .note { margin: 3px 0 4px; color: #746c63; font-size: 12px; }
  .row { padding: 8px 0 6px; border-top: 1px solid #e4dbd0; }
  .top { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: baseline; font-size: 13px; }
  .label, .prob { color: #746c63; }
  .prob { font-variant-numeric: tabular-nums; font-size: 12px; }
  .fail { color: #b8502a; font-weight: 600; }
  .meter { height: 3px; margin-top: 6px; background: #efe8de; border-radius: 99px; overflow: hidden; }
  .meter > span { display: block; height: 100%; background: #1c1915; }
  .row.bad .meter > span { background: #b8502a; }
  .scale { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 8px; }
  .scale span { text-align: center; font-size: 11px; color: #746c63; }
  .scale span::before {
    content: "";
    display: block;
    width: 7px;
    height: 7px;
    margin: 0 auto 4px;
    border-radius: 50%;
    border: 1.5px solid #c4bbb0;
    background: #fbf9f5;
  }
  .scale .on { color: #1c1915; }
  .scale .on::before { background: #1c1915; border-color: #1c1915; }
  .row.bad .scale .on::before { background: #b8502a; border-color: #b8502a; }
  .anyway, .back {
    font: inherit;
    cursor: pointer;
  }
  .anyway {
    width: 100%;
    margin-top: 10px;
    border: 0;
    border-radius: 999px;
    background: #1c1915;
    color: #fbf9f5;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 650;
  }
  .back {
    width: 100%;
    margin-top: 4px;
    border: 0;
    background: transparent;
    padding: 8px;
    color: #1c1915;
  }
`;

function isSendControl(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  const button = el.closest("button, input[type='submit'], [role='button']");
  return button instanceof HTMLElement && SEND_NAME.test(controlName(button));
}

function isDraft(el: EventTarget | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return !el.disabled;
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.type === "hidden" || el.type === "password") return false;
    return el.type === "text" || el.type === "search" || el.type === "email" || el.type === "url";
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function readDraft(el: HTMLElement): string {
  const raw = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
    ? el.value
    : el.textContent ?? "";
  return raw.trim().slice(0, MAX_CHARS);
}

function isVerdict(value: unknown): value is Verdict {
  if (typeof value !== "object" || value === null || !("status" in value)) return false;
  if (value.status === "missing-key" || value.status === "error") return true;
  if (value.status !== "ready" || !("rows" in value) || !("clear" in value) || !("badge" in value)) {
    return false;
  }
  return Array.isArray(value.rows) && value.rows.length === 3 && typeof value.clear === "boolean";
}

function controlName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();
  if (el instanceof HTMLInputElement) return el.value.trim();
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "jevly-overlay",
      position: "inline",
      anchor: "body",
      css: CSS,
      isolateEvents: false,
      onMount(container, _shadow, host) {
        host.style.position = "fixed";
        host.style.top = "0";
        host.style.left = "0";
        host.style.width = "0";
        host.style.height = "0";
        host.style.overflow = "visible";
        host.style.zIndex = "2147483646";
        host.style.pointerEvents = "none";
        bind(container, host);
      },
    });
    ui.mount();
  },
});

function bind(container: HTMLElement, host: HTMLElement) {
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "badge";
  const kicker = document.createElement("span");
  kicker.className = "kicker";
  kicker.textContent = "jev";
  const mark = document.createElement("span");
  mark.className = "word";
  badge.append(kicker, mark);

  const card = document.createElement("div");
  card.className = "card";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Send check");
  container.append(badge, card, sheet);

  let field: HTMLElement | null = null;
  let text = "";
  let verdict: Verdict | null = null;
  let generation = 0;
  let timer = 0;
  let armed: string | null = null;
  let control: HTMLElement | null = null;
  let cardOpen = false;
  let sheetOpen = false;

  function hide() {
    badge.classList.remove("on");
    card.classList.remove("on");
    sheet.classList.remove("on");
    cardOpen = false;
    sheetOpen = false;
  }

  function paintBadge() {
    mark.replaceChildren();
    if (!verdict) {
      mark.textContent = "…";
      return;
    }
    if (verdict.status === "missing-key") {
      mark.textContent = "key";
      return;
    }
    if (verdict.status === "error") {
      mark.textContent = "offline";
      return;
    }
    if (verdict.clear) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      svg.setAttribute("class", "check");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M3.2 8.4 6.4 11.6 12.8 4.4");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.7");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
      mark.append(svg);
    }
    const word = document.createElement("span");
    word.textContent = verdict.badge;
    mark.append(word);
  }

  function rowNode(row: Row) {
    const wrap = document.createElement("div");
    wrap.className = row.fail ? "row bad" : "row";
    const top = document.createElement("div");
    top.className = "top";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = row.label;
    const value = document.createElement("span");
    value.className = row.fail ? "fail" : "value";
    value.textContent = row.value;
    const prob = document.createElement("span");
    prob.className = "prob";
    prob.textContent = row.p.toFixed(2);
    top.append(label, value, prob);
    wrap.append(top);
    if (row.kind === "score") {
      const scale = document.createElement("div");
      scale.className = "scale";
      row.levels.forEach((level, index) => {
        const stop = document.createElement("span");
        if (index === row.at) stop.className = "on";
        stop.textContent = level;
        scale.append(stop);
      });
      wrap.append(scale);
    } else {
      const meter = document.createElement("div");
      meter.className = "meter";
      const bar = document.createElement("span");
      bar.style.width = `${Math.max(0, Math.min(1, row.p)) * 100}%`;
      meter.append(bar);
      wrap.append(meter);
    }
    return wrap;
  }

  function paintCard() {
    card.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = "This draft";
    card.append(title);
    if (!verdict || verdict.status !== "ready") {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = verdict?.status === "error"
        ? "The check did not run. Send is open."
        : "Add an API key in the Jevly popup.";
      card.append(note);
      return;
    }
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Probability of the answer shown.";
    card.append(hint);
    for (const row of verdict.rows) card.append(rowNode(row));
  }

  function paintSheet() {
    sheet.replaceChildren();
    if (!verdict || verdict.status !== "ready") return;
    const fails = verdict.rows.filter((row) => row.fail);
    const title = document.createElement("h2");
    title.textContent = fails.length === 1
      ? "1 check would block this send."
      : `${fails.length} checks would block this send.`;
    sheet.append(title);
    for (const row of fails) sheet.append(rowNode(row));
    const anyway = document.createElement("button");
    anyway.type = "button";
    anyway.className = "anyway";
    anyway.textContent = "Send anyway";
    anyway.addEventListener("click", () => {
      armed = text;
      sheetOpen = false;
      sheet.classList.remove("on");
      const target = control;
      if (target) target.click();
      armed = null;
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "back";
    back.textContent = "Back to draft";
    back.addEventListener("click", () => {
      sheetOpen = false;
      sheet.classList.remove("on");
    });
    sheet.append(anyway, back);
  }

  function place() {
    if (!field || !badge.classList.contains("on")) return;
    const rect = field.getBoundingClientRect();
    const right = `${Math.max(8, window.innerWidth - rect.right + 12)}px`;
    badge.style.top = `${Math.max(8, rect.bottom - 44)}px`;
    badge.style.right = right;
    badge.style.left = "auto";
    if (cardOpen) {
      const height = card.offsetHeight || 180;
      card.style.right = right;
      card.style.left = "auto";
      card.style.top = `${Math.max(8, rect.bottom - 44 - height - 8)}px`;
    }
    if (sheetOpen && control) {
      const box = control.getBoundingClientRect();
      const height = sheet.offsetHeight || 160;
      sheet.style.top = `${Math.max(8, box.top - height - 8)}px`;
      sheet.style.right = `${Math.max(8, window.innerWidth - box.right)}px`;
      sheet.style.left = "auto";
    }
  }

  function show() {
    paintBadge();
    paintCard();
    badge.classList.add("on");
    card.classList.toggle("on", cardOpen);
    sheet.classList.toggle("on", sheetOpen);
    place();
  }

  function blocked(): boolean {
    return verdict?.status === "ready" && !verdict.clear && armed !== text;
  }

  async function request(next: string, gen: number) {
    let reply: unknown;
    try {
      reply = await browser.runtime.sendMessage({ type: "check", text: next });
    } catch {
      reply = { status: "error" };
    }
    if (gen !== generation) return;
    verdict = isVerdict(reply) ? reply : { status: "error" };
    show();
  }

  function schedule() {
    if (!field || !field.isConnected) {
      field = null;
      hide();
      return;
    }
    const next = readDraft(field);
    if (!next) {
      text = "";
      verdict = null;
      hide();
      return;
    }
    if (next !== text) armed = null;
    text = next;
    badge.classList.add("on");
    if (!verdict) {
      mark.replaceChildren();
      mark.textContent = "…";
    }
    place();
    const gen = ++generation;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void request(next, gen);
    }, 400);
  }

  badge.addEventListener("click", () => {
    cardOpen = !cardOpen;
    sheetOpen = false;
    show();
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target instanceof Node && host.contains(target)) return;
    if (isSendControl(target)) return;
    if (target instanceof HTMLInputElement && target.type === "password") {
      field = null;
      hide();
      return;
    }
    if (!isDraft(target)) {
      field = null;
      hide();
      return;
    }
    field = target;
    schedule();
  }, true);

  document.addEventListener("input", () => {
    if (document.activeElement === field) schedule();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || host.contains(target)) return;
    const button = target.closest("button, input[type='submit'], [role='button']");
    if (!(button instanceof HTMLElement) || !SEND_NAME.test(controlName(button))) return;
    if (!field?.isConnected || !blocked()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    control = button;
    sheetOpen = true;
    cardOpen = false;
    paintSheet();
    show();
  }, true);

  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement) || !field || !event.target.contains(field)) return;
    if (!blocked()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    control = event.submitter instanceof HTMLElement ? event.submitter : control;
    sheetOpen = true;
    cardOpen = false;
    paintSheet();
    show();
  }, true);

  window.addEventListener("scroll", place, true);
  window.addEventListener("resize", place);
}
