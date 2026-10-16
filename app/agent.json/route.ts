import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, REGISTRATION_STATUS } from "@/lib/campaign";
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({ type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: "Tavren", description: "Health factor monitoring: block-pinned Venus Core loan checks and capped repayment preparation on BSC testnet (97). Registry ownership and agent execution are pending setup.", services: [{ name: "A2A", endpoint: `${origin}/.well-known/agent-card.json`, version: "0.3.0" }, { name: "web", endpoint: origin }], active: false, x402Support: false, registrations: [], campaign: { intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, registrationStatus: REGISTRATION_STATUS } });
}
