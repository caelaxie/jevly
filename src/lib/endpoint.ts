const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export function resolveEndpoint(stored: unknown): string {
  if (typeof stored !== "string") return DEFAULT_ENDPOINT;
  let url: URL;
  try {
    url = new URL(stored);
  } catch {
    return DEFAULT_ENDPOINT;
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return DEFAULT_ENDPOINT;
  if (url.username || url.password) return DEFAULT_ENDPOINT;
  return url.href;
}
