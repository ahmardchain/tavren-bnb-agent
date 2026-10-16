import { readPosition } from "./venus.ts";
import { makePlan } from "./risk.ts";
import { getPolicy, readJson, errorResponse, jsonHeaders } from "./api.ts";
import { PUBLIC_AGENT_ORIGIN } from "./campaign.ts";

export function agentInfo() {
  return Response.json({ name: "Tavren", mode: "read-only", skills: ["monitor-venus"], card: `${PUBLIC_AGENT_ORIGIN}/.well-known/agent-card.json`, escrow: "not-configured" }, { headers: jsonHeaders });
}
export async function monitorMessage(request: Request) {
  let id: string | number | null = null;
  try {
    const body = await readJson(request);
    if (typeof body.id === "string" || typeof body.id === "number") id = body.id;
    if (body.jsonrpc !== "2.0") return Response.json({ jsonrpc: "2.0", id, error: { code: -32600, message: "Use JSON-RPC 2.0." } }, { headers: jsonHeaders });
    if (body.method !== "message/send") return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Only message/send is supported. Funded jobs are not configured on this endpoint." } }, { headers: jsonHeaders });
    const params = body.params as { message?: { parts?: { kind?: string; data?: Record<string, unknown>; text?: string }[] } } | undefined;
    const parts = params?.message?.parts ?? [];
    if (!Array.isArray(parts)) throw new Error("Expected message parts.");
    const data = parts.find(p => p?.kind === "data")?.data;
    const text = parts.filter(p => p?.kind === "text").map(p => p.text).join(" ");
    const wallet = data?.wallet ?? text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (typeof wallet !== "string") throw new Error("Include a BSC testnet wallet in message.parts data as {wallet}.");
    const policy = getPolicy(data?.policy);
    const snapshot = await readPosition(wallet), plan = makePlan(snapshot, policy);
    return Response.json({ jsonrpc: "2.0", id, result: { kind: "message", role: "agent", messageId: crypto.randomUUID(), parts: [{ kind: "data", data: { snapshot, plan, signed: false } }] } }, { headers: jsonHeaders });
  } catch (error) {
    const safe = await errorResponse(error).json() as { error: string };
    return Response.json({ jsonrpc: "2.0", id, error: { code: -32602, message: safe.error } }, { headers: jsonHeaders });
  }
}
