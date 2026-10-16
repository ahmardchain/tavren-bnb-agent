import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, REGISTRATION_STATUS, REGISTRATION_EVIDENCE, registrationUrl } from "@/lib/campaign";
import { VERIFIED_IDENTITY } from "@/lib/agent-identity";
export function GET() {
  return Response.json({ intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, registrationStatus: REGISTRATION_STATUS, registrationEvidence: REGISTRATION_EVIDENCE, registryId: VERIFIED_IDENTITY.agentId, identityStatus: "verified", identityEvidence: VERIFIED_IDENTITY, registrationUrl: registrationUrl() }, { headers: { "Cache-Control": "no-store" } });
}
