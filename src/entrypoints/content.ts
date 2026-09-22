import { mount, unmount } from "svelte";
import { writable } from "svelte/store";
import overlayCss from "./content/overlay.css?inline";
import Overlay from "./content/Overlay.svelte";
import { readVerdict } from "../lib/verdict";
import type { Verdict } from "../lib/verdict";

const SEND_NAME = /^(send|post|reply|comment|publish)$/i;
const MAX_CHARS = 8000;

type View = {
  badgeOn: boolean;
  cardOpen: boolean;
  sheetOpen: boolean;
  verdict: Verdict | null;
  badgeTop: string;
  badgeRight: string;
  cardTop: string;
  cardRight: string;
  sheetTop: string;
  sheetRight: string;
};

const emptyView: View = {
  badgeOn: false,
  cardOpen: false,
  sheetOpen: false,
  verdict: null,
  badgeTop: "8px",
  badgeRight: "8px",
  cardTop: "8px",
  cardRight: "8px",
  sheetTop: "8px",
  sheetRight: "8px",
};

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

function controlName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();
  if (el instanceof HTMLInputElement) return el.value.trim();
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function sendButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest("button, input[type='submit'], [role='button']");
  if (!(button instanceof HTMLElement) || !SEND_NAME.test(controlName(button))) return null;
  return button;
}

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "jevly-overlay",
      position: "inline",
      anchor: "body",
      css: overlayCss,
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
        return bind(container, host);
      },
    });
    ui.mount();
  },
});

function bind(container: HTMLElement, host: HTMLElement) {
  const view = writable<View>(emptyView);
  let field: HTMLElement | null = null;
  let text = "";
  let verdict: Verdict | null = null;
  let generation = 0;
  let timer = 0;
  let armed: string | null = null;
  let control: HTMLElement | null = null;
  let cardOpen = false;
  let sheetOpen = false;
  let badgeOn = false;

  const stop = new AbortController();
  const listen = { capture: true, signal: stop.signal };

  function hide() {
    generation += 1;
    window.clearTimeout(timer);
    badgeOn = false;
    cardOpen = false;
    sheetOpen = false;
    publish();
  }

  function blocked(): boolean {
    return verdict?.status === "ready" && !verdict.clear && armed !== text;
  }

  function publish() {
    view.update((current) => ({
      ...current,
      badgeOn,
      cardOpen,
      sheetOpen,
      verdict,
    }));
    queueMicrotask(place);
  }

  function place() {
    if (!badgeOn || !field) return;
    const rect = field.getBoundingClientRect();
    const right = `${Math.max(8, window.innerWidth - rect.right + 12)}px`;
    const cardEl = container.querySelector(".card");
    const sheetEl = container.querySelector(".sheet");
    const cardHeight = cardEl instanceof HTMLElement ? cardEl.offsetHeight || 180 : 180;
    const sheetHeight = sheetEl instanceof HTMLElement ? sheetEl.offsetHeight || 160 : 160;
    const badgeTop = `${Math.max(8, rect.bottom - 44)}px`;
    const cardTop = `${Math.max(8, rect.bottom - 44 - cardHeight - 8)}px`;
    let sheetTop = "8px";
    let sheetRight = "8px";
    if (sheetOpen && control) {
      const box = control.getBoundingClientRect();
      sheetTop = `${Math.max(8, box.top - sheetHeight - 8)}px`;
      sheetRight = `${Math.max(8, window.innerWidth - box.right)}px`;
    }
    view.update((current) => {
      if (
        current.badgeTop === badgeTop &&
        current.badgeRight === right &&
        current.cardTop === cardTop &&
        current.cardRight === right &&
        current.sheetTop === sheetTop &&
        current.sheetRight === sheetRight
      ) return current;
      return { ...current, badgeTop, badgeRight: right, cardTop, cardRight: right, sheetTop, sheetRight };
    });
  }

  async function request(next: string, gen: number) {
    let reply: unknown;
    try {
      reply = await browser.runtime.sendMessage({ type: "check", text: next });
    } catch {
      reply = { status: "error" };
    }
    if (gen !== generation) return;
    const parsed = readVerdict(reply);
    verdict = parsed ?? { status: "error" };
    publish();
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
    badgeOn = true;
    publish();
    const gen = ++generation;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void request(next, gen);
    }, 400);
  }

  function hold(event: Event, next: HTMLElement | null) {
    if (!field?.isConnected || !blocked()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (next) control = next;
    sheetOpen = true;
    cardOpen = false;
    publish();
  }

  function sendAnyway() {
    armed = text;
    sheetOpen = false;
    publish();
    const target = control;
    if (target) target.click();
    armed = null;
  }

  const overlay = mount(Overlay, {
    target: container,
    props: {
      view,
      onBadge: () => {
        cardOpen = !cardOpen;
        sheetOpen = false;
        publish();
      },
      onAnyway: sendAnyway,
      onBack: () => {
        sheetOpen = false;
        publish();
      },
    },
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target instanceof Node && host.contains(target)) return;
    if (isSendControl(target)) return;
    if (!isDraft(target)) {
      field = null;
      hide();
      return;
    }
    field = target;
    schedule();
  }, listen);

  document.addEventListener("input", () => {
    if (document.activeElement === field) schedule();
  }, listen);

  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && host.contains(event.target)) return;
    const button = sendButton(event.target);
    if (!button) return;
    hold(event, button);
  }, listen);

  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement) || !field || !event.target.contains(field)) return;
    const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
    hold(event, submitter);
  }, listen);

  window.addEventListener("scroll", place, listen);
  window.addEventListener("resize", place, listen);

  return () => {
    stop.abort();
    void unmount(overlay);
  };
}
