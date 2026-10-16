import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleSnapshot, makePlan } from "../../lib/risk.ts";
import { loadPolicy, parseMonitorTask, validateJobId } from "../operator/policy.ts";
import { Journal } from "../operator/journal.ts";
import { runRepayment, type Prepared, type RepaymentIO } from "../operator/repayment.ts";
import { checkSigningFee } from "../operator/wallet.ts";
import { validateInquiry, SERVICE_TERMS } from "../operator/service.ts";
import { fulfillFundedJob, type JobIO } from "../operator/jobs.ts";
import { NegotiationHandler } from "@bnbagent/sdk/erc8183";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress, type Hex } from "viem";

const env = {
  TAVREN_TRIGGER_BPS: "13500", TAVREN_TARGET_BPS: "16000", TAVREN_MAX_REPAY_USD: "25", TAVREN_DAILY_CAP_USD: "25",
  TAVREN_MAX_TX_FEE_BNB: "0.001", TAVREN_ALLOWED_MARKETS: sampleSnapshot().markets[0]!.address,
  TAVREN_PUBLIC_URL: "https://operator.example", TAVREN_SERVICE_PRICE_RAW: "1000000", TAVREN_EXECUTION_ENABLED: "true", TAVREN_MAX_JOBS_PER_DAY: "1",
};
const policy = loadPolicy(env);
function prepared(block = "100"): Prepared {
  const snapshot = { ...sampleSnapshot(20), source: "live" as const, account: policy.account, block };
  const plan = makePlan(snapshot, policy);
  return { snapshot, plan, chainId: 97, expiresAt: Date.now() + 60_000, transactions: [{ kind: "repay", to: plan.market!.address, data: "0x", value: "0" }] };
}
async function journal(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(tmpdir(), "tavren-operator-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = new Journal(directory); await result.initialize(); return result;
}
test("operator requires explicit valid spending policy and remains disabled by default", () => {
  assert.throws(() => loadPolicy({}));
  assert.equal(loadPolicy({ ...env, TAVREN_EXECUTION_ENABLED: undefined }).enabled, false);
  for (const override of [{ TAVREN_DAILY_CAP_USD: "24" }, { TAVREN_ALLOWED_MARKETS: "0x0000000000000000000000000000000000000000" }, { TAVREN_PUBLIC_URL: "http://operator.example" }, { TAVREN_MAX_TX_FEE_BNB: "0.004" }, { TAVREN_SERVICE_PRICE_RAW: "0" }]) assert.throws(() => loadPolicy({ ...env, ...override }));
});
test("quote scope rejects execution commands, injected terms, context URLs and unsafe job IDs", () => {
  const request = { task_description: "monitor-venus:" + policy.account, terms: SERVICE_TERMS };
  assert.equal(parseMonitorTask(request.task_description), policy.account);
  assert.deepEqual(validateInquiry(request), request);
  assert.throws(() => validateInquiry({ ...request, task_description: "repay:" + policy.account }));
  assert.throws(() => validateInquiry({ ...request, terms: { ...SERVICE_TERMS, calldata: "0x" } }));
  assert.throws(() => validateInquiry({ ...request, context_urls: ["http://127.0.0.1"] }));
  for (const id of [0, -1, "1", 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateJobId(id));
});
test("signer refuses wrong-chain transactions and fees beyond the operator cap", () => {
  checkSigningFee({ chainId: 97, gas: 21000n, gasPrice: 1n }, policy);
  assert.throws(() => checkSigningFee({ chainId: 56, gas: 21000n, gasPrice: 1n }, policy));
  assert.throws(() => checkSigningFee({ chainId: 97, gas: 1_000_000n, gasPrice: 1_000_000_000n + 1n }, policy));
  assert.throws(() => checkSigningFee({ chainId: 97, gas: 0n, gasPrice: 1n }, policy));
});
test("disabled, sample, stale, foreign-account and unapproved-market execution cannot broadcast", async t => {
  const store = await journal(t); let calls = 0;
  const send: RepaymentIO["send"] = async () => { calls++; return { hash: "0x1", confirmedRepay: true }; };
  await assert.rejects(() => runRepayment({ ...policy, enabled: false }, store, { prepare: async () => prepared(), send }));
  for (const change of [{ source: "sample" as const }, { observedAt: Date.now() - 100_000 }, { account: "0x0000000000000000000000000000000000000001" }]) {
    const p = prepared(); p.snapshot = { ...p.snapshot, ...change };
    await assert.rejects(() => runRepayment(policy, store, { prepare: async () => p, send }));
  }
  await assert.rejects(() => runRepayment({ ...policy, allowedMarkets: [] }, store, { prepare: async () => prepared(), send }));
  assert.equal(calls, 0);
});
test("confirmed repayment persists its budget and subsequent actions cannot exceed the daily cap", async t => {
  const store = await journal(t); let calls = 0;
  const send: RepaymentIO["send"] = async () => { calls++; return { hash: "0x1", confirmedRepay: true }; };
  const result = await runRepayment(policy, store, { prepare: async () => prepared(), send });
  assert.equal(result.status, "REPAID");
  await assert.rejects(() => runRepayment(policy, store, { prepare: async () => prepared("101"), send }), /daily/);
  assert.equal(calls, 1);
});
test("ambiguous broadcasts remain blocked after reopening the journal and across a day boundary", async t => {
  const store = await journal(t); let calls = 0;
  const io: RepaymentIO = { prepare: async () => prepared(), send: async () => { calls++; throw new Error("receipt timeout"); } };
  await assert.rejects(() => runRepayment(policy, store, io), /timeout/);
  const state = await store.read<Record<string, unknown>>("repayment", {});
  await store.write("repayment", { ...state, day: "2000-01-01" });
  await assert.rejects(() => runRepayment(policy, new Journal(store.directory), io), /reconciliation/);
  assert.equal(calls, 1);
});
test("a successful receipt without a matching repayment event is never marked complete", async t => {
  const store = await journal(t);
  await assert.rejects(() => runRepayment(policy, store, { prepare: async () => prepared(), send: async () => ({ hash: "0x2", confirmedRepay: false }) }), /RepayBorrow/);
  assert.equal((await store.read<{ unresolved: boolean }>("repayment", { unresolved: false })).unresolved, true);
});
test("simultaneous processes cannot reserve or execute the same repayment concurrently", async t => {
  const store = await journal(t);
  let release!: () => void, started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  const first = store.exclusive("repayment", async () => { started(); await held; });
  await entered;
  await assert.rejects(() => runRepayment(policy, new Journal(store.directory), { prepare: async () => prepared(), send: async () => ({ hash: "0x1", confirmedRepay: true }) }), /busy/);
  release(); await first;
});
function jobIO(overrides: Partial<JobIO> = {}): JobIO {
  return {
    verifyJob: async () => ({ valid: true, job: { provider: policy.account, client: "0x0000000000000000000000000000000000000001", expiredAt: String(Math.floor(Date.now() / 1000) + 3600), description: JSON.stringify({ version: 1, negotiated_at: Math.floor(Date.now() / 1000), task: "monitor-venus:" + policy.account, terms: SERVICE_TERMS, price: "1000000", currency: "0x0000000000000000000000000000000000000002" }) } }),
    disputeWindow: async () => 300n,
    createReport: async () => ({ content: "verified report", metadata: {} }),
    submitReport: async () => ({ success: true, txHash: "0x3" }),
    ...overrides,
  };
}
test("unverified jobs and unreadable dispute windows cannot invoke a model or submit work", async t => {
  const store = await journal(t); let work = 0;
  const createReport: JobIO["createReport"] = async () => { work++; return { content: "report", metadata: {} }; };
  await fulfillFundedJob(1, policy, store, jobIO({ verifyJob: async () => ({ valid: false }), createReport }));
  await assert.rejects(() => fulfillFundedJob(2, policy, store, jobIO({ disputeWindow: async () => { throw new Error("RPC unavailable"); }, createReport })));
  assert.equal(work, 0);
});
test("funded work has durable replay protection and consumes the configured daily model budget", async t => {
  const store = await journal(t); let model = 0, submissions = 0;
  const io = jobIO({ createReport: async () => { model++; return { content: "report", metadata: {} }; }, submitReport: async () => { submissions++; return { success: true, txHash: "0x3" }; } });
  await fulfillFundedJob(3, policy, store, io);
  await fulfillFundedJob(3, policy, new Journal(store.directory), io);
  await fulfillFundedJob(4, policy, store, io);
  assert.equal(model, 1); assert.equal(submissions, 1);
  assert.equal((await store.read("job-3", { status: "" })).status, "submitted");
});
test("ambiguous job submission is not replayed after restart or reported as a completed hire", async t => {
  const store = await journal(t); let submissions = 0;
  const io = jobIO({ submitReport: async () => { submissions++; return { success: false, error_code: "tx_pending", tx_hash: "0x4" }; } });
  await fulfillFundedJob(5, policy, store, io);
  await fulfillFundedJob(5, policy, new Journal(store.directory), io);
  assert.equal(submissions, 1);
  assert.equal((await store.read("job-5", { status: "" })).status, "needs-review");
});
test("the SDK quote carries a recoverable signature bound to chain 97 and its commerce contract", async () => {
  const signer = privateKeyToAccount(generatePrivateKey());
  const contract = "0x0000000000000000000000000000000000000002";
  const handler = new NegotiationHandler({ servicePrice: "1000000", currency: contract, chainId: 97, verifyingContract: contract, quoteTtlSeconds: 120, quoteSigner: { address: signer.address, signQuote: hash => signer.signMessage({ message: { raw: hash as Hex } }) } });
  const quote = await handler.negotiate(validateInquiry({ task_description: "monitor-venus:" + policy.account, terms: SERVICE_TERMS }));
  assert.equal(quote.accepted, true); assert.equal(quote.chainId, 97); assert.equal(quote.verifyingContract, contract);
  assert.equal(await recoverMessageAddress({ message: { raw: quote.negotiationHash as Hex }, signature: quote.providerSig as Hex }), signer.address);
});
