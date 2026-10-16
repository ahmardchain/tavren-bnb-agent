import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics } from "viem";
import { CAMPAIGN_OWNER, PUBLIC_AGENT_ORIGIN } from "../lib/campaign.ts";
import { AGENT_URI, agentCard, registrationDocument } from "../lib/agent-discovery.ts";
import { VERIFIED_IDENTITY } from "../lib/agent-identity.ts";
import { IDENTITY_REGISTRY, identityAbi, registrationData, prepareRegistration, verifyRegistration } from "../lib/agent-registration.ts";
import { publicClient } from "../lib/venus.ts";

const hash = `0x${"12".repeat(32)}`;
function client(overrides: Record<string, unknown> = {}) {
  return {
    getChainId: async () => 97,
    getBlock: async () => ({ number: 100n, timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
    getCode: async () => "0x6000",
    getBalance: async () => 0n,
    getTransactionCount: async () => 0,
    getGasPrice: async () => 1_000_000_000n,
    simulateContract: async () => ({ result: 42n }),
    estimateContractGas: async () => 100_000n,
    readContract: async (input: { functionName: string }) => input.functionName === "ownerOf" ? CAMPAIGN_OWNER : input.functionName === "tokenURI" ? AGENT_URI : 0n,
    getTransaction: async () => ({ from: CAMPAIGN_OWNER, to: IDENTITY_REGISTRY, input: registrationData(), value: 0n }),
    getTransactionReceipt: async () => ({ status: "success", logs: [{ address: IDENTITY_REGISTRY, topics: encodeEventTopics({ abi: identityAbi, eventName: "Registered", args: { agentId: 42n, owner: CAMPAIGN_OWNER } }), data: encodeAbiParameters([{ type: "string" }], [AGENT_URI]) }] }),
    ...overrides,
  } as unknown as ReturnType<typeof publicClient>;
}

test("discovery publishes the verified BSC testnet identity and its evidence", () => {
  assert.equal(agentCard().url, `${PUBLIC_AGENT_ORIGIN}/api/agent`);
  const metadata = registrationDocument();
  assert.deepEqual(metadata.registrations, [{ agentId: 2640, agentRegistry: `eip155:97:${IDENTITY_REGISTRY}` }]);
  assert.equal(metadata.campaign.identityStatus, "verified");
  assert.equal(metadata.campaign.identityEvidence.agentURI, AGENT_URI);
  assert.equal(metadata.campaign.identityEvidence.owner, CAMPAIGN_OWNER);
  assert.equal(metadata.campaign.identityEvidence.transactionHash, VERIFIED_IDENTITY.transactionHash);
  assert.ok(metadata.services.every(s => s.endpoint.startsWith(PUBLIC_AGENT_ORIGIN)));
});

test("registration draft fixes owner, registry, zero value and public metadata URI", async () => {
  const draft = await prepareRegistration(client());
  assert.equal(draft.from, CAMPAIGN_OWNER);
  assert.equal(draft.to, IDENTITY_REGISTRY);
  assert.equal(draft.chainId, 97);
  assert.equal(draft.value, "0x0");
  assert.equal(draft.canAfford, false);
  assert.equal(decodeFunctionData({ abi: identityAbi, data: draft.data }).args?.[0], AGENT_URI);
  assert.ok(BigInt(draft.gas) >= 120_000n);
});

test("registration rejects wrong chain, missing contract and stale state", async () => {
  await assert.rejects(prepareRegistration(client({ getChainId: async () => 56 })), /chain 97/);
  await assert.rejects(prepareRegistration(client({ getCode: async () => "0x" })), /registry is unavailable/);
  await assert.rejects(prepareRegistration(client({ getBlock: async () => ({ number: 1n, timestamp: 1n }) })), /stale/);
});

test("registration refuses existing identities and unresolved pending transactions", async () => {
  await assert.rejects(prepareRegistration(client({ readContract: async () => 1n })), /already owns/);
  await assert.rejects(prepareRegistration(client({ getTransactionCount: async (input: { blockTag: string }) => input.blockTag === "pending" ? 1 : 0 })), /pending transaction/);
});

test("confirmation requires a successful receipt and exact campaign transaction", async () => {
  await assert.rejects(verifyRegistration(hash, client({ getTransactionReceipt: async () => ({ status: "reverted", logs: [] }) })), /reverted/);
  await assert.rejects(verifyRegistration(hash, client({ getTransaction: async () => ({ from: CAMPAIGN_OWNER, to: CAMPAIGN_OWNER, value: 0n, input: registrationData() }) })), /not Tavren/);
  await assert.rejects(verifyRegistration(hash, client({ getTransactionReceipt: async () => ({ status: "success", logs: [] }) })), /matching Registered event/);
});

test("confirmation rejects changed ownership and verifies the exact minted ID", async () => {
  await assert.rejects(verifyRegistration(hash, client({ readContract: async () => CAMPAIGN_OWNER })), /does not match/);
  const proof = await verifyRegistration(hash, client());
  assert.equal(proof.agentId, "42");
  assert.equal(proof.chainId, 97);
  assert.equal(proof.owner, CAMPAIGN_OWNER);
  assert.equal(proof.verified, true);
});
