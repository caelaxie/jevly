import { resolveEndpoint } from "../lib/endpoint";
import { readMessage, type KeyState } from "../lib/messages";
import { model, parseAnswers, questions, type Verdict } from "../lib/verdict";

const KEY = "jevApiKey";
const ENDPOINT_KEY = "jevEndpoint";

async function readKey(): Promise<string> {
  const stored = await browser.storage.local.get(KEY);
  const value = stored[KEY];
  return typeof value === "string" ? value.trim() : "";
}

async function endpoint(): Promise<string> {
  const stored = await browser.storage.local.get(ENDPOINT_KEY);
  return resolveEndpoint(stored[ENDPOINT_KEY]);
}

async function check(text: string): Promise<Verdict> {
  const key = await readKey();
  if (!key) return { status: "missing-key" };
  try {
    const response = await fetch(await endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, state: text, questions }),
    });
    if (!response.ok) return { status: "error" };
    return parseAnswers(await response.json());
  } catch {
    return { status: "error" };
  }
}

function keyState(key: string): KeyState {
  return { key };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const parsed = readMessage(message);
    if (!parsed) {
      sendResponse({ status: "error" });
      return;
    }
    const reply = (() => {
      switch (parsed.type) {
        case "check":
          return check(parsed.text);
        case "write-key":
          return browser.storage.local.set({ [KEY]: parsed.key.trim() }).then(readKey).then(keyState);
        case "read-key":
          return readKey().then(keyState);
      }
    })();
    reply.then(sendResponse, () => sendResponse({ status: "error" }));
    return true;
  });
});
