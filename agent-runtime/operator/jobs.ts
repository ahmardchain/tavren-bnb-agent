import { parseJobDescription, type OpResult } from "@bnbagent/sdk/erc8183";
import { parseMonitorTask, validateJobId, type OperatorPolicy } from "./policy.ts";
import { Journal } from "./journal.ts";

export type JobIO = {
  verifyJob: (id: number) => Promise<OpResult>;
  disputeWindow: () => Promise<bigint>;
  createReport: (wallet: `0x${string}`) => Promise<{ content: string; metadata: Record<string, unknown> }>;
  submitReport: (id: number, content: string, metadata: Record<string, unknown>) => Promise<OpResult>;
};
export async function fulfillFundedJob(id: unknown, policy: OperatorPolicy, journal: Journal, io: JobIO) {
  const jobId = validateJobId(id);
  return journal.exclusive("jobs", async () => {
    const name = "job-" + jobId;
    if (await journal.read(name, null)) return;
    const checked = await io.verifyJob(jobId);
    if (checked.valid !== true) return { retry: checked.retryable === true };
    const job = checked.job as { description: string; client: string; provider: string; expiredAt: string };
    if (job.provider.toLowerCase() !== policy.account.toLowerCase() || job.client.toLowerCase() === policy.account.toLowerCase()) return;
    const deadline = BigInt(job.expiredAt) - await io.disputeWindow();
    if (deadline < BigInt(Math.floor(Date.now() / 1000) + 300)) return;
    const description = parseJobDescription(job.description);
    if (!description) return;
    const wallet = parseMonitorTask(description.task);
    const day = new Date().toISOString().slice(0, 10);
    const previous = await journal.read("jobs-daily", { day, count: 0 });
    const count = previous.day === day ? previous.count : 0;
    if (count >= policy.maxJobsPerDay) return { retry: true };
    // Reservations precede all model and signing work and survive failures.
    await journal.write("jobs-daily", { day, count: count + 1 });
    await journal.write(name, { status: "running", jobId, startedAt: new Date().toISOString() });
    try {
      const report = await io.createReport(wallet);
      const freshDeadline = BigInt(job.expiredAt) - await io.disputeWindow();
      if (freshDeadline < BigInt(Math.floor(Date.now() / 1000) + 90)) throw new Error("Insufficient time to submit.");
      await journal.write(name, { status: "submitting", jobId, reportCreatedAt: new Date().toISOString() });
      const result = await io.submitReport(jobId, report.content, report.metadata);
      await journal.write(name, { status: result.success ? "submitted" : "needs-review", jobId, transactionHash: result.txHash ?? result.tx_hash ?? null, errorCode: result.error_code ?? null });
    } catch { await journal.write(name, { status: "needs-review", jobId }); }
    // Never auto-retry a persisted claim or ambiguous broadcast. Submission
    // is not settlement: a completed paid hire requires external chain proof.
  });
}
