import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, PUBLIC_AGENT_ORIGIN } from "./campaign.ts";

export const AGENT_URI = `${PUBLIC_AGENT_ORIGIN}/metadata`;
export function agentCard() {
  return {
    protocolVersion: "0.3.0", name: "Tavren", version: "0.3.0",
    description: "Health-factor monitoring for Venus Core on BSC testnet (97). Reads block-pinned lending evidence and returns capped repayment plans. Public monitoring is read-only; funded jobs and autonomous signing are not enabled on this endpoint.",
    url: `${PUBLIC_AGENT_ORIGIN}/api/agent`, preferredTransport: "JSONRPC",
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json", "text/plain"], defaultOutputModes: ["application/json"],
    skills: [{ id: "monitor-venus", name: "Inspect a Venus Core loan", description: "Supply a BSC testnet wallet in a data part as {wallet, policy?}. Returns a block-pinned snapshot and capped repayment plan without signing a transaction.", tags: ["health-factor", "venus", "bsc-testnet"], examples: [`Check the Venus Core loan for ${CAMPAIGN_OWNER} on BSC testnet.`] }],
  };
}

export function registrationDocument() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: "Tavren",
    description: "Health-factor monitoring: block-pinned Venus Core loan checks and capped repayment planning on BSC testnet (97). The public monitoring endpoint is live and read-only. Autonomous loan execution, priced jobs and marketplace listing remain pending.",
    image: `${PUBLIC_AGENT_ORIGIN}/tavren.svg`,
    services: [{ name: "A2A", endpoint: `${PUBLIC_AGENT_ORIGIN}/.well-known/agent-card.json`, version: "0.3.0" }, { name: "web", endpoint: `${PUBLIC_AGENT_ORIGIN}/register` }],
    active: true, x402Support: false, registrations: [],
    campaign: { intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, identityStatus: "awaiting-wallet-signature", category: "health-factor" },
  };
}
