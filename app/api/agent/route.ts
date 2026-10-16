import { readPosition } from "@/lib/venus";
import { makePlan } from "@/lib/risk";
import { getPolicy, readJson, errorResponse, jsonHeaders } from "@/lib/api";
export function GET() { return Response.json({ name: "Tavren", mode: "read-only", skills: ["monitor-venus"], card: "/.well-known/agent-card.json", escrow: "not-configured" }); }
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const id = body.id ?? null;
    if (body.method !== "message/send") return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Only message/send is supported. Escrow negotiation is not configured." } });
    const params = body.params as { message?: { parts?: { kind?: string; data?: Record<string, unknown>; text?: string }[] } } | undefined;
    const parts = params?.message?.parts ?? [];
    const data = parts.find(p => p.kind === "data")?.data;
    const text = parts.filter(p => p.kind === "text").map(p => p.text).join(" ");
    const wallet = data?.wallet ?? text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (typeof wallet !== "string") throw new Error("Include a BSC testnet wallet in message.parts data as {wallet}.");
    const snapshot = await readPosition(wallet), plan = makePlan(snapshot, getPolicy(data?.policy));
    return Response.json({ jsonrpc: "2.0", id, result: { kind: "message", role: "agent", messageId: crypto.randomUUID(), parts: [{ kind: "data", data: { snapshot, plan, signed: false } }] } }, { headers: jsonHeaders });
  } catch (error) { return errorResponse(error); }
}
