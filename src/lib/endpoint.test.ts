import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEndpoint } from "./endpoint.ts";

const live = "https://api.typesafe.ai/v1/systemone";

test("a missing endpoint stays on the live service", () => {
  assert.equal(resolveEndpoint(undefined), live);
  assert.equal(resolveEndpoint(""), live);
});

test("only a loopback http url is accepted", () => {
  assert.equal(resolveEndpoint("http://127.0.0.1:9/v1/systemone"), "http://127.0.0.1:9/v1/systemone");
  assert.equal(resolveEndpoint("https://evil.example/v1"), live);
  assert.equal(resolveEndpoint("http://localhost:9/v1"), live);
  assert.equal(resolveEndpoint("http://user:pass@127.0.0.1:9/v1"), live);
});
