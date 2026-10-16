import { DEFAULT_POLICY, validatePolicy, type Policy } from "./risk.ts";
export const jsonHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function getPolicy(input: unknown): Policy {
  if (input === undefined) return DEFAULT_POLICY;
  if (!input || typeof input !== "object") throw new Error("Invalid policy.");
  const p = input as Record<string, unknown>;
  if (typeof p.triggerBps !== "number" || typeof p.targetBps !== "number" || typeof p.maxRepayUsd !== "string") throw new Error("Invalid policy fields.");
  return validatePolicy({ triggerBps: p.triggerBps, targetBps: p.targetBps, maxRepayUsd: p.maxRepayUsd });
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 16_384) throw new Error("Request is too large.");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value;
}
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not read Venus. Try again shortly.";
  // Provider URLs and internal stacks must not be returned to visitors.
  const safe = /HTTP|fetch|Request|timeout|URL|RPC Request|contract function/i.test(message) ? "The testnet provider could not complete the read. Try again shortly." : message.slice(0, 220);
  return Response.json({ error: safe }, { status: 400, headers: jsonHeaders });
}
