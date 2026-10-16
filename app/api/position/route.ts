import { readPosition } from "@/lib/venus";
import { makePlan } from "@/lib/risk";
import { getPolicy, readJson, errorResponse, jsonHeaders } from "@/lib/api";
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.wallet !== "string") throw new Error("Enter a wallet address.");
    const policy = getPolicy(body.policy), snapshot = await readPosition(body.wallet);
    return Response.json({ snapshot, plan: makePlan(snapshot, policy) }, { headers: jsonHeaders });
  } catch (error) { return errorResponse(error); }
}
