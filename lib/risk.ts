export const WAD = 10n ** 18n;
export const BPS = 10_000n;

export type Policy = { triggerBps: number; targetBps: number; maxRepayUsd: string };
export const DEFAULT_POLICY: Policy = { triggerBps: 13_500, targetBps: 16_000, maxRepayUsd: "500" };
export type Market = {
  address: `0x${string}`; symbol: string; underlying: `0x${string}` | null;
  decimals: number; borrowRaw: string; price: string; debtUsd: string;
  walletRaw: string; allowanceRaw: string;
};
export type Snapshot = {
  source: "live" | "sample"; chainId: 97; account: string; block: string | null;
  observedAt: number; liquidityUsd: string; shortfallUsd: string; debtUsd: string;
  capacityUsd: string; markets: Market[];
};
export type Plan = {
  action: "HOLD" | "REPAY" | "NO_DEBT" | "NO_BALANCE";
  reason: string; ratio: number | null; neededUsd: string; repayUsd: string;
  amountRaw: string; projectedRatio: number | null; reachesTarget: boolean;
  market: Market | null;
};

export function parseUsd(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value)) throw new Error("Enter a positive USD amount with up to six decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * WAD + BigInt(fraction.padEnd(18, "0"));
}
export function validatePolicy(policy: Policy): Policy {
  if (!Number.isInteger(policy.triggerBps) || policy.triggerBps < 10_500 || policy.triggerBps > 30_000) throw new Error("Trigger must be between 1.05 and 3.00.");
  if (!Number.isInteger(policy.targetBps) || policy.targetBps <= policy.triggerBps || policy.targetBps > 50_000) throw new Error("Target must exceed the trigger and be at most 5.00.");
  const cap = parseUsd(policy.maxRepayUsd);
  if (cap <= 0n || cap > 10_000n * WAD) throw new Error("Repayment cap must be above zero and at most $10,000.");
  return policy;
}
export function ratioOf(capacity: bigint, debt: bigint): number | null {
  return debt === 0n ? null : Number(capacity * 10_000n / debt) / 10_000;
}
const min = (...values: bigint[]) => values.reduce((a, b) => a < b ? a : b);

export function makePlan(snapshot: Snapshot, policy: Policy, now = Date.now()): Plan {
  validatePolicy(policy);
  if (snapshot.chainId !== 97) throw new Error("Only BSC testnet chain 97 is supported.");
  if (snapshot.source === "live" && (now - snapshot.observedAt > 90_000 || snapshot.observedAt > now + 5_000)) throw new Error("Snapshot expired. Check the wallet again.");
  const debt = BigInt(snapshot.debtUsd), capacity = BigInt(snapshot.capacityUsd);
  if (debt < 0n || capacity < 0n) throw new Error("Invalid lending balances.");
  const ratio = ratioOf(capacity, debt);
  const base: Plan = { action: "HOLD", reason: "Coverage is above your trigger. No repayment is needed.", ratio, neededUsd: "0", repayUsd: "0", amountRaw: "0", projectedRatio: ratio, reachesTarget: ratio === null || ratio >= policy.targetBps / 10_000, market: null };
  if (debt === 0n) return { ...base, action: "NO_DEBT", reason: "No debt was found in this wallet's Venus Core markets." };
  if (capacity * BPS >= debt * BigInt(policy.triggerBps)) return base;
  const desiredDebt = capacity * BPS / BigInt(policy.targetBps);
  const needed = debt > desiredDebt ? debt - desiredDebt : 0n;
  const markets = [...snapshot.markets].filter(m => BigInt(m.borrowRaw) > 0n && BigInt(m.price) > 0n).sort((a,b) => BigInt(a.debtUsd) > BigInt(b.debtUsd) ? -1 : 1);
  for (const market of markets) {
    const price = BigInt(market.price);
    const reserve = market.underlying === null ? 3n * 10n ** 15n : 0n;
    const available = BigInt(market.walletRaw) > reserve ? BigInt(market.walletRaw) - reserve : 0n;
    const budget = min(needed, parseUsd(policy.maxRepayUsd));
    // Floor the raw budget: rounding must never make a repayment exceed the cap.
    const amount = min(budget * WAD / price, available, BigInt(market.borrowRaw));
    if (amount === 0n) continue;
    const repay = amount * price / WAD;
    if (repay === 0n) continue;
    const projectedRatio = ratioOf(capacity, debt - repay);
    return { action: "REPAY", reason: "Coverage is below your trigger. Prepare one bounded repayment, then check the position again.", ratio, neededUsd: needed.toString(), repayUsd: repay.toString(), amountRaw: amount.toString(), projectedRatio, reachesTarget: projectedRatio === null || projectedRatio >= policy.targetBps / 10_000, market };
  }
  return { ...base, action: "NO_BALANCE", reason: "Coverage is below your trigger, but the wallet has no spendable borrowed asset. Fund the matching test token or manage the position on Venus.", neededUsd: needed.toString(), reachesTarget: false };
}

export function sampleSnapshot(shock = 0): Snapshot {
  const capacity = 2_160n * WAD * BigInt(100 - shock) / 100n;
  const debt = 1_500n * WAD;
  return { source: "sample", chainId: 97, account: "Sample wallet", block: null, observedAt: Date.now(), liquidityUsd: (capacity > debt ? capacity - debt : 0n).toString(), shortfallUsd: (debt > capacity ? debt - capacity : 0n).toString(), debtUsd: debt.toString(), capacityUsd: capacity.toString(), markets: [{ address: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A", underlying: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c", symbol: "USDT", decimals: 18, borrowRaw: debt.toString(), price: WAD.toString(), debtUsd: debt.toString(), walletRaw: (600n * WAD).toString(), allowanceRaw: "0" }] };
}
