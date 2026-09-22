import assert from "node:assert/strict";
import { test } from "node:test";
import { readKeyState, readMessage } from "./messages.ts";

test("a key reply is the string that was stored", () => {
  assert.deepEqual(readKeyState({ key: "abc" }), { key: "abc" });
  assert.equal(readKeyState({ key: 1 }), null);
  assert.equal(readKeyState(null), null);
});

test("a check message keeps its text", () => {
  assert.deepEqual(readMessage({ type: "check", text: "Hi" }), { type: "check", text: "Hi" });
  assert.equal(readMessage({ type: "check" }), null);
});
