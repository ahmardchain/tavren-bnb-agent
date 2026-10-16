import { prepareRepayment } from "@/lib/venus";
import { getPolicy, readJson, errorResponse, jsonHeaders } from "@/lib/api";
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.wallet !== "string") throw new Error("Enter a wallet address.");
    return Response.json(await prepareRepayment(body.wallet, getPolicy(body.policy)), { headers: jsonHeaders });
  } catch (error) { return errorResponse(error); }
}
