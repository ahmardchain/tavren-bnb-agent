import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, PUBLIC_AGENT_ORIGIN } from "./campaign.ts";

// Canonical BSC testnet deployment; registration receipt, mint event, current
// ownerOf and tokenURI were independently checked on 16 October 2026.
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const AGENT_URI = `${PUBLIC_AGENT_ORIGIN}/metadata`;
const transactionHash = "0x48e4df13a4f64edb709b0e5e6972f1de8ef2c3badb6a42671e0012ef8d2b3247";

export const VERIFIED_IDENTITY = {
  verified: true,
  agentId: "2640",
  chainId: CAMPAIGN_CHAIN_ID,
  registry: IDENTITY_REGISTRY,
  agentRegistry: `eip155:${CAMPAIGN_CHAIN_ID}:${IDENTITY_REGISTRY}`,
  owner: CAMPAIGN_OWNER,
  agentURI: AGENT_URI,
  transactionHash,
  explorer: `https://testnet.bscscan.com/tx/${transactionHash}`,
  verifiedOn: "2026-10-16",
} as const;
