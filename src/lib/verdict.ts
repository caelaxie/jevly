export const model = "jev-latest";

export const questions = {
  audience: {
    type: "choice" as const,
    instructions: "Who is this draft written as if it will be read by?",
    criteria: {
      colleague: "Someone the writer already works with",
      customer: "A customer or client",
      public: "Anyone outside the conversation, or a public audience",
    },
  },
  directness: {
    type: "score" as const,
    instructions: "How direct is the wording?",
    criteria: ["hedged", "plain", "blunt"],
  },
  ready: {
    type: "noul" as const,
    instructions: "Is this safe to send as written?",
  },
};

export const levels = ["hedged", "plain", "blunt"] as const;

export type Directness = (typeof levels)[number];

export type ChoiceRow = {
  kind: "choice";
  label: "audience";
  value: string;
  p: number;
  fail: boolean;
};

export type ScoreRow = {
  kind: "score";
  label: "directness";
  value: Directness;
  levels: typeof levels;
  at: 0 | 1 | 2;
  p: number;
  fail: false;
};

export type NoulRow = {
  kind: "noul";
  label: "ready to send";
  value: "yes" | "no";
  p: number;
  fail: boolean;
};

export type ReadyVerdict = {
  status: "ready";
  badge: Directness;
  clear: boolean;
  rows: [ChoiceRow, ScoreRow, NoulRow];
};

export type Verdict =
  | { status: "missing-key" }
  | { status: "error" }
  | ReadyVerdict;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected object");
  }
  return value as Record<string, unknown>;
}

function numberAt(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`expected number ${key}`);
  }
  return value;
}

function clampAt(score: number): 0 | 1 | 2 {
  const rounded = Math.round(score);
  if (rounded <= 0) return 0;
  if (rounded >= 2) return 2;
  return 1;
}

function parseChoice(value: unknown): ChoiceRow {
  const answer = record(value);
  if (answer.type !== "choice" || typeof answer.choice !== "string") {
    throw new Error("audience");
  }
  const probabilities = record(answer.probabilities);
  const p = probabilities[answer.choice];
  if (typeof p !== "number" || Number.isNaN(p)) {
    throw new Error("audience probability");
  }
  return {
    kind: "choice",
    label: "audience",
    value: answer.choice,
    p,
    fail: answer.choice === "public",
  };
}

function parseScore(value: unknown): ScoreRow {
  const answer = record(value);
  if (answer.type !== "score") throw new Error("directness");
  const at = clampAt(numberAt(answer, "score"));
  const level = levels[at];
  return {
    kind: "score",
    label: "directness",
    value: level,
    levels,
    at,
    p: numberAt(answer, "confidence"),
    fail: false,
  };
}

function parseReady(value: unknown): NoulRow {
  const answer = record(value);
  if (answer.type !== "noul") throw new Error("ready");
  const noul = numberAt(answer, "noul");
  if (noul >= 0.5) {
    return { kind: "noul", label: "ready to send", value: "yes", p: noul, fail: false };
  }
  return { kind: "noul", label: "ready to send", value: "no", p: 1 - noul, fail: true };
}

export function parseAnswers(raw: unknown): ReadyVerdict {
  const body = record(raw);
  const answers = record(body.answers);
  if (!("audience" in answers) || !("directness" in answers) || !("ready" in answers)) {
    throw new Error("missing answer");
  }
  const audience = parseChoice(answers.audience);
  const directness = parseScore(answers.directness);
  const ready = parseReady(answers.ready);
  return {
    status: "ready",
    badge: directness.value,
    clear: !audience.fail && !ready.fail,
    rows: [audience, directness, ready],
  };
}
