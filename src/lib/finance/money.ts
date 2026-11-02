export function minor(value: unknown, label = "Amount"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} must be integer cents`);
  return value;
}

export function add(...values: number[]): number {
  return values.reduce((sum, value) => minor(minor(sum) + minor(value)), 0);
}

export function portion(amountMinor: number, basisPoints: number): number {
  minor(amountMinor);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error("Work use must be between 0 and 100%");
  const n = BigInt(amountMinor) * BigInt(basisPoints);
  const sign = n < BigInt(0) ? BigInt(-1) : BigInt(1);
  return minor(Number(sign * ((sign * n + BigInt(5000)) / BigInt(10000))));
}

export function parseSignedMoney(value: string): number {
  const text = value.trim().replace(/[$,\s]/g, "");
  const match = /^(-?)(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(text);
  if (!match) throw new Error("Invalid currency amount; use at most two decimal places");
  const amount = BigInt(match[2] || "0") * BigInt(100) + BigInt((match[3] || match[4] || "").padEnd(2, "0"));
  return minor(Number(match[1] ? -amount : amount));
}
