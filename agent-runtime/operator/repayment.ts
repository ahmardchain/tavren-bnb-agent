import { parseUsd } from "../../lib/risk.ts";
import type { prepareRepayment, PreparedTransaction } from "../../lib/venus.ts";
import type { OperatorPolicy } from "./policy.ts";
import { Journal } from "./journal.ts";

export type Prepared = Awaited<ReturnType<typeof prepareRepayment>>;
type Receipt = { hash: string; confirmedRepay: boolean };
export type RepaymentIO = {
  prepare: () => Promise<Prepared>;
  send: (transaction: PreparedTransaction, prepared: Prepared) => Promise<Receipt>;
};
type Ledger = { day: string; reservedUsd: string; unresolved: boolean; block: string | null; hashes: string[] };

export async function runRepayment(policy: OperatorPolicy, journal: Journal, io: RepaymentIO) {
  if (!policy.enabled) throw new Error("Execution is disabled. The operator must explicitly enable its fixed policy.");
  return journal.exclusive("repayment", async () => {
    const day = new Date().toISOString().slice(0, 10);
    let ledger = await journal.read<Ledger>("repayment", { day, reservedUsd: "0", unresolved: false, block: null, hashes: [] });
    if (ledger.unresolved) throw new Error("A previous action needs receipt and allowance reconciliation before any retry.");
    const prepared = await io.prepare();
    const { snapshot, plan } = prepared;
    if (snapshot.source !== "live" || snapshot.chainId !== 97 || prepared.chainId !== 97 || snapshot.account.toLowerCase() !== policy.account.toLowerCase()) throw new Error("Execution requires a live chain-97 snapshot for the operator wallet.");
    if (snapshot.block === null || Date.now() - snapshot.observedAt > 90_000 || snapshot.observedAt > Date.now() + 5_000 || prepared.expiresAt <= Date.now()) throw new Error("Execution evidence is stale.");
    if (plan.action !== "REPAY") return { status: plan.action, reason: plan.reason, sent: false };
    if (!plan.market || !policy.allowedMarkets.some(x => x.toLowerCase() === plan.market!.address.toLowerCase())) throw new Error("The repayment market is not explicitly allowed.");
    if (ledger.block === snapshot.block) throw new Error("This observed block has already been executed. Refresh the position.");
    const amount = BigInt(plan.repayUsd);
    if (amount <= 0n || amount > parseUsd(policy.maxRepayUsd)) throw new Error("Repayment exceeds the per-action cap.");
    const reserved = ledger.day === day ? BigInt(ledger.reservedUsd) : 0n;
    if (reserved + amount > parseUsd(policy.dailyCapUsd)) throw new Error("The daily repayment cap would be exceeded.");
    // Reserve before the first broadcast. A crash or ambiguous transaction
    // keeps the reservation and stops retries, including across UTC day changes.
    ledger = { day, reservedUsd: (reserved + amount).toString(), unresolved: true, block: snapshot.block, hashes: [] };
    await journal.write("repayment", ledger);
    let confirmed = false;
    for (const transaction of prepared.transactions) {
      if (prepared.expiresAt <= Date.now()) throw new Error("The execution plan expired; reconcile any preceding approvals.");
      const receipt = await io.send(transaction, prepared);
      ledger.hashes.push(receipt.hash);
      await journal.write("repayment", ledger);
      if (transaction.kind === "repay") {
        if (!receipt.confirmedRepay) throw new Error("No matching confirmed Venus RepayBorrow event was found.");
        confirmed = true;
      }
    }
    if (!confirmed) throw new Error("The plan did not produce a confirmed repayment.");
    ledger.unresolved = false;
    await journal.write("repayment", ledger);
    return { status: "REPAID", sent: true, chainId: 97, account: policy.account, observedBlock: snapshot.block, repayUsd: plan.repayUsd, hashes: ledger.hashes };
  });
}
