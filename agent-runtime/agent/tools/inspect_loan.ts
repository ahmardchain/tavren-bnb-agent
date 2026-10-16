import { defineTool } from "eve/tools";
import { z } from "zod";
import { readPosition } from "../../../lib/venus.ts";
import { DEFAULT_POLICY, makePlan } from "../../../lib/risk.ts";
export default defineTool({
  description: "Read a BSC testnet Venus Core loan at one observed block and return exact risk evidence and a bounded repayment plan. Never signs or sends a transaction.",
  inputSchema: z.object({ wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
  async execute({ wallet }) { const snapshot = await readPosition(wallet); return { snapshot, plan: makePlan(snapshot, DEFAULT_POLICY), execution: "not-signed" }; },
});
