import path from "node:path";
import { loadEnv, EVMWalletProvider } from "@bnbagent/sdk";
import { CAMPAIGN_OWNER } from "../../lib/campaign.ts";
import { loadPolicy } from "./policy.ts";
import { Journal } from "./journal.ts";
import { openWallet, repaymentIO } from "./wallet.ts";
import { runRepayment } from "./repayment.ts";
import { serve } from "./service.ts";

loadEnv();
const command = process.argv[2] ?? "check";
if (command === "check") {
  let policyStatus = "configured";
  try { loadPolicy(); } catch (error) { policyStatus = (error as Error).message; }
  console.info(JSON.stringify({ account: CAMPAIGN_OWNER, chainId: 97, policy: policyStatus, encryptedWalletPresent: EVMWalletProvider.keystoreExists(CAMPAIGN_OWNER, process.env.TAVREN_WALLETS_DIR || undefined), walletPasswordConfigured: !!process.env.TAVREN_WALLET_PASSWORD, modelConfigured: !!process.env.AI_GATEWAY_API_KEY, repaymentEnabled: process.env.TAVREN_EXECUTION_ENABLED === "true", serviceEnabled: process.env.TAVREN_SERVICE_ENABLED === "true", transactionsSent: 0 }, null, 2));
} else {
  try {
    if (!["repay", "serve"].includes(command)) throw new Error("Use check, repay, or serve.");
    const policy = loadPolicy();
    if (command === "repay" && !policy.enabled) throw new Error("Repayment execution is disabled.");
    if (command === "serve" && process.env.TAVREN_SERVICE_ENABLED !== "true") throw new Error("The priced service is disabled.");
    const journal = new Journal(path.resolve(process.env.TAVREN_STATE_DIR ?? ".operator-state"));
    await journal.initialize();
    const wallet = openWallet(policy);
    if (command === "repay") console.info(JSON.stringify(await runRepayment(policy, journal, repaymentIO(policy, wallet))));
    else await journal.exclusive("service", () => serve(policy, wallet, journal));
  } catch { console.error("Operator stopped. Review configuration, journal state and receipts locally. No automatic retry was attempted."); process.exitCode = 1; }
}
