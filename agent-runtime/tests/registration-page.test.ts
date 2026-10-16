import test from "node:test";
import assert from "node:assert/strict";
import { Script, createContext } from "node:vm";
import { createRegistrationScript, registrationScript } from "../agent/lib/registration-page.ts";
import { VERIFIED_IDENTITY } from "../../lib/agent-identity.ts";
import { CAMPAIGN_OWNER } from "../../lib/campaign.ts";
import { AGENT_URI } from "../../lib/agent-discovery.ts";
import { IDENTITY_REGISTRY, registrationData } from "../../lib/agent-registration.ts";

function page(options: { owner?: string; failure?: number | string; savedHash?: string; published?: boolean } = {}) {
  const elements = new Map<string, Record<string, unknown>>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { value: "", dataset: {}, disabled: false, hidden: true });
    return elements.get(id)!;
  };
  const storage = new Map<string, string>();
  const key = "tavren-erc8004-pending-97";
  if (options.savedHash) storage.set(key, options.savedHash);
  const transactions: Record<string, unknown>[] = [];
  const walletRequests: string[] = [];
  const draft = { chainId: 97, from: CAMPAIGN_OWNER, to: IDENTITY_REGISTRY, agentURI: AGENT_URI, data: registrationData(), value: "0x0", gas: "0x35000", gasPrice: "0x5f5e100", balanceWei: "10000000000000000", maxEstimatedFeeWei: "22000000000000", canAfford: true, block: "100", expiresAt: Date.now() + 120000 };
  const context = createContext({
    console,
    document: { getElementById: element, querySelector: () => element("details") },
    window: { ethereum: { async request(input: { method: string; params?: Record<string, unknown>[] }) {
      walletRequests.push(input.method);
      if (input.method === "eth_accounts" || input.method === "eth_requestAccounts") return [options.owner ?? CAMPAIGN_OWNER];
      if (input.method === "eth_chainId") return "0x61";
      if (input.method === "eth_sendTransaction") {
        transactions.push(input.params![0]);
        if (options.failure) throw Object.assign(new Error("Wallet request failed"), { code: options.failure });
        return `0x${"ab".repeat(32)}`;
      }
    } } },
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    fetch: async () => Response.json(draft), navigator: { clipboard: { writeText: async () => {} } },
  });
  new Script(options.published ? registrationScript : createRegistrationScript(null)).runInContext(context);
  return { element, storage, transactions, walletRequests, key, click: async (id: string) => (element(id).onclick as () => Promise<void>)() };
}

test("the published identity takes priority over saved hashes and cannot mint again", async () => {
  const p = page({ published: true, savedHash: `0x${"cd".repeat(32)}` });
  assert.equal(p.element("tx-hash").value, VERIFIED_IDENTITY.transactionHash);
  assert.equal(p.element("registration-actions").hidden, true);
  assert.equal(JSON.parse(String(p.element("proof").textContent)).agentId, "2640");
  assert.equal(p.element("connect").disabled, true);
  await p.click("connect"); await p.click("prepare"); await p.click("sign");
  assert.deepEqual(p.walletRequests, []);
  assert.equal(p.transactions.length, 0);
});

test("registration page refuses a different campaign wallet before any transaction", async () => {
  const p = page({ owner: "0x0000000000000000000000000000000000000001" });
  await p.click("connect");
  await p.click("sign");
  assert.equal(p.transactions.length, 0);
  assert.match(String(p.element("status").textContent), /campaign wallet/);
});

test("wallet submission contains only the reviewed registry call and saves its hash", async () => {
  const p = page();
  await p.click("connect"); await p.click("prepare"); await p.click("sign");
  assert.equal(p.transactions.length, 1);
  const tx = p.transactions[0];
  assert.equal(tx.to, IDENTITY_REGISTRY); assert.equal(tx.data, registrationData());
  assert.equal(tx.chainId, "0x61"); assert.equal(tx.value, "0x0");
  assert.match(p.storage.get(p.key)!, /^0x[0-9a-f]{64}$/);
  assert.equal(p.element("sign").disabled, true);
});

test("ambiguous wallet results block another submission while explicit rejection allows review", async () => {
  for (const failure of ["network-disconnected", 4001]) {
    const p = page({ failure });
    await p.click("connect"); await p.click("prepare"); await p.click("sign");
    assert.equal(p.transactions.length, 1);
    assert.equal(p.element("sign").disabled, failure !== 4001);
    if (failure !== 4001) { await p.click("sign"); assert.equal(p.transactions.length, 1); }
  }
});

test("a saved pending hash cannot be replaced by a new registration", async () => {
  const p = page({ savedHash: `0x${"cd".repeat(32)}` });
  await p.click("connect"); await p.click("sign");
  assert.equal(p.transactions.length, 0);
  assert.equal(p.element("prepare").disabled, true);
});
