import { defineTool } from "eve/tools";
import { z } from "zod";
import { prepareRepayment } from "../../../lib/venus.ts";
export default defineTool({
  description: "Prepare fresh unsigned exact approvals and capped Venus debt repayment calldata on chain 97. Cannot borrow, withdraw, sign or broadcast.",
  inputSchema: z.object({ wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/), triggerBps: z.number().int().min(10500).max(30000), targetBps: z.number().int().max(50000), maxRepayUsd: z.string() }),
  async execute({ wallet, ...policy }) { return prepareRepayment(wallet, policy); },
});
