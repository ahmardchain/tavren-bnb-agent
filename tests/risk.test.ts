import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY, WAD, makePlan, parseUsd, sampleSnapshot, validatePolicy } from "../lib/risk.ts";

test("healthy positions do not transact; debt-free coverage is undefined", () => {
  assert.equal(makePlan(sampleSnapshot(), DEFAULT_POLICY).action, "HOLD");
  const debtFree = { ...sampleSnapshot(), debtUsd: "0", markets: [] };
  assert.equal(makePlan(debtFree, DEFAULT_POLICY).action, "NO_DEBT");
  assert.equal(makePlan(debtFree, DEFAULT_POLICY).ratio, null);
});
test("a 20% capacity shock requires precisely $420 of repayment to restore 1.60x", () => {
  const plan = makePlan(sampleSnapshot(20), DEFAULT_POLICY);
  assert.equal(plan.action, "REPAY"); assert.equal(plan.repayUsd, (420n * WAD).toString());
  assert.equal(plan.projectedRatio, 1.6); assert.equal(plan.reachesTarget, true);
});
test("a cap never implies that the target has been reached", () => {
  const plan = makePlan(sampleSnapshot(20), { ...DEFAULT_POLICY, maxRepayUsd: "100" });
  assert.equal(plan.repayUsd, (100n * WAD).toString()); assert.equal(plan.reachesTarget, false);
});
test("raw amount math respects six-decimal tokens and non-unit prices", () => {
  const snapshot = sampleSnapshot(20);
  snapshot.markets[0] = { ...snapshot.markets[0], decimals: 6, borrowRaw: "1500000000", walletRaw: "600000000", price: (10n ** 30n).toString() };
  assert.equal(makePlan(snapshot, DEFAULT_POLICY).amountRaw, "420000000");
  snapshot.markets[0].price = (3n * 10n ** 30n).toString();
  const plan = makePlan(snapshot, { ...DEFAULT_POLICY, maxRepayUsd: "100" });
  assert.ok(BigInt(plan.repayUsd) <= 100n * WAD); assert.equal(plan.amountRaw, "33333333");
});
test("insufficient funds are explicit and a native gas reserve is retained", () => {
  const snapshot = sampleSnapshot(20); snapshot.markets[0].walletRaw = "0";
  assert.equal(makePlan(snapshot, DEFAULT_POLICY).action, "NO_BALANCE");
  snapshot.markets[0] = { ...snapshot.markets[0], underlying: null, walletRaw: (4n * 10n ** 15n).toString() };
  assert.equal(makePlan(snapshot, DEFAULT_POLICY).amountRaw, (10n ** 15n).toString());
});
test("expired snapshots, wrong chains, invalid numeric input and inverted rules fail closed", () => {
  const snapshot = { ...sampleSnapshot(20), source: "live" as const, observedAt: Date.now() - 91_000 };
  assert.throws(() => makePlan(snapshot, DEFAULT_POLICY), /expired/);
  assert.throws(() => makePlan({ ...sampleSnapshot(), chainId: 56 as 97 }, DEFAULT_POLICY), /chain 97/);
  for (const input of ["NaN", "Infinity", "1e9", "-1", "0.0000001", "999999999999"]) assert.throws(() => parseUsd(input));
  assert.throws(() => validatePolicy({ ...DEFAULT_POLICY, targetBps: 12_000 }), /exceed/);
});
test("repayments remain inside balance, debt and USD cap across stress levels", () => {
  for (let shock = 0; shock <= 40; shock++) {
    for (const cap of ["0.01", "1", "100", "500"]) {
      const snapshot = sampleSnapshot(shock), plan = makePlan(snapshot, { ...DEFAULT_POLICY, maxRepayUsd: cap });
      assert.ok(BigInt(plan.repayUsd) <= parseUsd(cap));
      if (plan.market) { assert.ok(BigInt(plan.amountRaw) <= BigInt(plan.market.borrowRaw)); assert.ok(BigInt(plan.amountRaw) <= BigInt(plan.market.walletRaw)); }
    }
  }
});
