import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAnswers } from "./verdict.ts";

function payload(audience: string, audienceP: number, score: number, confidence: number, noul: number) {
  return {
    model: "jev-1.13.0",
    answers: {
      audience: {
        type: "choice",
        choice: audience,
        probabilities: { colleague: 0, customer: 0, public: 0, [audience]: audienceP },
        confidence: audienceP,
      },
      directness: {
        type: "score",
        score,
        confidence,
        legend: { "0": "hedged", "1": "plain", "2": "blunt" },
        probabilities: { "0": 0, "1": 0, "2": 0, [String(score)]: 1 },
      },
      ready: { type: "noul", noul },
    },
  };
}

test("a public blunt draft blocks send", () => {
  const verdict = parseAnswers(payload("public", 0.74, 2, 0.83, 0.19));
  assert.equal(verdict.badge, "blunt");
  assert.equal(verdict.clear, false);
  const [audience, directness, ready] = verdict.rows;
  assert.equal(audience.fail, true);
  assert.equal(audience.p, 0.74);
  assert.equal(directness.fail, false);
  assert.equal(directness.value, "blunt");
  assert.equal(directness.at, 2);
  assert.equal(directness.p, 0.83);
  assert.equal(ready.value, "no");
  assert.equal(ready.fail, true);
  assert.equal(ready.p, 1 - 0.19);
});

test("a colleague draft is clear to send", () => {
  const verdict = parseAnswers(payload("colleague", 0.88, 1, 0.77, 0.91));
  assert.equal(verdict.badge, "plain");
  assert.equal(verdict.clear, true);
  assert.equal(verdict.rows[2].value, "yes");
  assert.equal(verdict.rows[2].fail, false);
  assert.equal(verdict.rows[0].fail, false);
});

test("a payload missing ready throws", () => {
  const body = payload("colleague", 0.88, 1, 0.77, 0.91);
  const { ready: _ready, ...answers } = body.answers;
  assert.throws(() => parseAnswers({ ...body, answers }));
});

test("noul of 0.5 is yes and does not fail", () => {
  const verdict = parseAnswers(payload("customer", 0.6, 0, 0.5, 0.5));
  assert.equal(verdict.rows[2].value, "yes");
  assert.equal(verdict.rows[2].fail, false);
  assert.equal(verdict.badge, "hedged");
  assert.equal(verdict.clear, true);
});
