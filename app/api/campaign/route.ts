import { CAMPAIGN_OWNER, CAMPAIGN_CHAIN_ID, REGISTRATION_STATUS, REGISTRATION_EVIDENCE, registrationUrl } from "@/lib/campaign";
export function GET() {
  return Response.json({ intendedOwner: CAMPAIGN_OWNER, chainId: CAMPAIGN_CHAIN_ID, registrationStatus: REGISTRATION_STATUS, registrationEvidence: REGISTRATION_EVIDENCE, registryId: null, registrationUrl: registrationUrl() }, { headers: { "Cache-Control": "no-store" } });
}
