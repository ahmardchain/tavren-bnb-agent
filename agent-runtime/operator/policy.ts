import { getAddress, isAddress, parseEther, type Address } from "viem";
import { validatePolicy, parseUsd, type Policy } from "../../lib/risk.ts";
import { CAMPAIGN_OWNER } from "../../lib/campaign.ts";

export type OperatorPolicy = Policy & {
  account: Address; allowedMarkets: Address[]; dailyCapUsd: string;
  enabled: boolean; maxFeeWei: bigint; servicePrice: bigint; publicUrl: string; maxJobsPerDay: number;
};

export function loadPolicy(env: NodeJS.ProcessEnv = process.env): OperatorPolicy {
  const account = getAddress(CAMPAIGN_OWNER);
  const policy = validatePolicy({
    triggerBps: Number(env.TAVREN_TRIGGER_BPS), targetBps: Number(env.TAVREN_TARGET_BPS),
    maxRepayUsd: env.TAVREN_MAX_REPAY_USD ?? "",
  });
  const dailyCapUsd = env.TAVREN_DAILY_CAP_USD ?? "";
  const daily = parseUsd(dailyCapUsd);
  if (daily < parseUsd(policy.maxRepayUsd) || daily > parseUsd("10000")) throw new Error("Set a daily cap between the per-action cap and $10,000.");
  const markets = (env.TAVREN_ALLOWED_MARKETS ?? "").split(",").filter(Boolean);
  if (markets.length === 0 || markets.length > 16 || markets.some(x => !isAddress(x.trim(), { strict: false }) || /^0x0{40}$/i.test(x.trim()))) throw new Error("Explicitly allow 1–16 Venus market addresses.");
  const fee = env.TAVREN_MAX_TX_FEE_BNB ?? "";
  if (!/^0\.\d{1,18}$/.test(fee)) throw new Error("Set a positive per-transaction BNB fee cap.");
  const maxFeeWei = parseEther(fee);
  if (maxFeeWei <= 0n || maxFeeWei > parseEther("0.003")) throw new Error("Transaction fee cap must be above zero and at most 0.003 tBNB.");
  if (!/^\d+$/.test(env.TAVREN_SERVICE_PRICE_RAW ?? "")) throw new Error("Set the service price in the commerce token's raw units.");
  const servicePrice = BigInt(env.TAVREN_SERVICE_PRICE_RAW!);
  if (servicePrice <= 0n || servicePrice >= 2n ** 256n) throw new Error("Choose a positive uint256 service price.");
  const maxJobsPerDay = Number(env.TAVREN_MAX_JOBS_PER_DAY);
  if (!Number.isInteger(maxJobsPerDay) || maxJobsPerDay < 1 || maxJobsPerDay > 25) throw new Error("Set a daily model/job limit between 1 and 25.");
  const url = new URL(env.TAVREN_PUBLIC_URL ?? "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Set the operator's public HTTPS origin without a path or credentials.");
  return { ...policy, account, dailyCapUsd, allowedMarkets: markets.map(x => getAddress(x.trim().toLowerCase())), enabled: env.TAVREN_EXECUTION_ENABLED === "true", maxFeeWei, servicePrice, publicUrl: url.origin, maxJobsPerDay };
}

// The task string is signed in the quote and subsequently anchored in escrow.
// No buyer-supplied URLs, policy overrides, calldata or execution commands.
export function parseMonitorTask(task: unknown): Address {
  if (typeof task !== "string" || !/^monitor-venus:0x[0-9a-fA-F]{40}$/.test(task)) throw new Error("Task must be monitor-venus:<wallet-address>.");
  const account = task.slice("monitor-venus:".length);
  if (/^0x0{40}$/i.test(account)) throw new Error("A nonzero wallet is required.");
  return getAddress(account.toLowerCase());
}

export function validateJobId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("A positive safe integer job_id is required.");
  return value;
}
