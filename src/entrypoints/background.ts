import { readMessage, type KeyState } from "../lib/messages";
import { model, parseAnswers, questions, type Verdict } from "../lib/verdict";

const KEY = "jevApiKey";
const ENDPOINT_KEY = "jevEndpoint";
const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

async function readKey(): Promise<string> {
  const stored = await browser.storage.local.get(KEY);
  const value = stored[KEY];
  return typeof value === "string" ? value.trim() : "";
}

async function endpoint(): Promise<string> {
  const stored = await browser.storage.local.get(ENDPOINT_KEY);
  const value = stored[ENDPOINT_KEY];
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  return DEFAULT_ENDPOINT;
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

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const parsed = readMessage(message);
    if (!parsed) {
      sendResponse({ status: "error" });
      return;
    }
    const reply = parsed.type === "check"
      ? check(parsed.text)
      : parsed.type === "write-key"
        ? browser.storage.local.set({ [KEY]: parsed.key.trim() }).then(async () => {
            const key = await readKey();
            const state: KeyState = { key };
            return state;
          })
        : readKey().then((key) => {
            const state: KeyState = { key };
            return state;
          });
    reply.then(sendResponse, () => sendResponse({ status: "error" }));
    return true;
  });
});
