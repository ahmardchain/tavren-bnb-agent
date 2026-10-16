import test from "node:test";
import assert from "node:assert/strict";
import { readPosition } from "../lib/venus.ts";
import { WAD } from "../lib/risk.ts";
const wallet = "0x0000000000000000000000000000000000000001";
const market = "0x0000000000000000000000000000000000000002";
const token = "0x0000000000000000000000000000000000000003";
function fixture(overrides: Record<string, unknown> = {}) {
  const seen: unknown[] = [];
  const client = {
    getChainId: async () => 97,
    getBlock: async () => ({ number: 123n, timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    async readContract(call: { functionName: string; blockNumber?: bigint }) {
      seen.push(call.blockNumber);
      const values: Record<string, unknown> = { getAssetsIn: [market], getAccountLiquidity: [0n, 500n * WAD, 0n], oracle: token, mintedVAIs: 0n, getAccountSnapshot: [0n, 0n, 1000_000000n, 0n], getUnderlyingPrice: 10n ** 30n, markets: [true, WAD / 2n, true], underlying: token, decimals: 6, symbol: "USDC", balanceOf: 100_000000n, allowance: 0n, ...overrides };
      return values[call.functionName];
    },
  };
  return { client, seen };
}
test("six-decimal oracle math is normalized and every contract read pins the observed block", async () => {
  const { client, seen } = fixture();
  const data = await readPosition(wallet, client as never);
  assert.equal(data.debtUsd, (1000n * WAD).toString());
  assert.equal(data.capacityUsd, (1500n * WAD).toString());
  assert.equal(data.block, "123"); assert.ok(seen.length > 5 && seen.every(block => block === 123n));
});
test("an unreadable market, missing oracle, protocol error or VAI debt cannot produce a safe report", async () => {
  for (const overrides of [{ getUnderlyingPrice: 0n }, { getAccountSnapshot: [1n, 0n, 1n, 0n] }, { getAccountLiquidity: [1n, 0n, 0n] }, { mintedVAIs: 1n }]) {
    await assert.rejects(readPosition(wallet, fixture(overrides).client as never));
  }
});
test("invalid accounts, wrong chain and stale RPC blocks are rejected", async () => {
  await assert.rejects(readPosition("not-an-address", fixture().client as never), /valid/);
  await assert.rejects(readPosition(wallet, { ...fixture().client, getChainId: async () => 56 } as never), /wrong chain/);
  await assert.rejects(readPosition(wallet, { ...fixture().client, getBlock: async () => ({ number: 123n, timestamp: 1n }) } as never), /stale/);
});
