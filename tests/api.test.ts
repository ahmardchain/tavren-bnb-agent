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
test("discovery publishes the confirmed identity while paid jobs remain disabled", async () => {
  const { GET } = await import("../app/.well-known/agent-card.json/route.ts");
  const card = await GET(new Request("https://example.test/.well-known/agent-card.json")).json() as { skills: { id: string }[]; capabilities: { streaming: boolean } };
  assert.equal(card.skills[0].id, "monitor-venus"); assert.equal(card.capabilities.streaming, false);
  const registration = await (await import("../app/agent.json/route.ts")).GET(new Request("https://example.test/agent.json")).json() as { active: boolean; registrations: unknown[]; x402Support: boolean };
  assert.equal(registration.active, true);
  assert.deepEqual(registration.registrations, [{ agentId: 2640, agentRegistry: "eip155:97:0x8004A818BFB912233c491871b3d84c89A494BD9e" }]);
  assert.equal(registration.x402Support, false);
});
test("unsupported A2A methods cannot activate paid work", async () => {
  const { POST } = await import("../app/api/agent/route.ts");
  const response = await POST(new Request("https://example.test/api/agent", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "negotiate-erc8183-job" }) }));
  const result = await response.json() as { id: number; error: { code: number } };
  assert.equal(result.id, 7); assert.equal(result.error.code, -32601);
});
test("campaign form submission and verified registry identity have separate evidence", async () => {
  const { GET } = await import("../app/api/campaign/route.ts");
  const campaign = await GET().json() as { registrationStatus: string; registrationEvidence: { source: string }; registryId: string; identityStatus: string; identityEvidence: { chainId: number; verified: boolean } };
  assert.equal(campaign.registrationStatus, "submitted");
  assert.equal(campaign.registrationEvidence.source, "owner-confirmation");
  assert.equal(campaign.registryId, "2640");
  assert.equal(campaign.identityStatus, "verified");
  assert.equal(campaign.identityEvidence.chainId, 97);
  assert.equal(campaign.identityEvidence.verified, true);
});
