import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
test("invalid requests are rejected before chain access", async () => {
  const { POST } = await import("../app/api/position/route.ts");
  for (const body of ["not json", "[]", '{}', '{"wallet":"invalid"}']) {
    const response = await POST(new Request("https://example.test/api/position", { method: "POST", body }));
    assert.equal(response.status, 400); assert.equal(typeof (await response.json() as { error: string }).error, "string");
  }
});
test("discovery does not falsely claim registry ownership or paid jobs", async () => {
  const { GET } = await import("../app/.well-known/agent-card.json/route.ts");
  const card = await GET(new Request("https://example.test/.well-known/agent-card.json")).json() as { skills: { id: string }[]; capabilities: { streaming: boolean } };
  assert.equal(card.skills[0].id, "monitor-venus"); assert.equal(card.capabilities.streaming, false);
  const registration = await (await import("../app/agent.json/route.ts")).GET(new Request("https://example.test/agent.json")).json() as { active: boolean; registrations: unknown[]; x402Support: boolean };
  assert.equal(registration.active, true); assert.deepEqual(registration.registrations, []); assert.equal(registration.x402Support, false);
});
test("unsupported A2A methods cannot activate paid work", async () => {
  const { POST } = await import("../app/api/agent/route.ts");
  const response = await POST(new Request("https://example.test/api/agent", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "negotiate-erc8183-job" }) }));
  const result = await response.json() as { id: number; error: { code: number } };
  assert.equal(result.id, 7); assert.equal(result.error.code, -32601);
});
test("campaign submission records the owner's confirmation without claiming registry verification", async () => {
  const { GET } = await import("../app/api/campaign/route.ts");
  const campaign = await GET().json() as { registrationStatus: string; registrationEvidence: { source: string }; registryId: unknown };
  assert.equal(campaign.registrationStatus, "submitted");
  assert.equal(campaign.registrationEvidence.source, "owner-confirmation");
  assert.equal(campaign.registryId, null);
});
