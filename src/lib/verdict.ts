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

function isDirectness(value: string): value is Directness {
  return (levels as readonly string[]).includes(value);
}

function readChoice(value: unknown): ChoiceRow | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || value.kind !== "choice") return null;
  if (!("label" in value) || value.label !== "audience") return null;
  if (!("value" in value) || typeof value.value !== "string") return null;
  if (!("p" in value) || typeof value.p !== "number" || Number.isNaN(value.p)) return null;
  if (!("fail" in value) || typeof value.fail !== "boolean") return null;
  if (value.fail !== (value.value === "public")) return null;
  return { kind: "choice", label: "audience", value: value.value, p: value.p, fail: value.fail };
}

function readScore(value: unknown): ScoreRow | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || value.kind !== "score") return null;
  if (!("label" in value) || value.label !== "directness") return null;
  if (!("value" in value) || typeof value.value !== "string" || !isDirectness(value.value)) return null;
  if (!("at" in value) || (value.at !== 0 && value.at !== 1 && value.at !== 2)) return null;
  if (levels[value.at] !== value.value) return null;
  if (!("p" in value) || typeof value.p !== "number" || Number.isNaN(value.p)) return null;
  if (!("fail" in value) || value.fail !== false) return null;
  return {
    kind: "score",
    label: "directness",
    value: value.value,
    levels,
    at: value.at,
    p: value.p,
    fail: false,
  };
}

function readNoul(value: unknown): NoulRow | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || value.kind !== "noul") return null;
  if (!("label" in value) || value.label !== "ready to send") return null;
  if (!("value" in value) || (value.value !== "yes" && value.value !== "no")) return null;
  if (!("p" in value) || typeof value.p !== "number" || Number.isNaN(value.p)) return null;
  if (!("fail" in value) || typeof value.fail !== "boolean") return null;
  if (value.fail !== (value.value === "no")) return null;
  return { kind: "noul", label: "ready to send", value: value.value, p: value.p, fail: value.fail };
}

export function readVerdict(value: unknown): Verdict | null {
  if (typeof value !== "object" || value === null || !("status" in value)) return null;
  if (value.status === "missing-key") return { status: "missing-key" };
  if (value.status === "error") return { status: "error" };
  if (value.status !== "ready") return null;
  if (!("badge" in value) || typeof value.badge !== "string" || !isDirectness(value.badge)) return null;
  if (!("clear" in value) || typeof value.clear !== "boolean") return null;
  if (!("rows" in value) || !Array.isArray(value.rows) || value.rows.length !== 3) return null;
  const audience = readChoice(value.rows[0]);
  const directness = readScore(value.rows[1]);
  const ready = readNoul(value.rows[2]);
  if (!audience || !directness || !ready) return null;
  if (value.badge !== directness.value) return null;
  if (value.clear !== (!audience.fail && !ready.fail)) return null;
  return { status: "ready", badge: value.badge, clear: value.clear, rows: [audience, directness, ready] };
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
