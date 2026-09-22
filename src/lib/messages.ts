export type ToBackground =
  | { type: "check"; text: string }
  | { type: "read-key" }
  | { type: "write-key"; key: string };

export type KeyState = { key: string };

export function readKeyState(value: unknown): KeyState | null {
  if (typeof value !== "object" || value === null || !("key" in value)) return null;
  if (typeof value.key !== "string") return null;
  return { key: value.key };
}

export function readMessage(value: unknown): ToBackground | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  if (value.type === "read-key") return { type: "read-key" };
  if (value.type === "check" && "text" in value && typeof value.text === "string") {
    return { type: "check", text: value.text };
  }
  if (value.type === "write-key" && "key" in value && typeof value.key === "string") {
    return { type: "write-key", key: value.key };
  }
  return null;
}
